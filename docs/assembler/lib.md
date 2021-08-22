Scripting Standard Library
==========================

| Section                             | Namespace  |
|-------------------------------------|------------|
| [Globals](#globals)                 | `*`        |
| [Number](#number)                   | `num.*`    |
| [Integer](#integer)                 | `int.*`    |
| [Random](#random)                   | `rand.*`   |
| [String](#string)                   | `str.*`    |
| [UTF-8](#utf-8)                     | `utf8.*`   |
| [Structured Data](#structured-data) | `struct.*` |
| [List](#list)                       | `list.*`   |
| [Pickle](#pickle)                   | `pickle.*` |

Globals
-------

| Function          | Description                                                             |
|-------------------|-------------------------------------------------------------------------|
| `put a, ...`      | Output arguments to the gvasm assembler                                 |
| `say a, ...`      | Output arguments to stdout                                              |
| `warn a, ...`     | Output arguments to stderr                                              |
| `ask a, ...`      | Prompt the user for input from stdin                                    |
| `exit a, ...`     | Output arguments to stdout and terminate execution in success           |
| `abort a, ...`    | Terminate execution in failure using arguments as the error message     |
| `isnum a`         | Returns true if `a` is a number; otherwise false                        |
| `isstr a`         | Returns true if `a` is a string; otherwise false                        |
| `islist a`        | Returns true if `a` is a list; otherwise false                          |
| `range [start,] stop[, step]` | Returns a list of numbers in the interval [`start`, `stop`) |
| `order a, b`      | Compare `a` with `b` according to the sorting precedence (-1, 0, 1)     |
| `pick cond, a, b` | If `cond` is true, return `a`, otherwise return `b` (short-circuited)   |
| `embed 'file'`    | At compile-time, load the contents of `'file'` as a string              |
| `stacktrace`      | Return a list of strings with stacktrace information                    |

Number
------

Number commands will operate on lists by performing the operation on each element, just like the
built-in unary and binary operators.

| Function            | Description                                                          |
|---------------------|----------------------------------------------------------------------|
| `num.abs a`         | Absolute value of `a`                                                |
| `num.sign a`        | Sign of `a` (-1, 0, or 1)                                            |
| `num.max a, b, ...` | Returns the maximum number from all arguments                        |
| `num.min a, b, ...` | Returns the minimum number from all arguments                        |
| `num.clamp a, b, c` | Clamp `a` to be between `b` and `c`                                  |
| `num.floor a`       | Round `a` down to the nearest integer                                |
| `num.ceil a`        | Round `a` up to the nearest integer                                  |
| `num.round a`       | Round `a` to the nearest integer, 0.5 and above rounds up            |
| `num.trunc a`       | Round `a` towards 0                                                  |
| `num.nan`           | Not-a-number value                                                   |
| `num.inf`           | Infinity value                                                       |
| `num.isnan a`       | Tests whether `a` is a NaN value                                     |
| `num.isfinite a`    | Tests whether `a` is a finite value (i.e., not NaN and not infinite) |
| `num.e`             | *e*  (2.718282...)                                                   |
| `num.pi`            | *pi* (3.141592...)                                                   |
| `num.tau`           | *tau* (2 * *pi* = 6.283185...)                                       |
| `num.sin a`         | Sine of `a` (radians)                                                |
| `num.cos a`         | Cosine of `a` (radians)                                              |
| `num.tan a`         | Tangent of `a` (radians)                                             |
| `num.asin a`        | Arc-sine of `a`, returns radians                                     |
| `num.acos a`        | Arc-cosine of `a`, returns radians                                   |
| `num.atan a`        | Arc-tangent of `a`, returns radians                                  |
| `num.atan2 a, b`    | Arc-tangent of `a / b`, returns radians                              |
| `num.log a`         | Natural log of `a`                                                   |
| `num.log2 a`        | Log base 2 of `a`                                                    |
| `num.log10 a`       | Log base 10 of `a`                                                   |
| `num.exp a`         | *e*<sup>`a`</sup>                                                    |
| `num.lerp a, b, t`  | Linear interpolation from `a` to `b`, by amount `t`                  |
| `num.hex a, b`      | Convert `a` to a sink hexadecimal string, 0-padded to `b` digits     |
| `num.oct a, b`      | Convert `a` to a sink octal string, 0-padded to `b` digits           |
| `num.bin a, b`      | Convert `a` to a sink binary string, 0-padded to `b` digits          |

Integer
-------

The scripting language only operates on 64-bit floating point numbers, but it's possible to simulate
operations on signed 32-bit integers using the `int` namespace, with appropriate two's-complement
wrapping.

Integer commands will operate on lists by performing the operation on each element, just like the
built-in unary and binary operators.

| Function            | Description                                                 |
|---------------------|-------------------------------------------------------------|
| `int.new a`         | Round `a` to an integer                                     |
| `int.not a`         | Bitwise NOT of `a`                                          |
| `int.and a, b, ...` | Bitwise AND between all arguments                           |
| `int.or a, b, ...`  | Bitwise OR between all arguments                            |
| `int.xor a, b, ...` | Bitwise XOR between all arguments                           |
| `int.shl a, b`      | Bit-shift left `a` by `b` bits                              |
| `int.shr a, b`      | Bit-shift right `a` by `b` bits (zero-fill shift)           |
| `int.sar a, b`      | Bit-shift right `a` by `b` bits (sign-extended shift)       |
| `int.add a, b`      | `a + b`                                                     |
| `int.sub a, b`      | `a - b`                                                     |
| `int.mul a, b`      | `a * b`                                                     |
| `int.div a, b`      | `a / b`                                                     |
| `int.mod a, b`      | `a % b`                                                     |
| `int.clz a`         | Count leading zeros                                         |
| `int.pop a`         | Count number of bits set (population count, Hamming weight) |
| `int.bswap a`       | Byte swap (`0x12345678` becomes `0x78563412`)               |

Random
------

The RNG is automatically seeded via `rand.seedauto`.

| Function          | Description                                                                 |
|-------------------|-----------------------------------------------------------------------------|
| `rand.seed a`     | Set the seed of the RNG to `a` (interpreted as a 32-bit unsigned integer)   |
| `rand.seedauto`   | Set the seed of the RNG to a random value                                   |
| `rand.int`        | Random 32-bit unsigned integer ranging [0, 2<sup>32</sup> - 1]              |
| `rand.num`        | Random number ranging [0, 1) (contains 52 bits of randomness)               |
| `rand.range [start,] stop[, step]` | Random element from `range` defined by `start`, `stop`, `step` |
| `rand.getstate`   | Returns a two item list, each a 32-bit unsigned integer                     |
| `rand.setstate a` | Restores a previous state (`a` should be a two item list of integers)       |
| `rand.pick ls`    | Pick a random item out of the list `ls`                                     |
| `rand.shuffle ls` | Shuffle the contents of list `ls` in place                                  |

String
------

Strings are 8-bit clean, and interpreted as binary data.

| Function              | Description                                                          |
|-----------------------|----------------------------------------------------------------------|
| `str.new a, ...`      | Convert arguments to a string (using space as a separator)           |
| `str.split a, b`      | Split `a` into an array of strings based on separator `b`            |
| `str.replace a, b, c` | Replace all occurrences of `b` in string `a` with `c`                |
| `str.begins a, b`     | True if string `a` begins with string `b`; false otherwise           |
| `str.ends a, b`       | True if string `a` ends with string `b`; false otherwise             |
| `str.pad a, b`        | Pads string `a` with space until it is length `b` (`-b` to pad left) |
| `str.find a, b, c`    | Find `b` in string `a` starting at `c`; returns nil if not found     |
| `str.rfind a, b, c`   | Find `b` in string `a` starting at `c` and searching in reverse      |
| `str.lower a`         | Convert `a` to lowercase                                             |
| `str.upper a`         | Convert `a` to uppercase                                             |
| `str.trim a`          | Trim surrounding whitespace from `a`                                 |
| `str.rev a`           | Reverse `a`                                                          |
| `str.rep a, b`        | Repeat string `a` `b` times                                          |
| `str.list a`          | Convert a string to a list of bytes                                  |
| `str.byte a, b`       | Unsigned byte from string `a` at index `b` (nil if out of range)     |
| `str.hash a, b`       | Hash string `a` with seed `b` (interpretted as 32-bit unsigned int)  |

### Uppercase, Lowercase, Trim

Due to the fact strings are interpreted as binary data, and not unicode strings, the `str.lower`,
`str.upper`, and `str.trim` commands are explicitly specified:

* `str.lower` will only convert bytes A-Z to a-z (values 65-90 to 97-122).
* `str.upper` will only convert bytes a-z to A-Z (values 97-122 to 65-90).
* `str.trim` will only remove surrounding whitespace defined as bytes 9 (tab), 10 (newline),
  11 (vertical tab), 12 (form feed), 13 (carriage return), and 32 (space).

UTF-8
-----

The `utf8` namespace operates on strings (bytes), and only provides some basic commands for
encoding and decoding.

Codepoints U+0000 to U+10FFFF are considered valid, with the sole exception of the surrogate
characters (U+D800 to U+DFFF).
[Overlong encodings](https://en.wikipedia.org/wiki/UTF-8#Overlong_encodings) are rejected as
invalid.

| Function       | Description                                                             |
|----------------|-------------------------------------------------------------------------|
| `utf8.valid a` | Checks whether `a` is valid UTF-8 (`a` is string or list of codepoints) |
| `utf8.list a`  | Converts string `a` (UTF-8 bytes) to a list of codepoints (integers)    |
| `utf8.str a`   | Converts a list of codepoints (integers) `a` to a string (UTF-8 bytes)  |

Structured Data
---------------

| Function             | Description                                                             |
|----------------------|-------------------------------------------------------------------------|
| `struct.size tpl`    | Calculate the length of string the template specifies (nil for invalid) |
| `struct.str ls, tpl` | Convert data in list `ls` to a string using `tpl` as the template       |
| `struct.list a, tpl` | Convert string `a` to a list of data using `tpl` as the template        |
| `struct.isLE`        | Returns true if system is little endian; false otherwise                |

### Structure Templates

Structure templates are lists of numbers, where each number is defined by symbols in the `struct`
namespace, and describe the type of data:

| Code          | Size | Signed?  | Endian | C Type     |
|---------------|------|----------|--------|------------|
| `struct.U8`   |    1 | Unsigned | N/A    | `uint8_t`  |
| `struct.U16`  |    2 | Unsigned | Native | `uint16_t` |
| `struct.UL16` |    2 | Unsigned | Little | `uint16_t` |
| `struct.UB16` |    2 | Unsigned | Big    | `uint16_t` |
| `struct.U32`  |    4 | Unsigned | Native | `uint32_t` |
| `struct.UL32` |    4 | Unsigned | Little | `uint32_t` |
| `struct.UB32` |    4 | Unsigned | Big    | `uint32_t` |
| `struct.S8`   |    1 | Signed   | N/A    | `int8_t`   |
| `struct.S16`  |    2 | Signed   | Native | `int16_t`  |
| `struct.SL16` |    2 | Signed   | Little | `int16_t`  |
| `struct.SB16` |    2 | Signed   | Big    | `int16_t`  |
| `struct.S32`  |    4 | Signed   | Native | `int32_t`  |
| `struct.SL32` |    4 | Signed   | Little | `int32_t`  |
| `struct.SB32` |    4 | Signed   | Big    | `int32_t`  |
| `struct.F32`  |    4 | N/A      | Native | `float`    |
| `struct.FL32` |    4 | N/A      | Little | `float`    |
| `struct.FB32` |    4 | N/A      | Big    | `float`    |
| `struct.F64`  |    8 | N/A      | Native | `double`   |
| `struct.FL64` |    8 | N/A      | Little | `double`   |
| `struct.FB64` |    8 | N/A      | Big    | `double`   |

```
struct.str {0x41, 0x42}, {struct.U8, struct.U8}  // => 'AB'
struct.list 'AAAB', {struct.UL32}                // => { 0x42414141 }
struct.list 'AAAB', {struct.UB32}                // => { 0x41414142 }
struct.size {struct.F32, struct.U8, struct.S16}  // => 7 (bytes)
struct.size {'hello'}                            // => nil; template is invalid
```

The data can be an array of structures, as long as the data length is a multiple of the template
size:

```
struct.str {0x41, 0x42, 0x43}, {struct.U8}         // => 'ABC'
struct.str {1, 2, 3, 4}, {struct.U8, struct.UL16}  // => "\x01\x02\x00\x03\x04\x00"
struct.list 'ABC', {struct.U8}                     // => { 0x41, 0x42, 0x43 }
struct.list 'ABCD', {struct.UL16}                  // => { 0x4241, 0x4443 }
struct.list 'ABCDEF', {struct.U8, struct.UL16}     // => { 0x41, 0x4342, 0x44, 0x4645 }
```

List
----

| Function               | Description                                                       |
|------------------------|-------------------------------------------------------------------|
| `list.new a, b`        | Create a new list of size `a`, with each element set to `b`       |
| `list.shift ls`        | Remove and return the value at the start of `ls`                  |
| `list.pop ls`          | Remove and return the value at the end of `ls`                    |
| `list.push ls, b`      | Push `b` at end of list `ls` (returns `ls`)                       |
| `list.unshift ls, b`   | Unshift `b` at the start of list `ls` (returns `ls`)              |
| `list.append ls, ls2`  | Append `ls2` at the end of list `ls` (returns `ls`)               |
| `list.prepend ls, ls2` | Prepend `ls2` at the start of list `ls` (returns `ls`)            |
| `list.find ls, a, b`   | Find `a` in list `ls` starting at `b`; returns nil if not found   |
| `list.rfind ls, a, b`  | Find `a` in list `ls` starting at `b` and searching in reverse    |
| `list.join ls, a`      | Convert list `ls` to a string by joining elements with string `a` |
| `list.rev ls`          | Reverse list `ls` (returns `ls`)                                  |
| `list.str ls`          | Convert a list of bytes to a string                               |
| `list.sort ls`         | Sorts the list `ls` in place using `order` (returns `ls`)         |
| `list.rsort ls`        | Reverse sorts the list `ls` in place using `order` (returns `ls`) |

Pickle
------

The `pickle` namespace implements serialization and deserialization commands for program values.

There are two serialization formats: JSON and binary.

The JSON format is possible by mapping lists to arrays and `nil` to `null`, but cannot handle
referencing lists and is slightly inefficient.

The binary format is compact, fast, and restores list references -- therefore it can safely
serialize *any* value, and is the recommended format for serialization.

Note: `pickle.valid` does not validate all possible JSON, just the subset that can be correctly
deserialized to a sink value.

| Function            | Description                                                             |
|---------------------|-------------------------------------------------------------------------|
| `pickle.json a`     | Converts a *non-circular* sink value `a` to a serialized string in JSON |
| `pickle.bin a`      | Converts *any* sink value `a` to a binary serialized string             |
| `pickle.val a`      | Converts a serialized value `a` (JSON or binary) back to a sink value   |
| `pickle.valid a`    | Returns `nil` if `a` is invalid, `1` if JSON format, and `2` if binary  |
| `pickle.sibling a`  | True if `a` has sibling references                                      |
| `pickle.circular a` | True if `a` has circular references                                     |
| `pickle.copy a`     | Performs a deep copy of `a` (i.e., binary pickles then unpickles)       |

```
pickle.json {1, nil}     // => '[1,null]'
pickle.val '[[-1],5]'    // => {{-1}, 5}
pickle.valid '{}'        // => nil, not all of JSON can be converted to sink
pickle.valid '"\u1000"'  // => nil, only bytes in strings are supported ("\u0000" to "\u00FF")
pickle.valid 'null'      // => 1, JSON formatted serialized sink value (`null` maps to `nil`)
```
