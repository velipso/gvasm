Assembler
=========

The assembler processes the file from top to bottom in a single pass.  As instructions are
encountered, they are encoded as binary, and added to the output.

Statements are processed line by line, and newlines signify the end of a statement.  Indentation and
spacing within a line doesn't matter.  The backslash character can be used to continue a statement
on the next line:

```
.printf "%i, %i, %i", \
  100,                \
  200,                \
  300
```

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
.printf "hello, world"   // output string to console
.i8 "one\ntwo\nthree\0"  // output string to file
```

Labels
------

Labels can start any line, and must be prefixed with either `@` for global labels, or `@@` for local
labels.  Local labels will be removed upon processing an `.end` that matches a `.begin`.

```
@main:     // global label
.begin
  @@main:  // local label
.end
// @@main is no longer accessible
```

Labels are effectively 32-bit numbers like everything else.  Their value is the next absolute
address in memory that they point to.  Note that `.base` will affect this value (defaults to
`0x08000000` for normal games).

Labels can be used before they're known in certain circumstances, like for branching instructions or
defined constants, but not for `.align`, `.base`, `.i8fill`, `.if`, or `.printf`.

Defined Constants
-----------------

Constant numbers and expressions can be given names using the `.def` statement.

Names must be prefixed with either `$` for global constants, or `$$` for local constants.  Local
constants will be removed upon processing an `.end` that matches a `.begin`.

```
.def $MaxHealth = 10   // global constant
.begin
  .def $$Velocity = 2  // local constant
.end
// $$Velocity is no longer accessible
```

Constants can also take parameters:

```
.def $lerp($a, $b, $t) = $a + ($b - $a) * $t / 100
.printf "%i", $lerp(10, 20, 80) // prints 18 to console
```

### Reserved Constants

Constants beginning with an underscore are reserved for the assembler.

The following constants are always defined and depend on the assembler state:

| Constant    | Description                                                                 |
|-------------|-----------------------------------------------------------------------------|
| `$_version` | Version of the assembler (1002003 is v1.2.3)                                |
| `$_arm`     | True if in ARM mode (`.arm`)                                                |
| `$_thumb`   | True if in THUMB mode (`.thumb`)                                            |
| `$_here`    | The next address to be output                                               |
| `$_pc`      | The PC value at this address (`$_here + 8` for ARM, `$_here + 4` for THUMB) |
| `$_base`    | The base value (set by `.base <base>`)                                      |

Constant Expressions
--------------------

Operators mostly copy from C.  Operators will return 1 for true, and 0 for false, though any
non-zero number is considered true.  Parenthesis can be used to override default precedence.

| Operator                  | Description                                            |
|---------------------------|--------------------------------------------------------|
| `-$a`                     | Negation                                               |
| `~$a`                     | Bit NOT                                                |
| `!$a`                     | Logical NOT                                            |
| `$a + $b`                 | Addition                                               |
| `$a - $b`                 | Subtraction                                            |
| `$a * $b`                 | Multiplication                                         |
| `$a / $b`                 | Division (integer)                                     |
| `$a % $b`                 | Modulo                                                 |
| `$a << $b`                | Shift left                                             |
| `$a >> $b`                | Sign-extended shift right                              |
| `$a >>> $b`               | Logical shift right                                    |
| `$a & $b`                 | Bit AND                                                |
| `$a ^ $b`                 | Bit XOR                                                |
| `$a < $b`                 | Test if less than                                      |
| `$a <= $b`                | Test if less than or equal                             |
| `$a > $b`                 | Test if greater than                                   |
| `$a >= $b`                | Test if greater than or equal                          |
| `$a == $b`                | Test if equal                                          |
| `$a != $b`                | Test if not equal                                      |
| `$a && $b`                | Logical AND (short circuited)                          |
| `$a \|\| $b`              | Logical OR (short circuited)                           |
| `abs($a)`                 | Absolute value                                         |
| `clamp($a, $low, $high)`  | Clamp `$a` between `$low` and `$high` (inclusive)      |
| `log2($a)`                | Log base 2                                             |
| `max($a, ...)`            | Maximum of all arguments                               |
| `min($a, ...)`            | Minimum of all arguments                               |
| `nrt($a, $b)`             | Nth root, returns `pow($a, 1 / $b)`                    |
| `pow($a, $b)`             | Power                                                  |
| `rgb($r, $g, $b)`         | Returns 15-bit value using each color component (0-31) |
| `sign($a)`                | Returns -1, 0, or 1 based on the sign of `$a`          |
| `sqrt($a)`                | Returns the square root of `$a`                        |

Structs
-------

The assembler supports `.struct` in order to define constants incrementally.  Use `.s8`, `.s16`, or
`.s32` inside a struct to reference a new member.

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

Pool Literals
-------------

The assembler supports the following syntax:

```
// ARM or THUMB:
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
@main:

ldrh r0, =rgb(12, 31, 5)
// ... more code ...

@loop: b @loop  // infinite loop

.pool // this is where rgb(12, 31, 5) will actually be stored
```

Notice that the infinite loop prevents the pool data from being wrongly executed.

Dot Statements
--------------

### `.align <alignment>[, <fill>]`

Pads output with `<fill>` (default `0x00`) until the next address is aligned to `<alignment>` bytes.

For examples, `.align 4` will output `0x00` until the next byte is aligned to the word boundary.

### `.arm`

Switches the assembler into ARM mode (default).  See also: `.thumb`.

### `.b8 <value, ...>`

Alias for `.i8`.

### `.b8fill <amount>[, <fill>]`

Alias for `.i8fill`.

### `.b16 <value, ...>`

Outputs big-endian 16-bit numbers.

Note that the value is truncated to 16-bits, so for example, `.b16 0xabcdef` will output
`0xcd 0xef`.

### `.b16fill <amount>[, <fill>]`

Outputs `<amount>` half-words of `<fill>` (default `0x0000`) in big-endian.

For example, `.b16fill 10` is equivalent to `.b16 0, 0, 0, 0, 0, 0, 0, 0, 0, 0`.

### `.b32 <value, ...>`

Outputs big-endian 32-bit numbers.

Note that all constant numbers in gvasm are 32-bit, so no truncation is performed.

### `.b32fill <amount>[, <fill>]`

Outputs `<amount>` words of `<fill>` (default `0x00000000`) in big-endian.

For example, `.b32fill 10` is equivalent to `.b32 0, 0, 0, 0, 0, 0, 0, 0, 0, 0`.

### `.base <base>`

Sets the base address of the ROM.  For regular GBA games, this is `0x08000000` (default).  Must be
the first statement.

### `.begin` / `.end`

Creates a new scope for local labels and constants.

### `.crc`

Calculates and outputs the checksum byte, used in the GBA header.

### `.def <constant> = <expression>`

Defines a constant.

### `.embed <filename>`

Includes a binary file by outputting the bytes in `<filename>`.

### `.error <message>`

Aborts the assembler with the error message provided.

### `.extlib` (WIP)

Includes the extended library, which is intended to include things like fonts and print routines.

This doesn't currently work and is under development.

### `.i8 <value, ...>`

Outputs raw bytes.

Note that the value is truncated to a byte, so for example, `.i8 0xabcd` will output `0xcd`.

### `.i8fill <amount>[, <fill>]`

Outputs `<amount>` bytes of `<fill>` (default `0x00`).

For example, `.i8fill 10` is equivalent to `.i8 0, 0, 0, 0, 0, 0, 0, 0, 0, 0`.

### `.i16 <value, ...>`

Outputs little-endian 16-bit numbers.

Note that the value is truncated to 16-bits, so for example, `.i16 0xabcdef` will output
`0xef 0xcd`.

### `.i16fill <amount>[, <fill>]`

Outputs `<amount>` half-words of `<fill>` (default `0x0000`) in little-endian.

For example, `.i16fill 10` is equivalent to `.i16 0, 0, 0, 0, 0, 0, 0, 0, 0, 0`.

### `.i32 <value, ...>`

Outputs little-endian 32-bit numbers.

Note that all constant numbers in gvasm are 32-bit, so no truncation is performed.

### `.i32fill <amount>[, <fill>]`

Outputs `<amount>` words of `<fill>` (default `0x00000000`) in little-endian.

For example, `.i32fill 10` is equivalent to `.i32 0, 0, 0, 0, 0, 0, 0, 0, 0, 0`.

### `.if <condition>` / `.elseif <condition>` / `.else` / `.end`

Conditional compilation; only includes sections of code when `<condition>` is true.

### `.include <filename>`

Includes a text file by essentially copy/pasting it into the location.

### `.logo`

Outputs the Nintendo logo, used in the GBA header.

### `.macro <name> [<params, ...>]` / `.endm` (WIP)

Macros (not implemented yet).

### `.pool`

Outputs a literal pool, for use with the `ldr rX, =constant` pseudo-instructions.

### `.printf <format>[, <args...>]`

Prints data to the console during compilation.

### `.stdlib`

Includes the standard library, which defines useful constants like `$REG_DISCNT`, etc.

### `.struct <prefix>` / `.end`

Defines constants as offsets from zero, using `.s8`, `.s16`, and `.s32`.

### `.title <title>`

Outputs the ASCII title of the game, used in the GBA header.

### `.thumb`

Switches the assembler into THUMB mode.  See also, `.arm`.
