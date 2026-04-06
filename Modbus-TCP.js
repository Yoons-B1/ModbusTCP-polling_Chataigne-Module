var nextTransactionId = 0;
var lastTransactionId = -1;

var lastDataStartAdress = 0;
var lastDataCount = 0;

var lastRequestedFile = 0;
var lastRequestedRecord = 0;
var lastRequestedFileLenght = 0;

var pollElapsedMs = 0;
var deviceCache = {};
var categoryCache = {};
var valueCache = {};

var errorMessages = [
    "UNKNOWN",
    "ILLEGAL FUNCTION",
    "ILLEGAL DATA ADDRESS",
    "ILLEGAL DATA VALUE",
    "SERVER DEVICE FAILURE",
    "ACKNOWLEDGE",
    "SERVER DEVICE BUSY",
    "MEMORY PARITY ERROR",
    "GATEWAY PATH UNAVAILABLE",
    "GATEWAY TARGET DEVICE FAILED TO RESPOND"
];

function init(){
    script.setUpdateRate(20);
    pollElapsedMs = 0;
    resetCaches();
}

function resetCaches(){
    deviceCache = {};
    categoryCache = {};
    valueCache = {};
}

function moduleParameterChanged(param){
    if(param.is(local.parameters.clearValues)){
        for(var i=0; i<255; i+=1){
            local.values.removeContainer("device"+i);
        }
        resetCaches();
    }

    if(param.is(local.parameters.autoPoll)
        || param.is(local.parameters.pollInterval)
        || param.is(local.parameters.pollType)
        || param.is(local.parameters.pollUnitId)
        || param.is(local.parameters.pollStart)
        || param.is(local.parameters.pollCount))
    {
        pollElapsedMs = 0;
    }
}

function update(deltaTime){
    if(!local.parameters.autoPoll.get()) return;

    pollElapsedMs += deltaTime * 1000;

    var intervalMs = local.parameters.pollInterval.get();
    if(intervalMs < 50) intervalMs = 50;

    if(pollElapsedMs < intervalMs) return;
    pollElapsedMs = 0;

    readData(
        local.parameters.pollType.get(),
        local.parameters.pollUnitId.get(),
        local.parameters.pollStart.get(),
        local.parameters.pollCount.get()
    );
}

function getDeviceContainer(deviceId){
    var key = "device" + deviceId;
    if(deviceCache[key] != null){
        return deviceCache[key];
    }

    var device = local.values.addContainer("Device " + deviceId);
    device.loadJSONData({
        "removable" : true
    });
    deviceCache[key] = device;
    return device;
}

function getDeviceCategory(device, deviceId, categoryName, categoryId){
    var key = "device" + deviceId + "/" + categoryId;
    if(categoryCache[key] != null){
        return categoryCache[key];
    }

    var category = device.addContainer(categoryName);
    category.loadJSONData({
        "removable" : true
    });
    categoryCache[key] = category;
    return category;
}

function getOrCreateBoolValue(category, cacheKey, label, description){
    if(valueCache[cacheKey] != null){
        return valueCache[cacheKey];
    }

    var valueP = category.addBoolParameter(label, description, false);
    valueP.loadJSONData({
        "removable" : true,
        "type": "Boolean"
    });
    valueCache[cacheKey] = valueP;
    return valueP;
}

function getOrCreateIntValue(category, cacheKey, label, description){
    if(valueCache[cacheKey] != null){
        return valueCache[cacheKey];
    }

    var valueP = category.addIntParameter(label, description, 0, 0, 65535);
    valueP.loadJSONData({
        "removable" : true,
        "type": "Integer"
    });
    valueCache[cacheKey] = valueP;
    return valueP;
}

function checkTransactionId(data){
    var trId = (data[0] << 8) + data[1];
    if(lastTransactionId != trId){
        script.log("Invalid transaction id");
        return false;
    }
    return true;
}

function readBinaryInputs(data, categoryId, categoryName, name, nameId){
    script.log("Type: read "+categoryId);
    var returnedBytes = data[8];

    if(returnedBytes * 8 < lastDataCount){
        script.log("Incorrect number of returned "+categoryId);
        return;
    }

    if(!checkTransactionId(data)) return;

    var deviceId = data[6];
    var device = getDeviceContainer(deviceId);
    var category = getDeviceCategory(device, deviceId, categoryName, categoryId);

    for(var i=0; i<lastDataCount; i+=1){
        var inputId = lastDataStartAdress + i;
        var cacheKey = "device" + deviceId + "/" + categoryId + "/" + nameId + inputId;
        var valueP = getOrCreateBoolValue(category, cacheKey, name + " " + inputId, name + " state n#" + inputId);

        var bitId = (i % 8);
        var byteId = (i - bitId) / 8 + 9;
        valueP.set(((data[byteId] >> bitId) & 0x01) == 1);
    }
}

function readRegisterInput(data, categoryId, categoryName, name, nameId){
    script.log("Type: read "+categoryId);
    var returnedBytes = data[8];

    if(returnedBytes < lastDataCount * 2){
        script.log("Incorrect number of returned "+categoryId);
        return;
    }

    if(!checkTransactionId(data)) return;

    var deviceId = data[6];
    var device = getDeviceContainer(deviceId);
    var category = getDeviceCategory(device, deviceId, categoryName, categoryId);

    for(var i=0; i<lastDataCount; i+=1){
        var inputId = lastDataStartAdress + i;
        var cacheKey = "device" + deviceId + "/" + categoryId + "/" + nameId + inputId;
        var valueP = getOrCreateIntValue(category, cacheKey, name + " " + inputId, name + " n#" + inputId);

        var byteId = (i * 2) + 9;
        valueP.set((data[byteId] << 8) + data[byteId + 1]);
    }
}

function readFileInput(data){
    if(data[10] != 0x06){
        script.log("Incorrect header for file");
        return;
    }
    if(!checkTransactionId(data)) return;

    var deviceId = data[6];
    var device = getDeviceContainer(deviceId);
    var category = getDeviceCategory(device, deviceId, "Files", "files");
    var subcatKey = "device" + deviceId + "/files/file" + lastRequestedFile;
    var subcat = categoryCache[subcatKey];
    if(subcat == null){
        subcat = category.addContainer("File " + lastRequestedFile);
        subcat.loadJSONData({
            "removable" : true
        });
        categoryCache[subcatKey] = subcat;
    }

    for(var i=0; i<lastRequestedFileLenght; i+=1){
        var recordId = lastRequestedRecord + i;
        var cacheKey = subcatKey + "/rec" + recordId;
        var valueP = getOrCreateIntValue(subcat, cacheKey, "Rec " + recordId, "Record n#" + recordId);
        valueP.set(data[11 + i]);
    }
}

function dataReceived(data){
    script.log("Modbus message received:");
    if(data[2] != 0 || data[3] != 0){
        script.log("Incorect protocol type");
        return;
    }

    var cmd = data[7];

    if(cmd == 0x01){
        readBinaryInputs(data, "coils", "Coils", "Coil", "coil");
    }else if(cmd == 0x02){
        readBinaryInputs(data, "discreteInputs", "Discrete inputs", "Input", "input");
    }else if(cmd == 0x03){
        readRegisterInput(data, "holdingRegisters", "Holding registers", "Register", "register");
    }else if(cmd == 0x04){
        readRegisterInput(data, "inputRegisters", "Input registers", "Register", "register");
    }else if(cmd == 0x14){
        readFileInput(data);
    }else if(cmd > 0x80){
        local.values.latestError.latestInvalidCommand.set(cmd - 0x80);
        var errorCode = data[8];
        local.values.latestError.latestErrorCode.set(errorCode);
        local.values.latestError.latestErrorMessage.set(errorMessages[errorCode]);
        local.values.latestError.error.trigger();
    }
}

function sendModbusMessage(device,messageType,data,dataLength){
    lastTransactionId = nextTransactionId;
    nextTransactionId += 1;
    if(nextTransactionId > 65535){
        nextTransactionId = 0;
    }

    var totalLenght = dataLength + 2;

    script.log(data[3]);
    local.sendBytes(
        lastTransactionId >> 8,
        lastTransactionId & 255,
        0x00,
        0x00,
        totalLenght >> 8,
        totalLenght & 255,
        device,
        messageType,
        data
    );
}

function readData(type, address, startAdress, readCount){
    lastDataStartAdress = startAdress;
    lastDataCount = readCount;
    sendModbusMessage(
        address,
        type,
        [
            startAdress >> 8,
            startAdress & 255,
            readCount >> 8,
            readCount & 255
        ],
        4
    );
}

function writeCoil(address, coilAddress, value){
    var dataH = 0;
    if(value){
        dataH = 0xFF;
    }

    sendModbusMessage(
        address,
        0x05,
        [
            coilAddress >> 8,
            coilAddress & 255,
            dataH,
            0
        ],
        4
    );
}

function writeRegister(address, registerAddress, value){
    sendModbusMessage(
        address,
        0x06,
        [
            registerAddress >> 8,
            registerAddress & 255,
            value >> 8,
            value & 255
        ],
        4
    );
}

function readFileRecord(address, file, record, recordCnt){
    lastRequestedFile = file;
    lastRequestedRecord = record;
    lastRequestedFileLenght = recordCnt;

    sendModbusMessage(
        address,
        0x14,
        [
            0x07,
            0x06,
            file >> 8,
            file & 255,
            record >> 8,
            record & 255,
            recordCnt >> 8,
            recordCnt & 255
        ],
        8
    );
}

function writeFileRecord(address, file, record, value){
    sendModbusMessage(
        address,
        0x15,
        [
            0x09,
            0x06,
            file >> 8,
            file & 255,
            record >> 8,
            record & 255,
            0x00,
            0x01,
            value >> 8,
            value & 255
        ],
        10
    );
}
