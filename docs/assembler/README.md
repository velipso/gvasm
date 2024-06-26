Assembler
=========

Basic Usage
-----------

Comments copy C, where `//` is used for end-of-line comments, and `/* */` is used for block
comments.

```
// comment

/*
block comment
*/
```

Instructions to the assembler begin with a period `.`:

```
.printf "hello, world"  // outputs: hello, world
.def x = 5
.printf "x is %d", x    // outputs: x is 5
```

Example program:

```
.begin
  .arm
  .regs r0-r3, x, y, r6-r11
  ldr   y, =50
nextY:
  ldr   x, =50
nextX:
  mov   r0, x
  mov   r1, y
  bl    plotXY
  add   x, #1
  cmp   x, #100
  blt   nextX
  add   y, #1
  cmp   y, #100
  blt   nextY

  // infinite loop
- b     -
  .pool
.end

.begin plotXY
  .arm
  .regs x, y, r2-r11
  // do something with x and y
  bx    lr
.end
```

Literals
--------

### Numbers

All numbers during assembly are interpreted as 32-bit signed integers.  There are no floating point
numbers outside of scripts.

Numbers can be represented in decimal, binary, octal, and hexadecimal, and optionally use `_` as a
seperator.

```
.printf "%i, %i, %i", 123, 1_000, -5     // decimal
.printf "%b, %b", 0b110011, 0b1111_0000  // binary
.printf "%o, %o", 0c777, 0c123_456       // octal
.printf "%x, %x", 0xabcdef12, 0x55_66    // hexadecimal
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
.printf "%i", lerp(10, 20, 80)  // prints 18 to console
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

Operators mostly copy from C.  Operators will return `1` for true, and `0` for false, though any
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
| `log2assert(a)`       | Asserts `a` is a power of 2, and returns log base 2    |
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

.i8 offset(-5)  // generates compile-time error
```

Raw Data
--------

Raw data can be written to the output:

```
.i8 5  // writes the byte 5 to the output
```

There are a variety of data commands based on the format of the data:

| Command  | Signed?  | Endian? | Aligned? | Bytes |
|----------|:--------:|:-------:|:--------:|:-----:|
| `.i8`    | Signed   | Little  | Aligned  | 1     |
| `.i16`   | Signed   | Little  | Aligned  | 2     |
| `.i32`   | Signed   | Little  | Aligned  | 4     |
| `.im8`   | Signed   | Little  | Optional | 1     |
| `.im16`  | Signed   | Little  | Optional | 2     |
| `.im32`  | Signed   | Little  | Optional | 4     |
| `.ib8`   | Signed   | Big     | Aligned  | 1     |
| `.ib16`  | Signed   | Big     | Aligned  | 2     |
| `.ib32`  | Signed   | Big     | Aligned  | 4     |
| `.ibm8`  | Signed   | Big     | Optional | 1     |
| `.ibm16` | Signed   | Big     | Optional | 2     |
| `.ibm32` | Signed   | Big     | Optional | 4     |
| `.u8`    | Unsigned | Little  | Aligned  | 1     |
| `.u16`   | Unsigned | Little  | Aligned  | 2     |
| `.u32`   | Unsigned | Little  | Aligned  | 4     |
| `.um8`   | Unsigned | Little  | Optional | 1     |
| `.um16`  | Unsigned | Little  | Optional | 2     |
| `.um32`  | Unsigned | Little  | Optional | 4     |
| `.ub8`   | Unsigned | Big     | Aligned  | 1     |
| `.ub16`  | Unsigned | Big     | Aligned  | 2     |
| `.ub32`  | Unsigned | Big     | Aligned  | 4     |
| `.ubm8`  | Unsigned | Big     | Optional | 1     |
| `.ubm16` | Unsigned | Big     | Optional | 2     |
| `.ubm32` | Unsigned | Big     | Optional | 4     |

For every command, there is also a fill version:

```
.i8fill 5      // same as: .i8 0, 0, 0, 0, 0
.u32fill 7, 3  // same as: .u32 3, 3, 3, 3, 3, 3, 3
```

Importing and Including
-----------------------

Use `.import` and `.include` to access code from other files.

The `.import` statement is used to access constants from other files:

```
// file1.gvasm
.import 'file2.gvasm' { foo, bar }
.printf "foo is %d", foo
.printf "bar is %d", bar

// file2.gvasm
.def foo = 1
.def bar = 2
```

You can also just import all constants:

```
// file1.gvasm
.import 'file2.gvasm' file2
.printf "file2.foo is %d", file2.foo
.printf "file2.bar is %d", file2.bar

// file2.gvasm
.def foo = 1
.def bar = 2
```

When a file is imported, the instructions are not included in the final output.  You need to
`.include` the file where you want the instructions:

```
// file1.gvasm
.import 'file2.gvasm' { performWork }
.begin main
  .arm
  mov   r0, #0
  mov   r1, #1
  bl    performWork
.end
.include 'file2.gvasm'

// file2.gvasm
.begin performWork
  .arm
  add   r0, r1
  bx    lr
.end
```

Notice that the `.import` will give the first file access to the `performWork` label, but the
location of that label isn't known until the `.include` is processed -- the code inside
`file2.gvasm` will be written to the output file after `main`.

Structs
-------

The assembler supports `.struct` in order to define constants incrementally.

Use data commands (`.i8`, `.u32`, etc) to specify the type of the field:

```
.struct Player
  .i8 health, stamina
  .i16 magic
.end
```

This is equivalent to defining:

```
.def Player.health = 0
.def Player.stamina = 1
.def Player.magic = 2
```

Note that members are _not_ automatically aligned.  Use `.align` to align fields:

```
.struct Player
  .i8 health
  .align 4  // adds a gap of 3 bytes
  .i32 worldX, worldY
.end
```

Structs can be nested inside structs, and labels are supported:

```
.struct Player
  .i8 health
  .align 2
  .struct inventory
    .i16 itemId
    .i8 amount
  .end
  .align 4
worldPosition:
  .i32 worldX, worldY
.end
```

Equivalent to:

```
.def Player.health = 0
.def Player.inventory.itemId = 2
.def Player.inventory.amount = 4
.def Player.worldPosition = 8
.def Player.worldX = 8
.def Player.worldY = 12
```

Start offsets are supported:

```
.struct Player = 0x03000000 // start at 0x03000000
  .i8 health, stamina
  .align 4
  .i32 worldX, worldY
.end
```

Equivalent to:

```
.def Player.health = 0x03000000
.def Player.stamina = 0x03000001
.def Player.worldX = 0x03000004
.def Player.worldY = 0x03000008
```

Arrays are also supported:

```
.struct Player
  .i16 itemIds[3]
.end
```

Equivalent to:

```
.def Player.itemIds = 0
.def Player.itemIds._length = 3  // 3 items in the array
.def Player.itemIds._bytes = 6   // 6 total bytes
```

Static Memory Allocation
------------------------

You can allocate memory for structs by specifying either `iwram` or `ewram`.  This is useful so
separate pieces of code can reserve memory without interfering with each other.

```
.struct Player = iwram
  .i32 x
  .i32 y
  .i32 health
  .i32 magic
.end

.struct Sprites = ewram
  .struct entry[128]
    .i16 x
    .i16 y
  .end
.end
```

The first time the assembler encounters `iwram`, it will return `0x03000000`.  Every time it
encounters it again, it will return the next available location in memory (aligned to 4 bytes).

```
.struct Player = iwram  // returns 0x03000000
  .i32 health
.end

.struct Level = iwram   // returns 0x03000004
  .i32 levelX
  .i32 levelY
  .i8 flags
.end

.struct World = iwram   // returns 0x03000010
  .i32 width
  .i32 height
.end
```

Using `ewram` is the same, except allocation starts at `0x02000000`.

Allocation happens in the order it's encountered.  Allocation does not happen during `.import`, only
for `.include`.

IWRAM will overflow at 32512 bytes (32K - 256 bytes reserved for BIOS), and EWRAM will overflow at
262144 bytes (256K).  For this reason, it's a good idea to reserve some space at the end of IWRAM
for the user stack.

```
//
// ... all your code ...
//

// lastly:
.struct endOfIWRAM = iwram
  .i32 reservedForStack[100]
.end
.printf "IWRAM usage: %d bytes", endOfIWRAM - 0x03000000

.struct endOfEWRAM = ewram
.end
.printf "EWRAM usage: %d bytes", endOfEWRAM - 0x02000000
```

This way, if you use too much IWRAM to push the stack off the end, the assembler will error.

Type-aware Memory Load/Stores
-----------------------------

Since struct members have known types (signed word, unsigned byte, etc), the assembler can
automatically pick the right `ldr` and `str` instructions based on the member type.

Use `ldrx` and `strx` to use the type information:

```
.struct Player
  .u32 id      // => ldr/str
  .u8  flags   // => ldrb/strb
  .i8  cursor  // => ldrsb/ldsb/strb
  .u16 health  // => ldrh/strh
  .i16 x       // => ldrsh/ldsh/strh
  .i16 y       // => ldrsh/ldsh/strh
.end

.arm
ldr  r1, =PlayerMemoryLocation
ldrx r0, [r1, #Player.health]
// the above instruction is automatically converted to:
//   ldrh r0, [r1, #Player.health]
// because Player.health is an unsigned halfword
```

The assembler supports the following syntax for type-aware loads/stores:

```
ldrx r0, [r1, #Player.health]      // =>  ldrh r0, [r1, #Player.health]
ldrx r0, [r1] (Player.health)      // =>  ldrh r0, [r1]
ldrx r0, [r1, r2] (Player.health)  // =>  ldrh r0, [r1, r2]
strx r0, [r1, #Player.health]      // =>  strh r0, [r1, #Player.health]
strx r0, [r1] (Player.health)      // =>  strh r0, [r1]
strx r0, [r1, r2] (Player.health)  // =>  strh r0, [r1, r2]
```

Note that some instructions are impossible in Thumb mode, depending on the conversion needed.  The
assembler will error in these instances.

This feature is useful for reducing bugs (ex: accidentally using `ldrh` when you should use `ldsh`),
and makes it easier to change structs over time without rewriting a bunch of `ldr`/`str`
instructions (ex: changing `.u8 health` to `.u16 health`).

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
.arm
main:
  ldrh r0, =rgb(12, 31, 5)
  // ... more code ...

loop:
  b loop  // infinite loop

  .pool   // this is where rgb(12, 31, 5) will actually be stored
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

Execution Order
---------------

The assembler can be thought of as running in four phases:

1. Run scripts, evaluate `.if`
2. Rewrite constants if possible
3. Output the binary
4. Rewrite any remaining constants

Importing a file means running the first two phases.  Scripts and `.if` conditionals are evaluated
immediately.  After that, constants are resolved if possible.

After all files have been imported, the binary is output.

Lastly, any remaining rewrites happen that require knowing final address locations.

For example:

```
// file1.gvasm
.import 'file2.gvasm' { fourth }
.base 0
.printf "phase 4 = %d", fourth
.include 'file2.gvasm'

// file2.gvasm
.def first = 1
.printf "phase 2 = %d", second
.printf "phase 1 = %d", first
.def second = 2
.def fourth = _here + 4
```

This program will perhaps surprisingly output:

```
phase 1 = 1
phase 2 = 2
phase 4 = 4
```

Phase 3 cannot be printed because it only generates data for output.

The `phase 1` log message happens first because `first` is known when the statement is first
encountered.

The `phase 2` log message happens next because when `file2.gvasm` is finished being imported, it
recognizes that `second` is now available.

The `phase 4` log message needs `fourth` -- which depends on `_here`.  Calculating `_here` requires
knowing the address, which requires knowing the base.  These values aren't known until phase 4.

### Watching for Changes

When using the `-w` option (`gvasm make -w game.gvasm`), gvasm will output the binary, but then
wait for changes to any file.

Once a change is detected, gvasm will rebuild the project.  However, it will only rebuild the parts
necessary.  This can save significant time during development.

This works by caching results from phase 1-2, and using these cached results for files that haven't
changed.

For example:

```
// file1.gvasm
.printf 'hello'
.include 'file2.gvasm'

// file2.gvasm
.printf 'world'
```

If you run `gvasm make -w file1.gvasm`, it will output `hello` followed by `world`.  But if you only
update `file2.gvasm`:

```
// file2.gvasm
.printf 'earth'
```

Then only `earth` will be printed -- `hello` won't be printed again because it ran in phase 1 of
`file1.gvasm`, which didn't change.

Assembler Instructions
----------------------

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

### `.assert <message>, <condition>`

Assert that `<condition>` is true (non-zero).

If false, the program will error with `Assertion failed: <message>`.

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

### `.import <filename> Name` or `.import <filename> { Name1, Name2, ... }`

Imports constants (definitions, labels, etc) from `<filename>`.

### `.include <filename>`

Includes the code from `<filename>` in the final output.

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

Defines a structure with typed members.

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
