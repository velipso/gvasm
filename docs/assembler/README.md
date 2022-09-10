Assembler
=========

The assembler can be thought of as running in four passes:

1. Load the files and run scripts
2. Rewrite constants if possible
3. Output the binary
4. Rewrite any remaining constants

Comments copy C, where `//` is used for end-of-line comments, and `/* */` is used for block
comments.

```
// comment

/*
block comment
*/
```

Literals
--------

### Numbers

All numbers during assembly are interpreted as 32-bit signed integers.  There are no floating point
numbers.

Numbers can be represented in decimal, binary, octal, and hexadecimal, and optionally use `_` as a
seperator.

```
.printf "%i, %i, %i", 123, 1_000, -5    // decimal
.printf "%b, %b", 0b110011, 0b1111_0000 // binary
.printf "%o, %o", 0c777, 0c123_456      // octal
.printf "%x, %x", 0xabcdef12, 0x55_66   // hexadecimal
```

### Strings

Strings copy C, enclosed with double quotes, and using `\` for escape sequences.

```
.printf "hello, world"    // output string to console
.str "one\ntwo\nthree\0"  // output string to file
```

Labels
------

Labels can start any line.

Labels are effectively 32-bit numbers like everything else.  Their value is the next absolute
address in memory that they point to.  Note that `.base` will affect this value (defaults to
`0x08000000` for normal games).

Labels can be used before they're known in certain circumstances, like for branching instructions or
defined constants, but not for `.align`, `.base`, `.i8fill`, or `.if`.

### Named Labels

```
label1:
.begin
  label2:
.end
// label2 is no longer accessible
.begin label3
  label4:
.end
// label4 is accessible via: label3.label4
```

### Anonymous Labels

Anonymous labels are strings of `-` or `+`.  For example, `-`, `--`, `---`, or `+`, `++`, `+++`,
etc.

Use `-` for backward jumps and `+` for forward jumps.

```
   // jump backwards in a loop
   mov r0, #0
-  add r0, #1
   cmp r0, #50
   blt -

   // jump forwards over an instruction
   cmp r1, #20
   bgt +
   sub r1, #20
+  add r1, #1

   // double loop using - for outer loop, and -- for inner loop
   mov r4, #0
-  mov r5, #0
-- bl  routine
   add r5, #1
   cmp r5, #10
   blt --
   add r4, #1
   cmp r4, #10
   blt -
```

Defined Constants
-----------------

Constant numbers and expressions can be given names using the `.def` statement.

```
.def MaxHealth = 10
.begin
  .def Velocity = 2  // local constant
.end
// Velocity is no longer accessible
.begin User
  .def Height = 12
.end
// Height is accessible via: User.Height
```

Constants can also take parameters:

```
.def lerp(a, b, t) = a + (b - a) * t / 100
.printf "%i", lerp(10, 20, 80) // prints 18 to console
```

### Reserved Constants

Constants beginning with an underscore are reserved for the assembler.

The following constants are always defined and depend on the assembler state:

| Constant   | Description                                                               |
|------------|---------------------------------------------------------------------------|
| `_arm`     | True if in ARM mode (`.arm`)                                              |
| `_base`    | The base value (set by `.base <base>`)                                    |
| `_bytes`   | The length of the output so far, in bytes                                 |
| `_here`    | The next address to be output                                             |
| `_main`    | True if the current file is the start file, not included from another     |
| `_pc`      | The PC value at this address (`_here + 8` for ARM, `_here + 4` for Thumb) |
| `_thumb`   | True if in Thumb mode (`.thumb`)                                          |
| `_version` | Version of the assembler (1002003 is v1.2.3)                              |

Constant Expressions
--------------------

Operators mostly copy from C.  Operators will return 1 for true, and 0 for false, though any
non-zero number is considered true.  Parenthesis can be used to override default precedence.

| Operator              | Description                                            |
|-----------------------|--------------------------------------------------------|
| `-a`                  | Negation                                               |
| `~a`                  | Bit NOT                                                |
| `!a`                  | Logical NOT                                            |
| `a + b`               | Addition                                               |
| `a - b`               | Subtraction                                            |
| `a * b`               | Multiplication                                         |
| `a / b`               | Division (integer)                                     |
| `a % b`               | Modulo                                                 |
| `a << b`              | Shift left                                             |
| `a >> b`              | Sign-extended shift right                              |
| `a >>> b`             | Logical shift right                                    |
| `a & b`               | Bit AND                                                |
| `a ^ b`               | Bit XOR                                                |
| `a < b`               | Test if less than                                      |
| `a <= b`              | Test if less than or equal                             |
| `a > b`               | Test if greater than                                   |
| `a >= b`              | Test if greater than or equal                          |
| `a == b`              | Test if equal                                          |
| `a != b`              | Test if not equal                                      |
| `a && b`              | Logical AND (short circuited)                          |
| `a \|\| b`            | Logical OR (short circuited)                           |
| `assert("msg", cond)` | Returns 1 if `cond` is true, otherwise generates error |
| `abs(a)`              | Absolute value                                         |
| `clamp(a, low, high)` | Clamp `a` between `low` and `high` (inclusive)         |
| `defined(a)`          | Returns 1 if `a` is defined, otherwise 0               |
| `log2(a)`             | Log base 2                                             |
| `max(a, ...)`         | Maximum of all arguments                               |
| `min(a, ...)`         | Minimum of all arguments                               |
| `nrt(a, b)`           | Nth root, returns `pow(a, 1 / b)`                      |
| `pow(a, b)`           | Power                                                  |
| `rgb(r, g, b)`        | Returns 15-bit value using each color component (0-31) |
| `sign(a)`             | Returns -1, 0, or 1 based on the sign of `a`           |
| `sqrt(a)`             | Square root of `a`                                     |

Note: `assert` is useful to verify values at compile-time, for example:

```
.def offset(a) =                                        \
  assert("offset is between 1-4", a >= 0 && a < 5) * (  \
    a * 100 + 30                                        \
  )

.i8 offset(-5) // generates compile-time error
```

Structs
-------

The assembler supports `.struct` in order to define constants incrementally.  Use `.s0`, `.s8`,
`.s16`, or `.s32` inside a struct to reference a new member.

```
.struct $Player
  .s8 health, stamina
  .s32 magic
.end
```

This is equivalent to defining:

```
.def $Player.health = 0
.def $Player.stamina = 1
.def $Player.magic = 4 // padded to align to 32-bits
```

Note that members will be aligned based on their size.

Structs can be nested inside structs:

```
.struct $Player
  .s8 health
  .struct inventory
    .s16 itemId
    .s8 amount
  .end
  .s32 magic
.end
```

Equivalent to:

```
.def $Player.health = 0
.def $Player.inventory.itemId = 2 // padded to align to 16-bits
.def $Player.inventory.amount = 4
.def $Player.magic = 8 // padded to align to 32-bits
```

Start offsets are supported:

```
.struct $Player = 0x03000000 // start at 0x03000000
  .s8 health, stamina
  .s32 magic
.end
```

Equivalent to:

```
.def $Player.health = 0x03000000
.def $Player.stamina = 0x03000001
.def $Player.magic = 0x03000004
```

Arrays are also supported:

```
.struct $Player
  .s16 itemIds[3]
.end
```

Equivalent to:

```
.def $Player.itemIds = 0
.def $Player.itemIds.length = 3  // 3 items in the array
.def $Player.itemIds.bytes = 6   // 6 total bytes
```

Scripts
-------

Compile-time scripts can be used for processing data before outputting it to the assembler.

The scripting language is simple but powerful.  For detailed information on the language, read:

* [Scripting Guide](./script.md)
* [Scripting Standard Library](./lib.md)

In summary, scripts are executed inside `.script` / `.end` blocks, and anything output using `put`
inside the script is assembled as source code.  For example:

```
.script
  for var i: range 100
    put ".i8 $i"
  end
  // outputs:
  //   .i8 0
  //   .i8 1
  //   .i8 2
  //   ...etc, up to 99
.end
```

Pool Literals
-------------

The assembler supports the following syntax:

```
// ARM or Thumb:
ldr rX, =1234

// only ARM:
ldrh rX, =1234
ldrsh rX, =1234
ldrsb rX, =34
```

This will load the constant number `1234` into the `rX` register.

This does not directly translate to an ARMv4 opcode.  Instead, the assembler will attempt to convert
it to a `mov` instruction if possible.  If it can't convert it to a `mov` instruction, it will
instead store `1234` in the ROM, and convert the instruction to a `ldr` relative to the PC.

The assembler doesn't know where to store `1234` -- so it starts collecting constant numbers into a
literal pool, and waits for the `.pool` statement to dump all the constants it has collected.  Then
it wires the `ldr` instruction to point to the pool.

It's up to the programmer to place the `.pool` close to the `ldr` statement, so that the final `ldr`
can read the memory to load the register.

For example:

```
main:

ldrh r0, =rgb(12, 31, 5)
// ... more code ...

loop: b loop  // infinite loop

.pool // this is where rgb(12, 31, 5) will actually be stored
```

Notice that the infinite loop prevents the pool data from being wrongly executed.

Register Names
--------------

ARM7TDMI has 37 registers, but less are visible depending on the processor operating mode.

Typically, ARM mode has access to 17 registers:

```
r0    r4    r8     r12/ip
r1    r5    r9     r13/sp
r2    r6    r10    r14/lr
r3    r7    r11    r15/pc
```

And the `cpsr` register via the PSR instructions (`mov rX, cpsr` and `mov cpsr, rX`).

The `pc` is the program counter, `lr` is the link register, `sp` is the stack pointer, and `ip` is
the intra-procedure register (which can be used for anything).

Thumb mode restricts the registers further, usually limiting them from `r0` to `r7`, with special
cases for `sp` and `pc`.  However, `add`, `mov`, `cmp`, and `bx` can access `r8` to `r15`.

### Renaming

Use the `.regs` statement to rename the first 12 registers:

```
.regs base, offset, temp0-temp3, posX, posY, r8-r11
```

There must be exactly 12 names specified, with support for ranged names.

Names are replaced, so in the above example, `r0` is no longer a valid name - register 0 can only be
accessed via the name `base`.

Names can be reset via:

```
.regs r0-r11
```

Or by leaving the current scope:

```
.regs r0-r11
.begin
  .regs temp0-temp11
  movs  temp2, #13
.end
cmp  r2, #13
// r2 contains the value 13
```

Current register names can be printed to the console via:

```
.regs
```

Dot Statements
--------------

### `.align <alignment>[, <fill>]`

Pads output with `<fill>` (default `0x00`) until the next address is aligned to `<alignment>` bytes.

For examples, `.align 4` will output `0x00` until the next byte is aligned to the word boundary.

Supports padding using a `nop` statement by setting `<fill>` to `nop`, ex: `.align 4, nop`.

### `.arm`

Switches the assembler into ARM mode (default).

Note that `.arm`/`.thumb` is scoped to the closest `.begin`/`.end` block:

```
.thumb
// Thumb mode
.begin
  .arm
  // ARM mode
.end
// back to Thumb mode, with auto alignment
```

See also: `.thumb`.

### `.base <base>`

Sets the base address of the following code.  For regular GBA games, this is `0x08000000` (default).

Note that `.base` is scoped to the closest `.begin`/`.end` block:

```
.printf "%#08X", _base   // 0x08000000
.begin
  .base 0x02000000
  .printf "%#08X", _base // 0x02000000
.end
.printf "%#08X", _base   // 0x08000000
```

### `.begin [<name>]` / `.end`

Creates a new scope for local labels and constants.

### `.crc`

Calculates and outputs the checksum byte, used in the GBA header.

### `.def <constant> = <expression>`

Defines a constant.

### `.embed <filename>`

Includes a binary file by outputting the bytes in `<filename>`.

### `.error <format>[, <args...>]`

Aborts the assembler with the error message provided.  Allows same formatting as `.printf`.

### `.if <condition>` / `.elseif <condition>` / `.else` / `.end`

Conditional compilation; only includes sections of code when `<condition>` is true.

### `.include <filename>`

Includes a text file by essentially copy/pasting it into the location.

### `.logo`

Outputs the Nintendo logo, used in the GBA header.

### `.pool`

Outputs a literal pool, for use with the `ldr rX, =constant` pseudo-instructions.

### `.printf <format>[, <args...>]`

Prints data to the console during compilation, using similar formatting as C's `printf`.

Formatting supported:

`%<flag><width><format>`

| Format     | Description                                    |
|------------|------------------------------------------------|
| `%b`       | Output binary number                           |
| `%d`, `%i` | Output signed decimal number                   |
| `%o`       | Output octal number                            |
| `%u`       | Output unsigned decimal number                 |
| `%x`, `%X` | Output hexadecimal number (lower or uppercase) |

| Flag     | Description                                                   |
|----------|---------------------------------------------------------------|
| `#`      | Add prefix to binary/octal/hex numbers, ex: `%#x` => `0x1234` |
| `-`, `+` | Always add `+` or `-` to number, ex: `%+d` => `+1234`         |
| `0`      | Fill width using leading zeroes, ex: `%08x` => `0000abcd`     |

If `width` is specified, then either leading spaces or leading zeroes will be added to enforce the
character width.  Ex: `%10d` => `      1234`.

### `.regs [<r0-r11>]`

Renames the first 12 registers.  Must specify names for all 12 registers.  See section above on
register renaming.

If no names are provided, then the current register names are printed to the console.

### `.script [<name>]` / `.end`

Embeds a script to execute at compile-time.

See the [scripting guide](./script.md), and the available [standard library](./lib.md).

### `.stdlib`

Includes the standard library, which defines useful constants like `REG_DISPCNT`, etc.

### `.str "<string>"`

Outputs UTF-8 string.

### `.struct <name> [= <base>]` / `.end`

Defines constants as offsets from zero, using `.s0`, `.s8`, `.s16`, and `.s32`.

### `.thumb`

Switches the assembler into Thumb mode.

Note that `.arm`/`.thumb` is scoped to the closest `.begin`/`.end` block:

```
.arm
// ARM mode
.begin
  .thumb
  // Thumb mode
.end
// back to ARM mode
```

See also, `.arm`.

### `.title "<title>"`

Outputs the ASCII title of the game, used in the GBA header.
