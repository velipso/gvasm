Registers
=========

There are a total of 37 registers, but not all are accessible at the same time.

| # | ARM         | Thumb      | Description                                     |
|---|-------------|------------|-------------------------------------------------|
| 1 | `r0`        | `r0`       | General purpose                                 |
| 2 | `r1`        | `r1`       | General purpose                                 |
| 3 | `r2`        | `r2`       | General purpose                                 |
| 4 | `r3`        | `r3`       | General purpose                                 |
| 5 | `r4`        | `r4`       | General purpose                                 |
| 6 | `r5`        | `r5`       | General purpose                                 |
| 7 | `r6`        | `r6`       | General purpose                                 |
| 8 | `r7`        | `r7`       | General purpose                                 |
| 9 | `r8`        |            | System/User general purpose                     |
|10 | `r9`        |            | System/User general purpose                     |
|11 | `r10`       |            | System/User general purpose                     |
|12 | `r11`       |            | System/User general purpose                     |
|13 | `r12`       |            | System/User general purpose                     |
|14 | `r13`, `sp` | `sp`       | System/User stack pointer                       |
|15 | `r14`, `lr` | `lr`       | System/User link register                       |
|16 | `r15`, `pc` | `pc`       | Program counter                                 |
|17 | `r8_fiq`    |            | FIQ banked general purpose                      |
|18 | `r9_fiq`    |            | FIQ banked general purpose                      |
|19 | `r10_fiq`   |            | FIQ banked general purpose                      |
|20 | `r11_fiq`   |            | FIQ banked general purpose                      |
|21 | `r12_fiq`   |            | FIQ banked general purpose                      |
|22 | `r13_fiq`   | `sp_fiq`   | FIQ banked general purpose                      |
|23 | `r14_fiq`   | `lr_fiq`   | FIQ banked link register                        |
|24 | `spsr_fiq`  | `spsr_fiq` | FIQ banked saved program status register        |
|25 | `r13_svc`   | `sp_svc`   | Supervisor banked general purpose               |
|26 | `r14_svc`   | `lr_svc`   | Supervisor banked link register                 |
|27 | `spsr_svc`  | `spsr_svc` | Supervisor banked saved program status register |
|28 | `r13_abt`   | `sp_abt`   | Abort banked general purpose                    |
|29 | `r14_abt`   | `lr_abt`   | Abort banked link register                      |
|30 | `spsr_abt`  | `spsr_abt` | Abort banked saved program status register      |
|31 | `r13_irq`   | `sp_irq`   | IRQ banked general purpose                      |
|32 | `r14_irq`   | `lr_irq`   | IRQ banked link register                        |
|33 | `spsr_irq`  | `spsr_irq` | IRQ banked saved program status register        |
|34 | `r13_und`   | `sp_und`   | Undefined banked general purpose                |
|35 | `r14_und`   | `lr_und`   | Undefined banked link register                  |
|36 | `spsr_und`  | `spsr_und` | Undefined banked saved program status register  |
|37 | `cpsr`      | `cpsr`     | Current program status register                 |
