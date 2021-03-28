Conditions
==========

| Value | Mnemonic | Description                         | Logic               |
|-------|----------|-------------------------------------|---------------------|
| 0000  | EQ       | Equal                               | `Z == 1`            |
| 0001  | NE       | Not equal                           | `Z == 0`            |
| 0010  | CS/HS    | Carry set / unsigned higher or same | `C == 1`            |
| 0011  | CC/LO    | Carry clear / unsigned lower        | `C == 0`            |
| 0100  | MI       | Minus / negative                    | `N == 1`            |
| 0101  | PL       | Plus / positive or zero             | `N == 0`            |
| 0110  | VS       | Overflow                            | `V == 1`            |
| 0111  | VC       | No overflow                         | `V == 0`            |
| 1000  | HI       | Unsigned higher                     | `C == 1 AND Z == 0` |
| 1001  | LS       | Unsigned lower or same              | `C == 0 OR Z == 1`  |
| 1010  | GE       | Signed greater than or equal        | `N == V`            |
| 1011  | LT       | Signed less than                    | `N != V`            |
| 1100  | GT       | Signed greater than                 | `Z == 0 AND N == V` |
| 1101  | LE       | Signed less than or equal           | `Z == 1 OR N != V`  |
| 1110  | AL       | Always                              | Always true         |
| 1111  | NV       | Never                               | Undefined           |
