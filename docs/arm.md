ARM Opcodes
===========

Conditions
----------

| Value | Mnemonic | Description                         | Logic               |
|-------|----------|-------------------------------------|---------------------|
| `0x0` | EQ       | Equal                               | `Z == 1`            |
| `0x1` | NE       | Not equal                           | `Z == 0`            |
| `0x2` | CS/HS    | Carry set / unsigned higher or same | `C == 1`            |
| `0x3` | CC/LO    | Carry clear / unsigned lower        | `C == 0`            |
| `0x4` | MI       | Minus / negative                    | `N == 1`            |
| `0x5` | PL       | Plus / positive or zero             | `N == 0`            |
| `0x6` | VS       | Overflow                            | `V == 1`            |
| `0x7` | VC       | No overflow                         | `V == 0`            |
| `0x8` | HI       | Unsigned higher                     | `C == 1 AND Z == 0` |
| `0x9` | LS       | Unsigned lower or same              | `C == 0 OR Z == 1`  |
| `0xA` | GE       | Signed greater than or equal        | `N == V`            |
| `0xB` | LT       | Signed less than                    | `N != V`            |
| `0xC` | GT       | Signed greater than                 | `Z == 0 AND N == V` |
| `0xD` | LE       | Signed less than or equal           | `Z == 1 OR N != V`  |
| `0xE` | AL       | Always                              | Always true         |
| `0xF` | NV       | Never                               | Undefined           |
