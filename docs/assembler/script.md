Scripting Guide
===============

The scripting language inside gvasm is based almost entirely on [sink](https://sinklang.org), with
a few modifications.  This guide will introduce the scripting language.

See the [standard library](./lib.md) for documentation on the commands included in the language.

Examples
--------

```
// scripts must be wrapped with .script / .end
.script
  // this is a script!

  // outputs 'hello, world' to stdout
  say 'hello, world'

  // outputs an assembly instruction
  put '.i8 5, 6'
.end
// back to assembly
```

```
.script
  say 1 + 2   // 3
  say 1 ~ 2   // 12 (tilde is string concat)
  say 5^2     // 25 (caret is power)
  say 25^0.5  // 5

  // commands are defined via `def`
  def add a, b
    // string substitution on double-quoted strings using dollar sign
    say "adding $a + $b is ${a + b}"
    return a + b
  end

  say add 1, 2                  // 3
  say add (add 1, 2), add 4, 5  // 12

  // commands can be declared ahead of time
  declare factorial

  say factorial 10  // 3628800

  def factorial a
    if a <= 1
      return 1
    end
    return a * factorial a - 1
  end
.end
```

Whitespace
----------

The syntax is a mixture between a shell and a normal language.  Newlines matter, and they help
define the end of statements.  At any point a backslash `\` can be used to ignore a newline, and a
semicolon `;` can be used to separate statements on a single line.

```
1       // single statement, 1
+ 2     // single statement, + 2

1 \     // awaiting end of statement...
+ 2     // statement processed is 1 + 2

1; + 2  // two statements
```

Note that `+` and `-` have special sensitivity to whitespace in order to determine whether you mean
a unary operator or binary operator:

```
x-1     // subtract
x - 1   // subtract
x- 1    // subtract
x -1    // call `x` with a single argument, -1
```

Keywords and Symbols
--------------------

```
break       end          nil
continue    enum         return
declare     for          using
def         goto         var
do          if           while
else        include
elseif      namespace
```

```
+    +=    <     <=     (    )
-    -=    >     >=     [    ]
%    %=    !     !=     {    }
*    *=    =     ==     ,    :
/    /=    ||    ||=    |    .
^    ^=    &&    &&=    &    ...
~    ~=
```

Types
-----

The scripting language is dynamically typed (which means any variable can contain any type) and has
exactly four types:

| Type   | Description                    | Example(s)                            |
|--------|--------------------------------|---------------------------------------|
| Nil    | Nothingness, false             | `nil`                                 |
| Number | 64-bit floating point          | `5`, `0xFF`, `0b1011`, `6.28e+10`     |
| String | Binary-safe array of bytes     | `'hello'`, `"world"`                  |
| List   | Variable length list of values | `{}`, `{1, 2, 3}`, `{nil, 1, {'hi'}}` |

All values are considered true except `nil`.  That means `0` is true, `''` is true, `{}` is true,
etc.

Nil
---

The value `nil` is a special value that signifies nothingness.  It is the only value considered
false.

Missing arguments to commands default to `nil`, and accessing a list outside of its range returns
`nil`.  Many commands in the standard library return `nil` to indicate normal failure (for example,
`str.find` will return `nil` if the substring isn't found).

Since only `nil` is false, you can do things like this:

```
x = x || 5  // set x to 5 only if x is nil
x ||= 5     // or, more compactly
```

Checking if a value is `nil` is done via `x == nil` (or simply `!x`).

Number
------

Numbers are 64-bit floating point values.  They can be expressed in decimal, binary, octal, and
hexadecimal, including fractions:

```
x = 1
x = 123.456
x = 123.456e19
x = 123.456e-19
x = 0xAB
x = 0xAB.CD
x = 0xAB.CDp19
x = 0xAB.CDp-19
x = 0b1011
x = 0b1011.1101
x = 0b1011.1101p19
x = 0b1011.1101p-19
x = 0c777
x = 0c777.123
x = 0c777.123p19
x = 0c777.123p-19

say num.hex 255  // 0xFF
say num.bin 15   // 0b1111
say num.oct 511  // 0c777
```

Numbers can also be not-a-number, or infinity:

```
x = num.nan
x = num.inf
x = -num.inf

if num.isnan x
  say 'x is nan'
elseif num.isfinite x
  say 'x is finite'
end
```

Numbers can also be treated as 32-bit signed or unsigned integers in the standard library, depending
on the library call.  This is no problem because a 64-bit floating point number can store a 52-bit
integer losslessly.

Testing for a number is done via the `isnum` command:

```
if isnum x
  say 'x is a number'
else
  say 'x isn''t a number'
end
```

Strings
-------

Strings are binary-safe arrays of bytes, that can be any length, and include any value from 0 to
255.  Strings have no concept of unicode (though there are basic helper commands in the standard
library for dealing specifically with UTF-8 strings).

Strings can be specified with single quotes `'` or double quotes `"`.  Single quoted strings do not
perform any substitution and only have one escape sequence `''` (two single quotes) to indicate a
single quote character (i.e., `'it''s like this'`).

Double quoted strings perform substitution via `$`, and have the escape sequences:

| Escape   | Description                           |
|----------|---------------------------------------|
| `"\xFF"` | Any byte specified by two hex numbers |
| `"\0"`   | Byte 0                                |
| `"\b"`   | Bell (byte 8)                         |
| `"\t"`   | Tab (byte 9)                          |
| `"\n"`   | Newline (byte 10)                     |
| `"\v"`   | Vertical tab (byte 11)                |
| `"\f"`   | Form feed (byte 12)                   |
| `"\r"`   | Carriage return (byte 13)             |
| `"\e"`   | Escape (byte 27)                      |
| `"\\"`   | Backslash                             |
| `"\'"`   | Single quote                          |
| `"\""`   | Double quote                          |
| `"\$"`   | Dollar sign                           |

Subtitution is either a single identifier, or an expression:

```
say "a is $a"                // simple substitution
say "foo.bar is ${foo.bar}"  // expression subtitution
say "a + b is ${a + b}"      // expression subtitution
say "hi: ${str.lower "HI"}"  // nested strings are valid
```

The unary `&` operator returns the string length:

```
var x = 'hello'
say &x  // 5
```

Concatenation is via `~` (not `+`):

```
say "a" ~ 'b'  // ab
say 1 ~ 2      // 12
```

Converting a string to a number is via unary `+`, which returns `nil` if the conversion fails:

```
var x = '5'
say x + 5   // runtime error, cannot add string to number
say +x + 5  // 10
say +'foo'  // nil (conversion fails)
```

Strings are detected via the `isstr` command.

### String Slicing

Strings support slicing, in the format of `s[start:length]`:

```
var x = 'hello world'
say x[3:5]  // lo wo
```

Slicing can also be used for assignment:

```
x[2:2] = 'LL'
say x  // heLLo world
```

Lists
-----

Lists are the only compound data structure.  They are created with curly braces
`{ <contents> }`.  Elements are accessed using `ls[0]`, `ls[1]`, etc.  Negative indicies will wrap
around the end.  Indicies outside the range will return `nil`.

Most operations on numbers also work on lists, by performing the operation across all elements
(defaulting values to `0` if outside the range):

```
say {1, 2, 3} * 2          // {2, 4, 6}
say {1, 2, 3} + {4, 5, 6}  // {5, 7, 9}
say {1} + {2, 5}           // {3, 5}
say {1} * {2, 5}           // {2, 0}
say num.abs {-1, -2}       // {1, 2}
```

The unary `&` operator returns the list size:

```
var x = {1, 2, 3, 4}
say &x  // 4
```

Lists are modified using the commands:

| Command                   | Description                                            |
|---------------------------|--------------------------------------------------------|
| `list.push ls, 5`         | Push `5` at end of list                                |
| `list.unshift ls, 5`      | Unshift `5` at beginning of list                       |
| `list.pop ls`             | Pop the last element off the end of the list           |
| `list.shift ls`           | Shift the first element off the start of the list      |
| `list.append ls, {1, 2}`  | Append the second list on the end of the first list    |
| `list.prepend ls, {1, 2}` | Prepend the second list at the start of the first list |

Concatenation also works, but this *creates a new list*:

```
var x = {1}, y = {2}
say x ~ y  // {1, 2}
say x      // {1}
say y      // {2}
```

Lists are detected via the `islist` command.

### List Slicing

Lists support slicing, which creates a copy, in the format of `ls[start:length]`:

```
var x = {1, 2, 3, 4}
say x[1:2]  // {2, 3}
```

Slicing can also be used for assignment:

```
x[1:2] = {5, 6, 7}
say x  // {1, 5, 6, 7, 4}
```

An empty slice is the same as a shallow copy:

```
var x = {1, 2, 3}
var y = list.push x[:], 4
say x  // {1, 2, 3}
say y  // {1, 2, 3, 4}
```

### List Identity

Lists are the only values that have *identity*.  Nil, strings, and numbers do not have an identity.

```
var x, y

x = 'hello'
y = 'hello'
x == y  // true (1)

x = {}
y = {}
x == y  // false (nil)
```

List identity means that lists passed to commands can be mutated.

```
def test x
  x[0] = 5
end

var y = {3}
test y
say y  // {5}
```

Variables and Scope
-------------------

Variables are declared with the `var` keyword, and are lexically scoped:

```
var x = 1, y = 2

def test
  var y
  x = 10
  y = 20
end

test
say x, y  // 10 2
```

Commands have their own scope, with a set of variables created at time of execution:

```
def test1 base
  def test2
    test1 base + 10
  end

  if base < 5
    test2
  end

  say 'base:', base
end

test1 3
// output:
//  base: 13
//  base: 3
```

Any statement with a block creates a new scope.  The do-end statement doesn't do anything except
create a scope:

```
var x = 1
if x
  // new scope
  var x = 2
end
say x    // 1
do
  // new scope
  say x  // 1
  var x = 3
  say x  // 3
end
say x    // 1
```

Enumerators
-----------

Constant numbers can be defined using `enum`:

```
enum x, y, z
say x, y, z  // 0 1 2

enum zero, one, three = 3, four, five
say zero, one, three, four, five  // 0 1 3 4 5

enum some.constant.number = 100

say some.constant.number  // 100
```

If a value isn't initialized, it is the previous value plus one (starting at 0).

Destructuring Assignment
------------------------

Lists of variables can be used for assignment or variable creation.  This allows for parallel
assignment and can help with commands returning multiple values:

```
var {x, y} = {1, 2}
say x, y  // 1 2

{x, y} = {y, x}
say x, y  // 2 1

def test
  return {1, {3, 4}}
end

var {a, {b, c, d}, e} = test
say a, b, c, d, e  // 1 3 4 nil nil
```

Destructuring assignment also allows for variable length assignment using `...`:

```
var {first, second, ...rest} = {1, 2, 3, 4, 5}
say first   // 1
say second  // 2
say rest    // {3, 4, 5}
```

If-Elseif
---------

```
if <condition>
  do stuff
elseif <condition>
  more stuff
elseif <condition>
  yet more stuff
else
  lastly this
end
```

Note that only `nil` is considered false -- all other values are considered true.

Do-While
--------

The do-while loop can express three kinds of looping:

```
// normal while loop:
do while <condition>
  stuff
  continue  // jump to do
  break     // jump out of loop
end

// normal do loop:
do
  stuff
  continue  // jump to condition
  break     // jump out of loop
while <condition> end

// combined do-while loop:
do
  stuff
  continue  // jump to condition
  break     // jump out of loop
while <condition>
  stuff
  continue  // jump to do
  break     // jump out of loop
end
```

The combined do-while loop might look strange at first, but it's a natural extension and useful.

For
---

The for loop simply iterates over a list:

```
for var v: {'a', 'b', 'c'}
  say v
end
// output:
//  a
//  b
//  c
```

Another variable can be used for the index:

```
for var v, index: {'a', 'b', 'c'}
  say v, index
end
// output:
//  a 0
//  b 1
//  c 2
```

The `var` is optional -- if left out, the variables must be declared before the loop.

An empty for loop is an infinite loop:

```
for
  say 1
end
// output:
//  1
//  1
//  ...forever
```

Variables are optional and can be omitted if not needed:

```
for: range 10
  // do something 10 times
end
```

The `continue` and `break` statements operate as expected inside the for loops.

### Range

Use `range` to loop over a range of numbers:

```
for var i: range 3
  say i
end
// output:
//  0
//  1
//  2

for var i: range 3, 5
  say i
end
// output:
//  3
//  4

for var i: range 0, 9, 3
  say i
end
// output:
//  0
//  3
//  6
```

Special optimizations exist in the compiler so that using `range` in a for loop will skip creating
the actual list.

Goto
----

Labels are unique per command, and declared via `labelname:`.  The `goto labelname` statement will
cause execution to jump to the label.

```
goto skip
say 'won''t see this'
skip:
```

Commands
--------

Commands (aka functions) are created using `def`:

```
def add a, b
  say "adding $a + $b: ${a + b}"
  return a + b
end

say 'result:', add 1, 2

// output:
//  adding 1 + 2: 3
//  result: 3
```

### Default Arguments

Commands can have default values for arguments, which are expressions that get evaluated if the
passed in argument isn't specified (or `nil`):

```
def test a = 1, b = 2
  say a, b
end

test         // 1 2
test nil, 5  // 1 5
test 7       // 7 2

var x = 10
def test2 y = x
  say y
end

test2     // 10
test2 13  // 13
x = 20
test2     // 20
```

### Variable Arguments

Commands can accept variable arguments using `...` in the definition:

```
def printargs prefix, ...rest
  for var a: rest
    say prefix, a
  end
end

printargs 'test:', 5, 6, 7
// output:
//  test: 5
//  test: 6
//  test: 7
```

### Piping

Command results can be piped to each other, in order to simplify syntax:

```
def add a, b
  say "adding $a + $b: ${a + b}"
  return a + b
end

def mul a, b
  say "multiplying $a * $b: ${a * b}"
  return a * b
end

var res = add 1, 2 | mul 4
say res
// output:
//  adding 1 + 2: 3
//  multiplying 3 * 4: 12
//  12
```

The line:

```
var res = add 1, 2 | mul 4
```

is transformed to:

```
var res = mul (add 1, 2), 4
```

Piping one command's results into another command always inserts the result as the first parameter.
This means it's normally useful for commands to accept the object of interest as the first parameter
and return the object so it can be used for chaining.

```
var ls = {1, 2} | list.push 3 | list.unshift 0 | list.rev
// same as:
// var ls = list.rev (list.unshift (list.push ({1, 2}), 3), 0)
say ls  // {3, 2, 1, 0}
```

Namespaces
----------

Namespaces can be created freely:

```
namespace foo
  def test
    say 'inside test'
  end
end

foo.test  // inside test
```

Namespaces can be created and added to as needed without the `namespace` keyword:

```
// define command 'test' inside namespace 'foo'
def foo.test
  say 'inside test'
end

// declare variable 'c' inside namespace 'a.b'
var a.b.c = 10

// include everything in './file' in the namespace 'foo'
include foo './file'
```

### Using

The `using` keyword can be used to expand the search for identifiers across multiple namespaces:

```
using num
say round 1.3  // 1
```

However, the local namespace has priority over anything inside `using`:

```
using num
def round a
  return a + 10
end
say round 1.3  // 11.3
```

Include and Embed
-----------------

To include another file, simply use the `include` statement:

```
include './some/file'
```

Note: the included file should *not* have `.script` / `.end` wrappers.

To include a file in it's own namespace, you can do:

```
namespace foo
  include './file'
end
```

Or, more compactly:

```
include foo './file'
```

If you include a file more than once, any definitions will fail the second time, because it is seen
as trying to define something more than once.  Instead, it might be useful to use the syntax:

```
include + './file'
```

This will create a unique namespace for the contents of `'./file'`, accessed directly.  It is
effectively short for:

```
namespace unique_1234
  include './file'
end
using unique_1234
```

You can also include multiple files with a single `include` statement:

```
include
  './first',
  './second',
  third './third',
  + './fourth'
```

The `embed` expression can be used to include the contents of a file as a string literal.  This can
be useful for embedding data directly in the script at compile-time.

```
var img = embed './image.png'
```

This is equivalent to pasting the binary data as a string in the script.
