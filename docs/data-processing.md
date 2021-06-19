Data Processing OPs
===================

| 31-28 |27 |26 |25 | 24-21 |20 | 19-16 | 15-12 | 11-7   | 6-5   | 4 | 3-0 |
|-------|---|---|---|-------|---|-------|-------|--------|-------|---|-----|
|`cond` | 0 | 0 | 0 |`oper` |`S`| `Rn`  | `Rd`  |`amount`|`shift`| 0 |`Rm` |


| 31-28 |27 |26 |25 | 24-21 |20 | 19-16 | 15-12 | 11-8 | 7 | 6-5   | 4 | 3-0 |
|-------|---|---|---|-------|---|-------|-------|------|---|-------|---|-----|
|`cond` | 0 | 0 | 0 |`oper` |`S`| `Rn`  | `Rd`  |`Rs`  | 0 |`shift`| 1 |`Rm` |


| 31-28 |27 |26 |25 | 24-21 |20 | 19-16 | 15-12 | 11-8 | 7-0   |
|-------|---|---|---|-------|---|-------|-------|------|-------|
|`cond` | 0 | 0 | 1 |`oper` |`S`| `Rn`  | `Rd`  |`rot` | `imm` |

Parameters
----------

* `cond` - See [condition codes](https://github.com/velipso/gbasm/blob/main/docs/condition.md)
* `Rn` - Source register
* `Rd` - Destination register
* `Rs` - Shift amount specified in bottom byte of register (cannot be R15)
* `amount` - Shift amount immediate; when using LSR, ASR, ROR, the value of 0 means 32
* `rot` -
* `imm` -

| `oper` | OP  |
|--------|-----|
| 0000   | AND |
| 0001   | EOR |
| 0010   | SUB |
| 0011   | RSB |
| 0100   | ADD |
| 0101   | ADC |
| 0110   | SBC |
| 0111   | RST |
| 1000   | TST |
| 1001   | TEQ |
| 1010   | CMP |
| 1011   | CMN |
| 1100   | ORR |
| 1101   | MOV |
| 1110   | BIC |
| 1111   | MVN |

| `S` | Description                  |
|-----|------------------------------|
|  0  | Do not alter condition codes |
|  1  | Set condition codes          |

|`shift`| OP  |Description       |
|-------|-----|------------------|
| 00    | LSL | Logical left     |
| 01    | LSR | Logical right    |
| 10    | ASR | Arithmetic right |
| 11    | ROR | Rotate right     |
