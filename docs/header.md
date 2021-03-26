Header Format
=============

| Address | Size           | Description                                |
|---------|----------------|--------------------------------------------|
| `0x00`  | `uint32_t`     | ARM branch instruction to start of program |
| `0x04`  | `uint8_t[156]` | Nintendo logo                              |
| `0xA0`  | `uint8_t[12]`  | Game title in ASCII, `NULL` terminated     |
| `0xAC`  | `uint8_t[4]`   | Game code in ASCII                         |
| `0xB0`  | `uint8_t[2]`   | Developer code in ASCII                    |
| `0xB2`  | `uint8_t`      | `0x96`                                     |
| `0xB3`  | `uint8_t`      | `0x00`                                     |
| `0xB4`  | `uint8_t`      | `0x00` for normal, `0x80` for debug mode   |
| `0xB5`  | `uint8_t[7]`   | Zeroed out                                 |
| `0xBC`  | `uint8_t`      | Software version (usually `0x00`)          |
| `0xBD`  | `uint8_t`      | Checksum                                   |
| `0xBE`  | `uint8_t[2]`   | Zeroed out                                 |
| ...TODO ...|
