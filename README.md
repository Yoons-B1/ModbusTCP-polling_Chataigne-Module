# ModbusTCP-polling_Chataigne-Module
This module enables Modbus TCP in Chataigne and includes a polling function.
<img width="2248" height="1519" alt="chataigne01" src="https://github.com/user-attachments/assets/2cec47a9-5800-4295-bffb-0cb30fdfff37" />

# [Modbus TCP Polling V7 - for Chataigne]

## Features

### 1. Input

* Controls Dry Contact button states as Chataigne input values
* Monitors button presses with a default polling interval of 150 ms
* Triggers when the button is pressed and released

### 2. Output

* Controls Relay COM/NC using value states
* Suitable for sequential power controllers and similar applications

---

## Installation

1. Copy the folder to:

   ```
   Documents → Chataigne → Modules
   ```

2. Launch Chataigne

3. Go to:

   ```
   File → Reload Custom Modules
   ```

4. Add the module:

   ```
   Modules → + → Protocol → Modbus TCP polling
   ```

---

## Configuration

### Basic Settings

* **Network Interface**: Set to your PC IP
* Enable **Auto poll**
* **Poll Type** → Discrete inputs
* **Poll Unit ID** → Number of relays (default: 0)
* **Poll Count** → Number of buttons (default: 1)

### Output Settings

* **Remote Host** → Relay IP (e.g., 192.168.0.98)
* **Port** → 502 (default)

---
<img width="2248" height="1519" alt="ch02" src="https://github.com/user-attachments/assets/1d20030c-f3c2-4c5a-a0cc-452bd612739f" />

## Template Setup

1. Add template → **Read Data**

2. Configure:

   * Type → Discrete inputs
   * Unit ID → Number of relays (default: 0)
   * Start address → Button start address (default: 0)
   * Count → Number of buttons (default: 1)

---
<img width="2248" height="1519" alt="ch03" src="https://github.com/user-attachments/assets/da831201-3e4c-4e52-a874-89123f6a8bb8" />

## Input Mapping

* Trigger the template

* Input values appear at:

  ```
  Values → Device 0 → Discrete inputs → Input 0
  ```

* Change **Start address** to 1, 2, etc.
  → Generates Input 1, Input 2, ...

* Assign these inputs to actions as needed

---

## Relay Output

Use:

```
Consequences → Modbus TCP polling → Write coil
```

* Checked → ON
* Unchecked → OFF

---
<img width="2248" height="1519" alt="ch04" src="https://github.com/user-attachments/assets/1d5026dc-4b1d-40a4-a14f-8f122a186aae" />

## Tested Device

* Waveshare Modbus POE ETH Relay (B)

Reference:

* http://www.waveshare.com/wiki/Modbus_POE_ETH_Relay_(B)
* http://www.waveshare.com/wiki/USB3.2-Gen1-HUB-2IN-4OUT

---

## Modbus Server Mode

```
IP   : 192.168.0.98
Port : 502
```

---

## Test Commands

### Output (Relay Control)

```
00 00 00 00 00 06 01 05 00 00 FF 00  (ch1 ON)
00 00 00 00 00 06 01 05 00 00 00 00  (ch1 OFF)
```

### Input (Button Detection)

```
00 00 00 00 00 06 01 02 00 00 00 08  (DI1 click)
00 00 00 00 00 04 01 02 01 01        (click detected response)
```

