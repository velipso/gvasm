//
// gvasm - Assembler and disassembler for Game Boy Advance homebrew
// by Sean Connelly (@velipso), https://sean.cm
// Project Home: https://github.com/velipso/gvasm
// SPDX-License-Identifier: 0BSD
//

import { ITest } from '../itest.ts';

export function load(def: (test: ITest) => void) {
  def({
    name: 'sink.0.sanity',
    kind: 'sink',
    stdout: `123
82938
7023512703
hello, world
hello, world
x: 123, y: 423, z: hello
add 5000, 1234
6234
pass
pass
pass
goto1
goto3
0: 1
1: 2
2: 3
3: 4
4: 5
5: 6
1
3
2
1
0
5
4
3
2
1
0
x is num
x is nil
hello world
5
4
add 2, 3
add 3, 4
{5, 2, {3, 4, 6}, nil, nil, 7}
true
false
false
true
pass
false
true
pass
true
add 1, 2
3
false
add 4, 5
9
1
2
5
{2, 3}
{1, 2, 3, 4}
{1, 6, 7, 8, 9, 4}
{1, 2, 3}
{1, 4, 3}
add 3, 4
x[0] =  1 x[1] =  7
0 a
1 b
2 c
3628800
97
add -10, -5
-15
nil
18
3
3
5
0.1
-0.1
3
3 4
{1, 'two\\three''four', 5}
`,
    files: {
      '/root/main.sink': `#
# comment
#

//
// another comment
//

declare add

say 123
say 70235 + 12703
say 70235 ~ 12703
say "hello, world"
say "hello, " ~ "world"

var x = 1, y = 2, z = "hello"
x = 123
y = x + \\
  300
say "x: \$x, y: \$y, z: \$z"

say add 5000, 1234

def add a, b
  say "add \$a, \$b"
  return a + \\ # comment
    b
end

x = 1

if x < 0
  say 'fail'
elseif x < 1
  say 'fail'
else
  say 'pass'
end

if x > 0
  say 'pass'
elseif x > 0
  say 'fail'
elseif x > 1
  say 'fail'
else
  say 'fail'
end

if x < 0
  say 'fail'
elseif x == 1
  say \\ // comment
    'pass'
else
  say 'fail'
end

say 'goto1'
goto test
say 'goto2'
test:
say 'goto3'

x = {1, 2, 3, 4}

list.push x, 5

for var e, i: x ~ {6, 7}
  say "\$i: \$e"
  if e == 6
    break
  end
end

say x[0]

x = 3
for
  say x
  if x == 0
    break
  end
  x -= 1
end

x = 5
do
  say x
while x > 0
  x -= 1
end

if isnum x
  say 'x is num'
end

x = nil
if x == nil
  say 'x is nil'
end

say 'hello', 'world'

def get_x
  return x
end

x = {1, 2, {3, 4}}
x[0] = 5
say x[0]
list.push (get_x)[2], 6
say x[2][1]
x[add 2, 3] = add 3, 4

say x

def false
  say 'false'
  return nil
end

def true
  say 'true'
  return 1
end

if (true) && (false)
  say 'fail'
end

if (false) && (true)
  say 'fail'
end

if (true) || (false)
  say 'pass'
end

if (false) || (true)
  say 'pass'
end

say pick (true ), (add 1, 2), (add 2, 3)
say pick (false), (add 3, 4), (add 4, 5)

say 1
do
  say 2
  goto test2
  say 3
end
say 4
test2:
say 5

x = {1, 2, 3, 4}
say x[1:2]  # {2, 3}
say x       # {1, 2, 3, 4}
x[1:2] = {6, 7, 8, 9}
say x       # {1, 6, 7, 8, 9, 4}

x = {1, 2, 3}
y = x[:]
y[1] = 4
say x   # {1, 2, 3}
say y   # {1, 4, 3}

x = {1, nil, 2}
x[0] ||= add 1, 2
x[1] ||= add 3, 4
say "x[0] = ", x[0], "x[1] = ", x[1]

var a = {'a', 'b', 'c'}
for var s, i: a
  say i, s
end

def fac a
  if a <= 0
    return 1
  end
  return a * fac a - 1
end
say fac 10 # 3628800


def one a, b, c
  def two a, b, d
    def three a, b, e
      return a + b + c + d + e
    end
    return three b, c, 3
  end
  return two b, c, 4
end
say one 10, 20, 30  # 97

say add -10, -5

var d
say d

do
  var x = 1, y = 2

  def foo a
    if a < 3
      return foo a + 1
    end
    def bar b
      if y < 3
        y += 1
        return foo y * 2
      end
      return a + b + y
    end
    return bar a + 3
  end

  say foo x # 18
  say y
end

do
  var a = {1, 2, 3}
  say &a
  a = 'hello'
  say &a
end

say 10^-1
say -10^-1

1, 2, 3 | say
1, 2, 3 | say 4

say {1, 'two\\three''four', 5}
`,
    },
  });

  def({
    name: 'sink.1.namespaces',
    kind: 'sink',
    stdout: `adding 4 5
9
inside obj.test
inside obj.test
q
`,
    files: {
      '/root/main.sink': `
def add x
  say 'bad'
end

namespace foo
  def add a, b
    say "adding \$a \$b"
    return a + b
  end
end

say (foo.add 4, 5)

def obj.test
  say 'inside obj.test'
end

namespace obj2
  using obj
  test
end

namespace obj3
  using obj
end

obj3.test

# allow using before namespace exists
using qux
def qux.test
  say 'q'
end
test
`,
    },
  });

  def({
    name: 'sink.2.say-as-cmd',
    kind: 'sink',
    stdout: `
say returns "nil"
`,
    files: {
      '/root/main.sink': `say 'say returns "' ~ say ~ '"'
`,
    },
  });

  def({
    name: 'sink.3.math',
    kind: 'sink',
    stdout: `1
{-2, -3}
1000 0
125
{1250, 2500, 3750}
8
1
`,
    files: {
      '/root/main.sink': `def r1000 a
  return num.round a * 1000
end

say num.floor 1.5
say num.floor { -1.5, -2.5 }
say (r1000 num.sin (num.tau) * 0.25), (r1000 num.cos (num.tau) * 0.25)
say r1000 (num.atan2 1, 1) / (num.tau)
say r1000 num.lerp {1, 2, 3}, {2, 3, 4}, {0.25, 0.5, 0.75}
say num.max {6, 2, 4, 8, 1, 3}
say num.min {6, 2, 4, 8, 1, 3}
`,
    },
  });

  def({
    name: 'sink.4.list-ops',
    kind: 'sink',
    stdout: `~= {1, 2, 3, 4, 5, 6, 7}
b: {1, 2, 3, 4, 5, 6}
b: {-1, 0, 1, 2, 3, 4, 5, 6, 8, 9}
push {1, 2, 3, 4}
{300, 300, 300, 300, 300}
6
nil
b: {9, 8, 6, 5, 4, 3, 2, 1, 0, -1}
9_8_6_5_4_3_2_1_0_-1
ab
`,
    files: {
      '/root/main.sink': `
var a = {1, 2, 3, 4, 5}

list.push a, 6

var b = a

say "~=", (a ~= {7})

say "b: \$b"

var c = b

list.append c, {8, 9}

list.prepend c, {-1, 0}

say "b: \$b"

say "push", list.push {1, 2, 3}, 4

say list.new 5, 300

say list.find b, 5
say list.find b, 100
list.rev b
say "b: \$b"

say list.join b, '_'
say list.join {'a', 'b'}
`,
    },
  });

  def({
    name: 'sink.5.multi-push',
    kind: 'sink',
    stdout: `{1, 2, 3}
`,
    files: {
      '/root/main.sink': `var a = {1}
a | list.push 2 | list.push 3
say a
`,
    },
  });

  def({
    name: 'sink.6.lvalues',
    kind: 'sink',
    stdout: `15
35 35
1 2
4 6
5 6 {5, 6}
{6, 2}
{11, 2}
{5, 6, 7, 1, {11, 2}, 2}
{{11, 10, 9}, 2}
{1}
{9, 9} {1, 9, 9, 4}
{1, 10, 10, 4}
1 10
{1, 2, 7, 3, 4}
{1, 2, 7, 3, 4}
{1, nil, 7, nil, 4}
{1, nil, 7, nil, 4}
1
2
`,
    files: {
      '/root/main.sink': `
var x, y, z

y = 5
y += 10
say y # 15

x = y += 20
say x, y # 35 35

{x, y} = {1, 2}
say x, y # 1 2

{x, y} += {3, 4}
say x, y # 4 6

z = {x, y} = {5, 6}
say x, y, z # 5 6 {5, 6}

x = {1, 2}
x[0] += 5
say x # {6, 2}

y = {1, x, 2}
y[1][0] += 5
say x # {11, 2}

y[0:0] = {5, 6, 7}
say y # {5, 6, 7, 1, {11, 2}, 2}

y[4][1:1] = {10, 9}
y[0:4] = nil
say y # {{11, 10, 9}, 2}

y[:] = {1}
say y # {1}

y = {1, 2, 3, 4}
x = y[1:2] = {9, 9}
say x, y # {9, 9} {1, 9, 9, 4}

y[1:2] += {1, 1}
say y # {1, 10, 10, 4}

z = {1, 2}
x = nil
y = 10
{x, y} ||= z
say x, y # 1 10

x = {1, 2, nil, 3, 4}
{x[1:3]} ||= {{6, 7, 8}}
say x # {1, 2, 7, 3, 4}

x = {1, 2, nil, 3, 4}
x[1:3] ||= {6, 7, 8}
say x # {1, 2, 7, 3, 4}

x = {1, nil, 3, nil, 4}
x[1:3] &&= {6, 7, 8}
say x # {1, nil, 7, nil, 4}

x = {1, nil, 3, nil, 4}
{x[1:3]} &&= {{6, 7, 8}}
say x # {1, nil, 7, nil, 4}

x &&= 1
say x # 1

x = nil
x ||= 2
say x # 2

def add a, b
  say "add \$a, \$b"
  return a + b
end

x = 1
x ||= add 1, 2 # shouldn't output anything

x = nil
x &&= add 3, 4 # shouldn't output anything

x = {1, 2, 3, 4}
x[:] ||= {add 5, 6} # shouldn't output anything

x = {nil, nil, nil}
x[:] &&= {add 7, 8} # shouldn't output anything

x = nil
{{x}} &&= {{add 9, 10}} # shouldn't output anything

x = 1
y = 2
{x, {y, x}} ||= {add 11, 12} # shouldn't output anything

`,
    },
  });

  def({
    name: 'sink.7.varargs',
    kind: 'sink',
    stdout: `1 2 {3, 4, 5}
4 nil {}
1 2 {3, 4}
1 nil {}
1 2 {3, 4, 5}
1 nil {} 2 {3}
1 2 {3, 4, 5} 6 {}
`,
    files: {
      '/root/main.sink': `
def test1 a, b, ...c
  say a, b, c
end

test1 1, 2, 3, 4, 5 # 1 2 {3, 4, 5}

test1 4 # 4 nil {}

test1 1, 2, 3, 4 # 1 2 {3, 4}

def test2 {a, b, ...c} = {1, 2, 3, 4, 5}
  say a, b, c
end

test2 {1} # 1 nil {}

test2 # 1 2 {3, 4, 5}

def test3 {a, b, ...c} = {1, 2, 3, 4, 5}, d = 6, ...e
  say a, b, c, d, e
end

test3 {1}, 2, 3 # 1 nil {} 2 {3}

test3 # 1 2 {3, 4, 5} 6 {}
`,
    },
  });

  def({
    name: 'sink.8.open-eof',
    kind: 'sink',

    files: {
      '/root/main.sink': `
say 1

do
`,
    },
  });

  def({
    name: 'sink.9.rand',
    kind: 'sink',
    stdout: `0xFB4153C8
0x5D9A39CC
0x42312A62
0x57EE40B0
{4, 1, 5, 7, 6, 2, 3}
6
{157905783, 18}
502
0x4DC332DB
`,
    files: {
      '/root/main.sink': `
rand.seed 988

say num.hex rand.int, 8
say num.hex rand.int, 8
say num.hex rand.int, 8
say num.hex rand.int, 8

var x = {1, 2, 3, 4, 5, 6, 7}

rand.shuffle x
say x

say rand.pick x

x = rand.getstate
say x

var i = 0
var t = 0
do while i < 1000
  t += rand.num
  i += 1
end
say num.floor t

rand.setstate x
say num.hex rand.int, 8
`,
    },
  });

  def({
    name: 'sink.10.lex-memleak',
    kind: 'sink',
    stdout: `1
2
3
4
`,
    files: {
      '/root/main.sink': `
def foo n
  say n
  def bar n2
    say n2
    if n2 == 4
      exit
    end
    foo n2 + 1
  end
  bar n + 1
end

foo 1
`,
    },
  });

  def({
    name: 'sink.12.setat',
    kind: 'sink',
    stdout: `{0} 1
{0, 1} 2
{0, 1, nil, nil, 4} 5
{0, 1, nil, 3, 8} 5
`,
    files: {
      '/root/main.sink': `
var x = {}
x[0] = 0
say x, &x
x[1] = 1
say x, &x
x[4] = 4
say x, &x
x[-2] = 3
x[-1] = 8
say x, &x
`,
    },
  });

  def({
    name: 'sink.13.alias',
    kind: 'sink',
    stdout: `{123}
123
{456}
`,
    files: {
      '/root/main.sink': `var x = {}
def getx
  return x
end

list.push getx, 123
say x
say getx[0]
getx[0] = 456
say x
`,
    },
  });

  def({
    name: 'sink.14.loop',
    kind: 'sink',
    stdout: `0
1
2
3
4
done
`,
    files: {
      '/root/main.sink': `
var i = 0
for
  say i
  i += 1
  if i > 4
    break
  end
end
say 'done'
`,
    },
  });

  def({
    name: 'sink.15.include',
    kind: 'sink',
    stdout: `start
inside test1.sink
test1: 1
inside test2/index.sink
test2: 2
inside test3.sink
test3: 3
inside test1.sink
test1: 4
inside test2/index.sink
test2: 5
inside test3.sink
test3: 6
end
`,
    files: {
      '/root/main.sink': `
say 'start'

include './test1.sink'

test1 1

include './test2/index.sink'

test2 2

include './test3.sink'

test3 3

include T1 './test1.sink'

T1.test1 4

include T2 './test2/index.sink'

T2.test2 5

include T3 './test3.sink'

T3.test3 6

say 'end'
`,
      '/root/test1.sink': `
say 'inside test1.sink'

def test1 a
  say "test1: \$a"
end
`,
      '/root/test2/index.sink': `
say 'inside test2/index.sink'

def test2 a
  say "test2: \$a"
end
`,
      '/root/test3.sink': `
say 'inside test3.sink'

def test3 a
  say "test3: \$a"
end
`,
    },
  });

  def({
    name: 'sink.16.def-fail',
    kind: 'sink',

    files: {
      '/root/main.sink': `
namespace baz
  var x
  def qux
  end
end

namespace bar
  def foo
  end

  def foo
  end
end
`,
    },
  });

  def({
    name: 'sink.17.str-interp',
    kind: 'sink',
    stdout: `x: 5
y: {5, 6, 7}
y[1] + y[2]: 13
{1}[0]: 1
{"hi \${{1}[0]}"}[0]: hi 1
`,
    files: {
      '/root/main.sink': `
var x = 5, y = {5, 6, 7}
say "x: \$x"
say "y: \$y"
say "y[1] + y[2]: \${y[1] + y[2]}"
say "{1}[0]: \${{1}[0]}"
say "{\\"hi \\\${{1}[0]}\\"}[0]: \${{"hi \${{1}[0]}"}[0]}"
`,
    },
  });

  def({
    name: 'sink.18.open-eof-inc',
    kind: 'sink',

    files: {
      '/root/main.sink': `
include 'test.sink'

test {
`,
      '/root/test.sink': `
def test
  say 'inside test'
end
`,
    },
  });

  def({
    name: 'sink.19.early-return',
    kind: 'sink',
    stdout: `1
`,
    files: {
      '/root/main.sink': `say 1
return
say 2
`,
    },
  });

  def({
    name: 'sink.20.vararg-return',
    kind: 'sink',
    stdout: `2
`,
    files: {
      '/root/main.sink': `
def test ...c
  return c[1]
end

say test 1, 2, 3
`,
    },
  });

  def({
    name: 'sink.21.expr-keyend',
    kind: 'sink',
    stdout: `0
1
2
hi
`,
    files: {
      '/root/main.sink': `
var i = 0
do
  say i
  i += 1
while i < 3 end

def test msg
  say msg
  return {1, 2}
end

for var v: test 'hi' end

if i < 1 end
if i < 1 else end
if i < 1 elseif i < 2 else end
if i < 1 elseif i < 2 elseif i < 3 end
`,
    },
  });

  def({
    name: 'sink.22.splicing',
    kind: 'sink',
    stdout: `aGHIJdef
GH
{1, 22, 33, 4, 5}
{22, 33}
{1, 'aGHIJdef', 2}
GH
{1, 2, 3}
{4, 6, 8, 7, 8, 9}
{6, 8}
{1}
{1}
{1}
{2}
{1}
{1}
{2}
{3}
{1}
{2, 6, 3, 4}
{6, 3}
{1, {2, 6, 3, 4}, 5}
{6, 3}
heo
{'heo'}
{1, {1, 7, 9, 4}, 2}
{1, 'heLLo', 2}
5
{'LL'}
heLLo
`,
    files: {
      '/root/main.sink': `
var x, y, z

x = 'abcdef'
y = x[1:2] = 'GHIJ'
say x # aGHIJdef
say y # GH

x = {1, 2, 3, 4, 5}
y = x[1:2] += {20, 30, 40}
say x # {1, 22, 33, 4, 5}
say y # {22, 33}

x = {1, 'abcdef', 2}
y = x[1][1:2] = 'GHIJ'
say x # {1, 'aGHIJdef', 2}
say y # GH

x = {1, 2, 3}
y = {4, 5, 6, 7, 8, 9}
z = y[1:2] += x
say x # {1, 2, 3}
say y # {4, 6, 8, 7, 8, 9}
say z # {6, 8}

x = {1}
y = {2}
z = y[0:1] = x
say x # {1}
say y # {1}
say z # {1}
x[0] = 2
say x # {2}
say y # {1}
say z # {1}
y[0] = 3
say x # {2}
say y # {3}
say z # {1}

x = {2, nil, 3, 4}
y = x[1:2] ||= {6, 7}
say x # {2, 6, 3, 4}
say y # {6, 3}

x = {1, {2, nil, 3, 4}, 5}
y = x[1][1:2] ||= {6, 7}
say x # {1, {2, 6, 3, 4}, 5}
say y # {6, 3}

x = 'hello'
x[2:2] = nil
say x
x = {'hello'}
x[0][2:2] = nil
say x

x = {1, {1, 2, 3, 4}, 2}
x[1][1:2] += {5, 6, 7}
say x # {1, {1, 7, 9, 4}, 2}

x = {1, 'hello', 2}
{x[1][2:2], y} = {'LL', 5}
say x # {1, 'heLLo', 2}
say y # 5

x = 'hello'
say ({x[2:2]} = {'LL'}) # {'LL'}
say x # heLLo
`,
    },
  });

  def({
    name: 'sink.23.str-escape',
    kind: 'sink',
    stdout: `how's it going
`,
    files: {
      '/root/main.sink': `
var x = 'how''s it going'
say x

`,
    },
  });

  def({
    name: 'sink.24.large-slices',
    kind: 'sink',
    stdout: `lists
5
1
nil
5
nil
{1, 2, 3, 4, 5}
{1, 2, 3, 4, 5}
{5}
{1, 2, 3, 4, 5}
{1, 2, 3, 4, 5}
{5}
{}
{}
{1}
{1, 2, 3, 4, 5}
{1, 2, 3, 4, 5}
{5}
{1, 2, 3, 4, 5}
{1, 2, 3, 4, 5}
{4}
{}
{5}
{5}
{3}
{}
{4}
{4, 5}
{1}
{1}
{1, 2, 3, 4, 5}
{1}
{}
{1, 2, 3, 4, 5}
{1, 2, 3, 4, 5}
{1, 2, 3}
{1, 2, 3, 4, 5}
{1, 2, 3, 4, 5}
{1, 2, 3, 4}
{1, 2, 3, 4, 5}
{4, 5}
{4}
{4, 5}
{1}
{1}
{2, 3}
{1, 2, 3}
{1, 2, 3}
{5}
{4, 5}
{}
{5}
{4, 5}
{1, 2, 3, 4, 5}
{}
{5}
strings
5
1
nil
5
nil
12345
12345
5
12345
12345
5


1
12345
12345
5
12345
12345
4

5
5
3

4
45
1
1
12345
1

12345
12345
123
12345
12345
1234
12345
45
4
45
1
1
23
123
123
5
45

5
45
12345

5
`,
    files: {
      '/root/main.sink': `
declare test

# test for both lists and strings
say 'lists'
test {1, 2, 3, 4, 5}
say 'strings'
test '12345'

def test x
  # indexing model:
  #
  #   ---+---+---+---+---+---+---+---+---+---+---+---
  #  nil | 1 | 2 | 3 | 4 | 5 | 1 | 2 | 3 | 4 | 5 | nil
  #   ---+---+---+---+---+---+---+---+---+---+---+---
  #   -6  -5  -4  -3  -2  -1   0   1   2   3   4   5

  say x[-1] # 5
  say x[-5] # 1
  say x[-6] # nil
  say x[4]  # 5
  say x[5]  # nil

  # slicing model:
  #
  #   ---+---+---+---+---+---+ +---+---+---+---+---+---
  #  nil | 1 | 2 | 3 | 4 | 5 | | 1 | 2 | 3 | 4 | 5 | nil
  #   ---+---+---+---+---+---+ +---+---+---+---+---+---
  # -6  -5  -4  -3  -2  -1    0    1   2   3   4   5

  say x[:]   # 12345
  say x[0:]  # 12345
  say x[-1:] # 5
  say x[-5:] # 12345
  say x[-6:] # 12345
  say x[4:]  # 5
  say x[5:]  # empty
  say x[6:]  # empty

  say x[:1]  # 1
  say x[:5]  # 12345
  say x[:6]  # 12345
  say x[:-1] # 5
  say x[:-5] # 12345
  say x[:-6] # 12345

  say x[-1:-1] # 4
  say x[-1:0]  # empty
  say x[-1:1]  # 5
  say x[-1:6]  # 5
  say x[-2:-1] # 3
  say x[-2:0]  # empty
  say x[-2:1]  # 4
  say x[-2:6]  # 45
  say x[-4:-1] # 1
  say x[-4:-3] # 1
  say x[:-100] # 12345

  say x[-6:2]  # 1
  say x[-6:-1] # empty
  say x[-7:7]  # 12345
  say x[-7:10] # 12345
  say x[-7:5]  # 123

  say x[0:100] # 12345
  say x[0:5]   # 12345
  say x[0:4]   # 1234
  say x[0:6]   # 12345
  say x[3:2]   # 45
  say x[3:1]   # 4
  say x[3:3]   # 45
  say x[1:-10] # 1
  say x[1:-1]  # 1
  say x[3:-2]  # 23
  say x[3:-3]  # 123
  say x[3:-4]  # 123
  say x[5:-1]  # 5
  say x[5:-2]  # 45
  say x[6:-1]  # empty
  say x[6:-2]  # 5
  say x[6:-3]  # 45
  say x[9:-9]  # 12345
  say x[9:-4]  # empty
  say x[9:-5]  # 5
end
`,
    },
  });

  def({
    name: 'sink.25.assign-self',
    kind: 'sink',
    stdout: `heLLo
heLLo
`,
    files: {
      '/root/main.sink': `
var x = 'hello'
x = x[0:2] ~ 'LL' ~ x[4:]
say x # heLLo

x = x ~ 1 ~ 2 && x[:]
say x # heLLo
`,
    },
  });

  def({
    name: 'sink.26.tail-call',
    kind: 'sink',
    stdout: `2
`,
    files: {
      '/root/main.sink': `
def test a
  if a > 100
    return stacktrace
  end
  return test a + 1
end

say &test 0
`,
    },
  });

  def({
    name: 'sink.27.range',
    kind: 'sink',
    stdout: `0 0
1 1
2 2
2 0
3 1
4 2
4 0
6 1
8 2
-1.25 0
-1.75 1
-2.25 2
{0, 1, 2, 3, 4}
{}
{0, 1, 2, 3}
{2, 3, 4}
{-1, 0, 1, 2, 3, 4}
{1.5, 2.5}
{0, 3, 6, 9}
{-1, -1.25, -1.5, -1.75}
{0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2}
`,
    files: {
      '/root/main.sink': `
for var v, i: range 3
  say v, i
  # 0 0
  # 1 1
  # 2 2
end

for var v, i: range 2, 5
  say v, i
  # 2 0
  # 3 1
  # 4 2
end

for var v, i: range 4, 10, 2
  say v, i
  # 4 0
  # 6 1
  # 8 2
end

for var v, i: range -1.25, -2.75, -0.5
  say v, i
  # -1.25 0
  # -1.75 1
  # -2.25 2
end

say range 5     # {0, 1, 2, 3, 4}
say range -1    # {}
say range 3.4   # {0, 1, 2, 3}

say range 2, 5    # {2, 3, 4}
say range -1, 5   # {-1, 0, 1, 2, 3, 4}
say range 1.5, 3  # {1.5, 2.5}

say range 0, 10, 3       # {0, 3, 6, 9}
say range -1, -2, -0.25  # {-1, -1.25, -1.5, -1.75}
say range 0, 2.25, 0.25  # {0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2}
`,
    },
  });

  def({
    name: 'sink.28.str-split',
    kind: 'sink',
    stdout: `{'crY', '', '', '', 'crY'}
{'R8fx', 'R8fxDz8nR8fxDz8nR8fxDz8n'}
{'', 'bsgp', '', 'bsgp'}
{'', 'dd', '', 'd', '', '', ''}
{'YOcb7'}
{'', '', 'xPxP', '', '', ''}
{'qf7cqf7c', '', 'qf7c'}
{'meI1bcmeI', '', '', '', ''}
{'a', 'a'}
{'k', 'k', 'k', '', '', 'k'}
{'PLf', ''}
{'jHM', 'aEaEjHM', '', 'aE'}
{'', 'aRT'}
{'9dw', '9dw9dw', '', ''}
{'RC5C5', ''}
{'exBexBBa'}
{'7M7M7M7M7M7M7M'}
{'UiUi', 'UiUi', 'Ui', '', ''}
{'', 'e', '', 'eee'}
{'MYMYMY', 'MYMY'}
{'', '', ''}
{'1', '2', '3', '4'}
`,
    files: {
      '/root/main.sink': `
say str.split 'crYy2oy2oy2oy2ocrY', 'y2o'
say str.split 'R8fxfPR8fxDz8nR8fxDz8nR8fxDz8n', 'fP'
say str.split 'wmlTbsgpwmlTwmlTbsgp', 'wmlT'
say str.split '7dd77d777', '7'
say str.split 'YOcb7', 'Fswk'
say str.split 'oGoGxPxPoGoGoG', 'oG'
say str.split 'qf7cqf7crrqf7c', 'r'
say str.split 'meI1bcmeI8AC8AC8AC8AC', '8AC'
say str.split 'aT9mxa', 'T9mx'
say str.split 'ktVmYktVmYktVmYtVmYtVmYk', 'tVmY'
say str.split 'PLfP1', 'P1'
say str.split 'jHMVddIaEaEjHMVddIVddIaE', 'VddI'
say str.split 'CeYaRT', 'CeY'
say str.split '9dwp9dw9dwpp', 'p'
say str.split 'RC5C5jkth', 'jkth'
say str.split 'exBexBBa', 'Z'
say str.split '7M7M7M7M7M7M7M', 'k299'
say str.split 'UiUi2NUiUi2NUi2N2N', '2N'
say str.split '69VWe69VW69VWeee', '69VW'
say str.split 'MYMYMYGDS1MYMY', 'GDS1'
say str.split 'AAAA', 'AA'
say str.split '1234', ''
`,
    },
  });

  def({
    name: 'sink.29.no-newline',
    kind: 'sink',
    stdout: `hi
`,
    files: {
      '/root/main.sink': `say 'hi'`,
    },
  });

  def({
    name: 'sink.30.list-sort',
    kind: 'sink',
    stdout: `-1
-1
-1
1
-1
-1
1
1
-1
1
1
1
0
0
1
-1
0
-1
1
0
1
-1
-1
1
0
0
-1
1
1
-1
-1
1
0
0
-1
1
{nan, 0, inf, 'a'}
{'a', inf, 0, nan}
{3, 2, 1}
done
`,
    files: {
      '/root/main.sink': `say order nil, 0        # -1
say order nil, ''       # -1
say order nil, {}       # -1

say order 0, nil        # 1
say order 0, ''         # -1
say order 0, {}         # -1

say order '', nil       # 1
say order '', 0         # 1
say order '', {}        # -1

say order {}, nil       # 1
say order {}, 0         # 1
say order {}, ''        # 1

say order nil, nil      # 0

say order 0, 0          # 0
say order 5, 0          # 1
say order 0, 5          # -1

say order '', ''        # 0
say order '', 'a'       # -1
say order 'a', ''       # 1

say order 'abc', 'abc'  # 0
say order 'abcd', 'abc' # 1
say order 'abc', 'abcd' # -1
say order 'ab', 'ac'    # -1
say order 'ac', 'ab'    # 1

var x = {1, 2, 3, 4}
list.push x, x
say order x, x          # 0

say order {}, {}        # 0
say order {}, {1}       # -1
say order {1}, {}       # 1

say order {1, 5}, {1, nil}  # 1
say order {1, nil}, {1, 5}  # -1

say order {1}, {1, 5}   # -1
say order {1, 5}, {1}   # 1
say order {1}, {1}      # 0

say order num.nan, num.nan  # 0
say order num.nan, 0        # -1
say order 0, num.nan        # 1

say list.sort {'a', 0, num.nan, num.inf}
say list.rsort {'a', 0, num.nan, num.inf}

x = {1, 2, 3}
list.rsort x
say x

rand.seed 1234
for: range 1000
  var ls = {}
  for: range 500 + rand.int % 100
    list.push ls, rand.int % 1000
  end
  list.sort ls
  for var i: range 1, &ls
    if ls[i - 1] > ls[i]
      say 'fail'
      say ls
    end
  end
end
say 'done'
`,
    },
  });

  def({
    name: 'sink.31.range-bug',
    kind: 'sink',
    stdout: `0
1
2
3
4
5
6
7
8
9
0
2
4
6
8
`,
    files: {
      '/root/main.sink': `
var y = 10
for var x: range y
  say x
  y -= 1
end

y = 10
for var x: range 0, y, 2
  say x
  y -= 4
end
`,
    },
  });

  def({
    name: 'sink.32.num-ints',
    kind: 'sink',
    stdout: `0
-1
1
-255
-256
-257
255
256
257
-65535
-65536
-65537
65535
65536
65537
-4294967295
-4294967296
-4294967297
4294967295
4294967296
4294967297
`,
    files: {
      '/root/main.sink': `
say 0
say -1
say 1

say -255
say -256
say -257

say 255
say 256
say 257

say -65535
say -65536
say -65537

say 65535
say 65536
say 65537

say -4294967295
say -4294967296
say -4294967297

say 4294967295
say 4294967296
say 4294967297
`,
    },
  });

  def({
    name: 'sink.33.str-replace',
    kind: 'sink',
    stdout: `heAAo worAd
asdf
BBB
`,
    files: {
      '/root/main.sink': `
say str.replace 'hello world', 'l', 'A'
say str.replace 'asdf', 'A', 'B'
say str.replace 'AAAAAA', 'AA', 'B'
`,
    },
  });

  def({
    name: 'sink.34.str-beginsends',
    kind: 'sink',
    stdout: `1
nil
nil
1
1
1
nil
nil
1
1
`,
    files: {
      '/root/main.sink': `
say str.begins 'hello world', 'hello'
say str.begins 'hello world', 'hellO'
say str.begins 'a', 'abcd'
say str.begins 'aaa', 'aaa'
say str.begins 'asdf', ''

say str.ends 'hello world', 'world'
say str.ends 'hello world', 'worlD'
say str.ends 'a', 'abcd'
say str.ends 'aaa', 'aaa'
say str.ends 'asdf', ''
`,
    },
  });

  def({
    name: 'sink.35.str-pad',
    kind: 'sink',
    stdout: `'  hello'
'hello'
'hello'
'hello'
'hello'
'hello'
'hello  '
' X'
'X '
`,
    files: {
      '/root/main.sink': `
say "'\${str.pad 'hello', -7}'"
say "'\${str.pad 'hello', -5}'"
say "'\${str.pad 'hello', -1}'"
say "'\${str.pad 'hello',  0}'"
say "'\${str.pad 'hello',  1}'"
say "'\${str.pad 'hello',  5}'"
say "'\${str.pad 'hello',  7}'"

say "'\${str.pad 'X', -2.5}'"
say "'\${str.pad 'X',  2.5}'"
`,
    },
  });

  def({
    name: 'sink.36.str-find',
    kind: 'sink',
    stdout: `find
nil
0
3
0
1
1
5
5
nil
nil
5
5
1
1
1
rfind
nil
0
3
4
5
1
1
5
5
5
5
1
1
nil
nil
`,
    files: {
      '/root/main.sink': `say 'find'

say str.find 'asdf', 'A'
say str.find 'asdf', 'a'
say str.find 'asdf', 'f'
say str.find 'asdf', ''

say str.find 'abcdabcd', 'bc'
say str.find 'abcdabcd', 'bc', 1
say str.find 'abcdabcd', 'bc', 2
say str.find 'abcdabcd', 'bc', 5
say str.find 'abcdabcd', 'bc', 6

say str.find 'abcdabcd', 'bc', -2
say str.find 'abcdabcd', 'bc', -3
say str.find 'abcdabcd', 'bc', -6
say str.find 'abcdabcd', 'bc', -7
say str.find 'abcdabcd', 'bc', -8
say str.find 'abcdabcd', 'bc', -999

say 'rfind'

say str.rfind 'asdf', 'A'
say str.rfind 'asdf', 'a'
say str.rfind 'asdf', 'f'
say str.rfind 'asdf', ''

say str.rfind 'abcdabcd', 'bc'
say str.rfind 'abcdabcd', 'bc', 1
say str.rfind 'abcdabcd', 'bc', 2
say str.rfind 'abcdabcd', 'bc', 5
say str.rfind 'abcdabcd', 'bc', 6

say str.rfind 'abcdabcd', 'bc', -2
say str.rfind 'abcdabcd', 'bc', -3
say str.rfind 'abcdabcd', 'bc', -6
say str.rfind 'abcdabcd', 'bc', -7
say str.rfind 'abcdabcd', 'bc', -8
say str.rfind 'abcdabcd', 'bc', -999
`,
    },
  });

  def({
    name: 'sink.37.str-case',
    kind: 'sink',
    stdout: `{0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15}
{16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31}
{32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47}
{48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63}
{64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79}
{80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95}
{96, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79}
{80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 123, 124, 125, 126, 127}
{128, 129, 130, 131, 132, 133, 134, 135, 136, 137, 138, 139, 140, 141, 142, 143}
{144, 145, 146, 147, 148, 149, 150, 151, 152, 153, 154, 155, 156, 157, 158, 159}
{160, 161, 162, 163, 164, 165, 166, 167, 168, 169, 170, 171, 172, 173, 174, 175}
{176, 177, 178, 179, 180, 181, 182, 183, 184, 185, 186, 187, 188, 189, 190, 191}
{192, 193, 194, 195, 196, 197, 198, 199, 200, 201, 202, 203, 204, 205, 206, 207}
{208, 209, 210, 211, 212, 213, 214, 215, 216, 217, 218, 219, 220, 221, 222, 223}
{224, 225, 226, 227, 228, 229, 230, 231, 232, 233, 234, 235, 236, 237, 238, 239}
{240, 241, 242, 243, 244, 245, 246, 247, 248, 249, 250, 251, 252, 253, 254, 255}
{0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15}
{16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31}
{32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47}
{48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63}
{64, 97, 98, 99, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111}
{112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 91, 92, 93, 94, 95}
{96, 97, 98, 99, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111}
{112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 127}
{128, 129, 130, 131, 132, 133, 134, 135, 136, 137, 138, 139, 140, 141, 142, 143}
{144, 145, 146, 147, 148, 149, 150, 151, 152, 153, 154, 155, 156, 157, 158, 159}
{160, 161, 162, 163, 164, 165, 166, 167, 168, 169, 170, 171, 172, 173, 174, 175}
{176, 177, 178, 179, 180, 181, 182, 183, 184, 185, 186, 187, 188, 189, 190, 191}
{192, 193, 194, 195, 196, 197, 198, 199, 200, 201, 202, 203, 204, 205, 206, 207}
{208, 209, 210, 211, 212, 213, 214, 215, 216, 217, 218, 219, 220, 221, 222, 223}
{224, 225, 226, 227, 228, 229, 230, 231, 232, 233, 234, 235, 236, 237, 238, 239}
{240, 241, 242, 243, 244, 245, 246, 247, 248, 249, 250, 251, 252, 253, 254, 255}
`,
    files: {
      '/root/main.sink': `
for var x: range 0, 256, 16
  say (range x, x + 16 | list.str | str.upper | str.list)
end

for var x: range 0, 256, 16
  say (range x, x + 16 | list.str | str.lower | str.list)
end
`,
    },
  });

  def({
    name: 'sink.38.str-trimrevrep',
    kind: 'sink',
    stdout: `9 1
10 1
11 1
12 1
13 1
32 1
cba
a


abc
abcabcabc

""
`,
    files: {
      '/root/main.sink': `
for var x: range 0, 256
  var s = list.str {x, x, x, 65, x}
  if (str.trim s) != s
    say x, &str.trim s
  end
end

say str.rev 'abc'
say str.rev 'a'
say str.rev ''

say str.rep 'abc', 0
say str.rep 'abc', 1
say str.rep 'abc', 3
say str.rep '', 99

say '"' ~ (str.trim '   ') ~ '"'
`,
    },
  });

  def({
    name: 'sink.39.str-hash',
    kind: 'sink',
    stdout: `0 0
5 4185040151
10 14207971054
15 11122314274
20 10949885412
25 9579205148
30 9283294372
35 9054236106
40 10528512579
45 8613392511
50 13915211121
55 9723034611
60 7558516780
65 10551955782
70 11397275566
75 5995058400
80 4790697866
85 8199235121
90 11513033061
95 6812116845
{296480703, 512771809, 1907580628, 1377802961}
{3421180703, 626138256, 2950103748, 755914226}
{296480703, 512771809, 1907580628, 1377802961}
{3421180703, 626138256, 2950103748, 755914226}
`,
    files: {
      '/root/main.sink': `
for var i: range 0, 100, 5
  var h = str.hash (str.rep 'x', i), i * 2
  say i, h[0] + h[1] + h[2] + h[3]
end

# test static hashes
say str.hash "test\\0one", 123
say str.hash "test\\0two"

# compared to runtime hashing
var s1 = "test\\0one"
var n1 = 123
var s2 = "test\\0two"
say str.hash s1, n1
say str.hash s2
`,
    },
  });

  def({
    name: 'sink.40.utf8',
    kind: 'sink',
    stdout: `pass
`,
    files: {
      '/root/main.sink': `
for var test1: {
    # list of codepoints          are codepoints valid
    {{0, 0, 0                  },         1           },
    {{0x7F, 0x7F, 0x7F         },         1           },
    {{0x80, 0x80, 0x80         },         1           },
    {{0x7FF, 0x7FF, 0x7FF      },         1           },
    {{0x800, 0x800, 0x800      },         1           },
    {{0x0FFFF, 0x0FFFF, 0x0FFFF},         1           },
    {{0x10000, 0x10000, 0x10000},         1           },
    {{0, 0x7F, 0x80, 0x7FF     },         1           },
    {{0x7FF, 0x800, 0x0FFFF    },         1           },
    {{0x0FFFF, 0x10000, 0      },         1           },
    {{0x10FFFF, 0x10FFFE, 0, 1 },         1           },
    {{0xD7FF, 0xE000           },         1           },
    {{0xFFFD, 0x10FFFF         },         1           },
    {{0x110000                 },       nil           },
    {{0xD800                   },       nil           },
    {{0xDE00                   },       nil           },
    {{0xDFFF                   },       nil           }
  }
  var ls = test1[0]
  var valid = test1[1]
  if valid != utf8.valid ls
    say 'utf8.valid fail'
  end
  if valid
    var ls2 = ls | utf8.str | utf8.list
    if 0 != order ls, ls2
      say 'utf8.str/utf8.list fail'
    end
  end
end

for var test2: {
    # bytes                       are bytes valid UTF8
    {"\\x00\\x00\\x00\\x00\\x00\\x00" ,         1           },
    {"\\x7F\\x7F\\x7F\\x7F\\x7F\\x7F" ,         1           },
    {"\\xC2\\x80\\xC2\\x80"         ,         1           },
    {"\\xDF\\xBF\\xDF\\xBF"         ,         1           },
    {"\\xE0\\xA0\\x80"             ,         1           },
    {"\\xEF\\xBF\\xBF"             ,         1           },
    {"\\xF0\\x90\\x80\\x80"         ,         1           },
    {"\\xF4\\x8F\\xBF\\xBF"         ,         1           },
    {"\\xF4\\x9F\\xBF\\xBF"         ,       nil           },
    {"\\xED\\xA0\\x80"             ,       nil           },
    {"\\x80"                     ,       nil           },
    {"\\xC2"                     ,       nil           }
  }
  var st = test2[0]
  var valid = test2[1]
  if valid != utf8.valid st
    say 'utf8.valid fail'
  end
  if valid
    var st2 = st | utf8.list | utf8.str
    if st != st2
      say 'utf8.str/utf8.list fail'
    end
  end
end

say 'pass'
`,
    },
  });

  def({
    name: 'sink.41.struct',
    kind: 'sink',
    stdout: `AB
{1111572801}
{1094795586}
7
nil
{nan}
{0, 0, 0, 0, 0, 0, 248, 63}
{63, 248, 0, 0, 0, 0, 0, 0}
{1111572801, 1094795586, 1111572801, 1094795586}
{1, 0, 2, 0, 0, 0, 3, 0, 4, 0, 0, 0, 5, 0, 6, 0, 0, 0, 7, 0, 8, 0, 0, 0}
nil
nil
nil
nil
pass
`,
    files: {
      '/root/main.sink': `
say struct.str {0x41, 0x42}, {struct.U8, struct.U8}
say struct.list 'AAAB', {struct.UL32}
say struct.list 'AAAB', {struct.UB32}
say struct.size {struct.F32, struct.U8, struct.S16}
say struct.size {'hello'}

var s = list.str { 0x7F, 0xF0, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01 }
say struct.list s, {struct.FB64}

say (struct.str {1.5}, {struct.FL64} | str.list)
say (struct.str {1.5}, {struct.FB64} | str.list)

# test arrays

say struct.list 'AAABAAABAAABAAAB', {struct.UL32, struct.UB32}
say (struct.str {1, 2, 3, 4, 5, 6, 7, 8}, {struct.UL16, struct.UL32} | str.list)

say struct.size
say struct.size 'asdf'
say struct.size struct.U8
say struct.size {}

if struct.isLE
  # pass no matter what, just want to make sure the command exists
  say 'pass'
else
  say 'pass'
end
`,
    },
  });

  def({
    name: 'sink.42.circular',
    kind: 'sink',
    stdout: `{{1, 2, 3}, {1, 2, 3}}
`,
    files: {
      '/root/main.sink': `
var x = {1, 2, 3}
say {x, x}
`,
    },
  });

  def({
    name: 'sink.43.include-err',
    kind: 'sink',

    files: {
      '/root/main.sink': `
var x
include x 'test'
`,
      '/root/test.sink': `
say 'test'
`,
    },
  });

  def({
    name: 'sink.44.tonum',
    kind: 'sink',
    stdout: `nil
nil
0
0
1
nil
nil
-1
nil
nil
0
0
0
1
-1
0
0.5
-0.5
0
0
1
-1
1
-1
1
-1
1
0
1
1
1
20
1234567890
-9876.54321
1.23456789e-13
1.23456789e+34
2.55443322e+24
0.5
98.25
99.25
1066
10
1
0.1
1
2
2
-0.5
`,
    files: {
      '/root/main.sink': `
say +'      '
say +'     -'
say +'     0'
say +'    -0'
say +'     1'
say +'     .'
say +'    -.'
say +'    -1'
say +'   - 1'
say +'     a'
say +'    0b'
say +'   -0b'
say +'    0y'
say +'   0_1'
say +'  -0_1'
say +'   -0_'
say +'   0.5'
say +'  -0.5'
say +'   0e5'
say +'  -0e5'
say +'   001'
say +'  -001'
say +'  0b_1'
say +' -0b_1'
say +'  0b12'
say +' -0b12'
say +' 0b__1'
say +'    0e'
say +'    1e'
say +'   1e+'
say +' 1e+-1'
say +'  0x14'
say +'  1234567890       '
say +'  -9876.543210     '
say +'  0.123456789e-12  '
say +'  1.234567890E+34  '
say +'  255443322E16     '
say +'  0.5              '
say +'  98.25            '
say +'  99.25            '
say +'  1066             '
say +'  1e1              '
say +'  0.1e1            '
say +'  1e-1             '
say +'  1e00             '
say +'  2e+00            '
say +'  2e-00            '
say +'-.5'
`,
    },
  });

  def({
    name: 'sink.45.include-def',
    kind: 'sink',
    stdout: `1 + 2 = 3
`,
    files: {
      '/root/main.sink': `
def foo a, b
  include 'test.sink'
end

foo 1, 2
`,
      '/root/test.sink': `
say "\$a + \$b = \${a + b}"
`,
    },
  });

  def({
    name: 'sink.46.num-hex',
    kind: 'sink',
    stdout: `0x1
0xFF
0x100
{'0x1', '0x2', '0x3', '0xFE', '0xFF', '0x100'}
0b1111
0c17
`,
    files: {
      '/root/main.sink': `say num.hex 1
say num.hex 255
say num.hex 256
say num.hex {1, 2, 3, 254, 255, 256}
say num.bin 15
say num.oct 15
`,
    },
  });

  def({
    name: 'sink.47.valid-json',
    kind: 'sink',
    stdout: ``,
    files: {
      '/root/main.sink': `def N a
  if (pickle.valid a) != nil
    say "fail: expecting invalid\\n> \\"\$a\\""
  end
end

def Y a
  if (pickle.valid a) != 1
    say "fail: expecting json\\n> \\"\$a\\""
  end
end

N ''
N 'hi'
Y '[]'
Y '0'
Y '1'
Y '-0'
Y '-1'
Y 'null'
N '-.1'
Y '-0.1'
Y '0e0'
Y '0e+0'
Y '1000000e-10000000'
Y ' null'
Y 'null '
N ' 99.e10 '
Y ' 99.0e-1 '
Y '[-1,1]'
Y '[[[[[]]]]]'
Y '[[[[[1],2],3],4],5]'
Y '[        ]'
Y '[     10 ]'
N ' '
N ' n'
N ' nu'
N ' nul'
N ' n '
N ' nu '
N ' nul '
Y ' null '
Y '0.0'
N '*'
N '{}'
N 'true'
N 'false'
N '{"hi":"yo"}'
N '"\\u'
N '"\\u"'
N '"\\"'
N '"\\u1000"'
N '"\\u0100"'
N '"\\a"'
Y '"\\u0099"'
Y '"\\u00eF"'
`,
    },
  });

  def({
    name: 'sink.48.valid-bin',
    kind: 'sink',
    stdout: ``,
    files: {
      '/root/main.sink': `def N a
  if (pickle.valid list.str a) != nil
    say "fail: expecting invalid\\n> \\"\$a\\""
  end
end

def Y a
  if (pickle.valid list.str a) != 2
    say "fail: expecting bin\\n> \\"\$a\\""
  end
end

N {}
N { 0x01 }
N { 0x01, 0x00 }
Y { 0x01, 0x00, 0xF7 }
N { 0x01, 0x00, 0xF7, 0x00 }
Y { 0x01, 0x02, 0x01, 0x61, 0x04, 0x61, 0x62, 0x63, 0x64, 0xF9, 0x04, 0xF8, 0x00, 0xF9, 0x01, 0xF0,
  0x00, 0xF8, 0x01, 0xF8, 0x00 }
N { 0x01, 0x01, 0x01, 0x61, 0x04, 0x61, 0x62, 0x63, 0x64, 0xF9, 0x04, 0xF8, 0x00, 0xF9, 0x01, 0xF0,
  0x00, 0xF8, 0x01, 0xF8, 0x00 }
N { 0x01, 0x02, 0x02, 0x61, 0x04, 0x61, 0x62, 0x63, 0x64, 0xF9, 0x04, 0xF8, 0x00, 0xF9, 0x01, 0xF0,
  0x00, 0xF8, 0x01, 0xF8, 0x00 }
N { 0x01, 0x02, 0x01, 0x61, 0xFF, 0x61, 0x62, 0x63, 0x64, 0xF9, 0x04, 0xF8, 0x00, 0xF9, 0x01, 0xF0,
  0x00, 0xF8, 0x01, 0xF8, 0x00 }
N { 0x01, 0x02, 0x01, 0x61, 0x04, 0x61, 0x62, 0x63, 0x64, 0xF8, 0x04, 0xF8, 0x00, 0xF9, 0x01, 0xF0,
  0x00, 0xF8, 0x01, 0xF8, 0x00 }
N { 0x01, 0x02, 0x01, 0x61, 0x04, 0x61, 0x62, 0x63, 0x64, 0xF9, 0x05, 0xF8, 0x00, 0xF9, 0x01, 0xF0,
  0x00, 0xF8, 0x01, 0xF8, 0x00 }
N { 0x01, 0x02, 0x01, 0x61, 0x04, 0x61, 0x62, 0x63, 0x64, 0xF8, 0x04, 0xF8, 0x0F, 0xF9, 0x01, 0xF0,
  0x00, 0xF8, 0x01, 0xF8, 0x00 }
N { 0x01, 0x02, 0x01, 0x61, 0x04, 0x61, 0x62, 0x63, 0x64, 0xF8, 0x04, 0xF8, 0x00, 0xF9, 0x01, 0xF0,
  0x02, 0xF8, 0x01, 0xF8, 0x00 }
N { 0x01, 0x02, 0x01, 0x61, 0x04, 0x61, 0x62, 0x63, 0x64, 0xF8, 0x04, 0xF8, 0x00, 0xF9, 0x01, 0xF0,
  0x00, 0xF8, 0x01, 0xF9, 0x00 }
Y { 0x01, 0x00, 0xF9, 0x02, 0xF9, 0x01, 0xF1, 0x06, 0xFA, 0x00 }
Y { 0x01, 0x00, 0xF9, 0x02, 0xF9, 0x01, 0xF1, 0x06, 0xFA, 0x01 }
N { 0x01, 0x00, 0xF9, 0x02, 0xF9, 0x01, 0xF1, 0x06, 0xFA, 0x02 }
Y { 0x01, 0x00, 0xF0, 0x00 }
Y { 0x01, 0x00, 0xF1, 0x00 }
Y { 0x01, 0x00, 0xF2, 0x00, 0x00 }
Y { 0x01, 0x00, 0xF3, 0x00, 0x00 }
Y { 0x01, 0x00, 0xF4, 0x00, 0x00, 0x00, 0x00 }
Y { 0x01, 0x00, 0xF5, 0x00, 0x00, 0x00, 0x00 }
Y { 0x01, 0x00, 0xF6, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 }
N { 0x01, 0x00, 0xF0, 0x00, 0x00 }
N { 0x01, 0x00, 0xF1, 0x00, 0x00 }
N { 0x01, 0x00, 0xF2, 0x00, 0x00, 0x00 }
N { 0x01, 0x00, 0xF3, 0x00, 0x00, 0x00 }
N { 0x01, 0x00, 0xF4, 0x00, 0x00, 0x00, 0x00, 0x00 }
N { 0x01, 0x00, 0xF5, 0x00, 0x00, 0x00, 0x00, 0x00 }
N { 0x01, 0x00, 0xF6, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 }
N { 0x01, 0x00, 0xF0 }
N { 0x01, 0x00, 0xF1 }
N { 0x01, 0x00, 0xF2, 0x00 }
N { 0x01, 0x00, 0xF3, 0x00 }
N { 0x01, 0x00, 0xF4, 0x00, 0x00, 0x00 }
N { 0x01, 0x00, 0xF5, 0x00, 0x00, 0x00 }
N { 0x01, 0x00, 0xF6, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 }
`,
    },
  });

  def({
    name: 'sink.49.pickle-json',
    kind: 'sink',
    stdout: `null
0
""
[]
100.125
-100.125
"r: \\r, n: \\n, b: \\b, f: \\f, t: \\t"
"\\u0000\\u0001\\u000E\\u000F\\u0010\\u0011\\u001E\\u001F "
[1,2,3]
[1,[2,[3,[4,null],null],null],null]
[["hi"],[["hi"]],["hi"]]
`,
    files: {
      '/root/main.sink': `say pickle.json nil
say pickle.json 0
say pickle.json ''
say pickle.json {}

say pickle.json 100.125
say pickle.json -100.125
say pickle.json "r: \\r, n: \\n, b: \\b, f: \\f, t: \\t"
say pickle.json list.str {0x00, 0x01, 0x0E, 0x0F, 0x10, 0x11, 0x1E, 0x1F, 0x20}

say pickle.json {1, 2, 3}
say pickle.json {1, {2, {3, {4, nil}, nil}, nil}, nil}

var a = {'hi'}
say pickle.json {a, {a}, a}
`,
    },
  });

  def({
    name: 'sink.50.pickle-bin',
    kind: 'sink',
    stdout: `0100F7
01010161F902F800F800
010201610461626364F904F800F901F000F801F800
0100F902F901F106FA00
`,
    files: {
      '/root/main.sink': `def T obj
  var out = {}
  for var p: pickle.bin obj | str.list
    list.push out, (num.hex p, 2)[2:]
  end
  say list.join out
end

T nil
T {'a', 'a'}
T {'a', {0}, 'abcd', 'a'}
var a = {{-250}}; list.push a, a
T a
`,
    },
  });

  def({
    name: 'sink.51.pickle-copy',
    kind: 'sink',
    stdout: `1
{1, 2, 3}
{1, 2, 3}
nil
{1, 2, 3, {circular}}
{1, 2, 3, {circular}}
nil
1
1
{{1, 2, 3, {circular}}, {1, 2, 3, {circular}}}
{{1, 2, 3, {circular}}, {1, 2, 3, {circular}}}
nil
1
1
1
1
`,
    files: {
      '/root/main.sink': `
var a = {1, 2, 3}
say a == a

var c = pickle.copy a
say a
say c
say a == c

list.push a, a
c = pickle.copy a
say a
say c
say a == c
say a[3] == a
say c[3] == c

a = {a, a}
say a
c = pickle.copy a

say c
say a == c
say a[0] == a[1]
say c[0] == c[1]
say a[0][3] == a[1][3]
say c[0][3] == c[1][3]
`,
    },
  });

  def({
    name: 'sink.52.reassign',
    kind: 'sink',
    stdout: `{1}
1
1
`,
    files: {
      '/root/main.sink': `var a = 1
a = {a}
say a

var b = 1
b = "\$b"
say isstr b
say b
`,
    },
  });

  def({
    name: 'sink.53.pickle-ref',
    kind: 'sink',
    stdout: `{1, 2, 3}
nil nil
{1, 2, 3, {circular}}
1 nil
{{1, 2, 3, {circular}}, {1, 2, 3, {circular}}}
1 1
{1, 2, 3, {circular}}
1 nil
{{1, 2, 3, {circular}}, {{{{1, 2, 3, {circular}}}}}}
1 1
{{1}, {{{{{1, 2, 3, {1}}}}}}}
nil 1
`,
    files: {
      '/root/main.sink': `def T a
  say a
  say (pickle.circular a), (pickle.sibling a)
end

var a = {1, 2, 3}
T a
list.push a, a
T a
a = {a, a}
T a
a = a[0]
T a
a = {a, {{{a}}}}
T a
a = {1}
a = {a, {{{{{1, 2, 3, a}}}}}}
T a
`,
    },
  });

  def({
    name: 'sink.54.pickle-val',
    kind: 'sink',
    stdout: `done
`,
    files: {
      '/root/main.sink': `def JB a
  var j = pickle.json a
  var b = pickle.bin a
  if (order (pickle.val j), a) != 0
    say "JSON isn't equal: '\$a' != '\${pickle.val j}'"
    say 'fail'
  end
  if (order (pickle.val b), a) != 0
    say "BIN isn't equal: '\$a' != '\${pickle.val b}'"
    say 'fail'
  end
end

def randstr len
  var s = {}
  for var i: range len
    list.push s, num.floor rand.num * 256
  end
  return list.str s
end

JB nil
JB 1
JB -1
JB 0
JB -1e-100
JB -10e-100
JB 10e-100
JB 10e100
JB 300
JB -300
JB 70000
JB -70000
JB -1.5
JB 1.5
rand.seed 0
for var i: range 100
  JB randstr 10
end
for var i: range 100
  var s = {}
  for var j: range 10
    if rand.num < 0.3
      s = {s}
    else
      var v
      if rand.num < 0.5
        v = (num.floor rand.num * 256) / 16
      elseif rand.num < 0.5
        v = randstr 10
      end
      list.push s, v
    end
  end
  JB s
end
say 'done'
`,
    },
  });

  def({
    name: 'sink.55.int-sizes',
    kind: 'sink',
    stdout: `0 255
-1 -256
256 65535
-257 -65536
65536 4294967295
-65537 -4294967296
4294967296
-4294967297
`,
    files: {
      '/root/main.sink': `say 0, 255
say -1, -256
say 256, 65535
say -257, -65536
say 65536, 4294967295
say -65537, -4294967296
say 4294967296
say -4294967297
`,
    },
  });

  def({
    name: 'sink.56.all-args',
    kind: 'sink',
    stdout: `{1, 2, 3}
`,
    files: {
      '/root/main.sink': `def test ...args
  say args
end

test 1, 2, 3
`,
    },
  });

  def({
    name: 'sink.57.num-nans',
    kind: 'sink',
    stdout: `1 nan
2 nan
3 nan
4 nan
5 nan
6 nan
7 nan
8 nan
9 nan
10 nan
11 nan
12 nan
13 nan
14 nan
15 nan
16 nan
17 nan
18 nan
19 nan
20 nan
21 nan
22 nan
23 nan
24 nan
25 nan
26 nan
27 nan
28 nan
29 nan
30 nan
31 nan
32 nan
33 nan
34 nan
35 nan
36 nan
37 nan
38 nan
39 nan
40 nan
41 0x2
42 nan
43 0c2
44 nan
45 0b10
46 0
47 -1
48 0
49 0
50 0
51 1
52 1
53 1
54 1
55 1
56 0
57 256
58 0
59 256
60 0
61 256
62 0
63 2
64 2
65 -2
66 2
67 0
68 0
69 0
70 0
71 0
72 0
73 32
74 0
75 0
`,
    files: {
      '/root/main.sink': `say  1, -num.nan
say  2, num.nan + 2
say  3, 2 + num.nan
say  4, num.nan - 2
say  5, 2 - num.nan
say  6, num.nan * 2
say  7, 2 * num.nan
say  8, num.nan / 2
say  9, 2 / num.nan
say 10, num.nan % 2
say 11, 2 % num.nan
say 12, num.nan ^ 2
say 13, 2 ^ num.nan
say 14, num.abs num.nan
say 15, num.sign num.nan
say 16, num.max num.nan, 1
say 17, num.min num.nan, 1
say 18, num.clamp num.nan, 0, 1
say 19, num.clamp 0, num.nan, 1
say 20, num.clamp 1, 0, num.nan
say 21, num.floor num.nan
say 22, num.ceil num.nan
say 23, num.round num.nan
say 24, num.trunc num.nan
say 25, num.sin num.nan
say 26, num.cos num.nan
say 27, num.tan num.nan
say 28, num.asin num.nan
say 29, num.acos num.nan
say 30, num.atan num.nan
say 31, num.atan2 1, num.nan
say 32, num.atan2 num.nan, 1
say 33, num.log num.nan
say 34, num.log2 num.nan
say 35, num.log10 num.nan
say 36, num.exp num.nan
say 37, num.lerp num.nan, 1, 0.5
say 38, num.lerp 0, num.nan, 0.5
say 39, num.lerp 0, 1, num.nan
say 40, num.hex num.nan, 2
say 41, num.hex 2, num.nan
say 42, num.oct num.nan, 2
say 43, num.oct 2, num.nan
say 44, num.bin num.nan, 2
say 45, num.bin 2, num.nan
say 46, int.new num.nan
say 47, int.not num.nan
say 48, int.and 1, num.nan
say 49, int.and num.nan, 1
say 50, int.and 1, 1, 1, 1, 1, 1, num.nan
say 51, int.or 1, num.nan
say 52, int.or num.nan, 1
say 53, int.or 1, 1, 1, 1, 1, 1, num.nan
say 54, int.xor 1, num.nan
say 55, int.xor num.nan, 1
say 56, int.xor 1, 1, 1, 1, 1, 1, num.nan
say 57, int.shl 256, num.nan
say 58, int.shl num.nan, 1
say 59, int.shr 256, num.nan
say 60, int.shr num.nan, 1
say 61, int.sar 256, num.nan
say 62, int.sar num.nan, 1
say 63, int.add num.nan, 2
say 64, int.add 2, num.nan
say 65, int.sub num.nan, 2
say 66, int.sub 2, num.nan
say 67, int.mul num.nan, 2
say 68, int.mul 2, num.nan
say 69, int.div num.nan, 2
say 70, int.div 2, num.nan
say 71, int.mod num.nan, 2
say 72, int.mod 2, num.nan
say 73, int.clz num.nan
say 74, int.pop num.nan
say 75, int.bswap num.nan
`,
    },
  });

  def({
    name: 'sink.58.label-bug',
    kind: 'sink',
    stdout: `one
two
two
two
two
two
two
two
two
two
two
`,
    files: {
      '/root/main.sink': `var i = 0
label1:
say 'one'
label2:
say 'two'
i += 1
if i < 10
  goto label2
end
`,
    },
  });

  def({
    name: 'sink.59.large-cat',
    kind: 'sink',
    stdout: `1 1 1 1 1 1 1 1
1 1 1 1 1 1 1 1
1 1 1 1 1 1 1 1
1 1 1 1 1 1 1 1
1 1 1 1 1 1 1 1
1 1 1 1 1 1 1 1
1 1 1 1 1 1 1 1
1 1 1 1 1 1 1 1
1 1 1 1 1 1 1 1
1 1 1 1 1 1 1 1
1 1 1 1 1 1 1 1
1 1 1 1 1 1 1 1
1 1 1 1 1 1 1 1
1 1 1 1 1 1 1 1
1 1 1 1 1 1 1 1
`,
    files: {
      '/root/main.sink': `var i = 0
say "\${i+1} \${i+1} \${i+1} \${i+1} \${i+1} \${i+1} \${i+1} \${i+1}\\n" ~
  "\${i+1} \${i+1} \${i+1} \${i+1} \${i+1} \${i+1} \${i+1} \${i+1}\\n" ~
  "\${i+1} \${i+1} \${i+1} \${i+1} \${i+1} \${i+1} \${i+1} \${i+1}\\n" ~
  "\${i+1} \${i+1} \${i+1} \${i+1} \${i+1} \${i+1} \${i+1} \${i+1}\\n" ~
  "\${i+1} \${i+1} \${i+1} \${i+1} \${i+1} \${i+1} \${i+1} \${i+1}\\n" ~
  "\${i+1} \${i+1} \${i+1} \${i+1} \${i+1} \${i+1} \${i+1} \${i+1}\\n" ~
  "\${i+1} \${i+1} \${i+1} \${i+1} \${i+1} \${i+1} \${i+1} \${i+1}\\n" ~
  "\${i+1} \${i+1} \${i+1} \${i+1} \${i+1} \${i+1} \${i+1} \${i+1}\\n" ~
  "\${i+1} \${i+1} \${i+1} \${i+1} \${i+1} \${i+1} \${i+1} \${i+1}\\n" ~
  "\${i+1} \${i+1} \${i+1} \${i+1} \${i+1} \${i+1} \${i+1} \${i+1}\\n" ~
  "\${i+1} \${i+1} \${i+1} \${i+1} \${i+1} \${i+1} \${i+1} \${i+1}\\n" ~
  "\${i+1} \${i+1} \${i+1} \${i+1} \${i+1} \${i+1} \${i+1} \${i+1}\\n" ~
  "\${i+1} \${i+1} \${i+1} \${i+1} \${i+1} \${i+1} \${i+1} \${i+1}\\n" ~
  "\${i+1} \${i+1} \${i+1} \${i+1} \${i+1} \${i+1} \${i+1} \${i+1}\\n" ~
  "\${i+1} \${i+1} \${i+1} \${i+1} \${i+1} \${i+1} \${i+1} \${i+1}"
`,
    },
  });

  def({
    name: 'sink.60.enums',
    kind: 'sink',
    stdout: `0 1 2 3
5 6 7 8 10 11
20
`,
    files: {
      '/root/main.sink': `enum zero, one, two, three

say zero, one, two, three

enum five = 5, six, seven, eight, ten = (10), eleven

say five, six, seven, eight, ten, eleven

enum twenty = eleven * 2 - 2
say twenty
`,
    },
  });

  def({
    name: 'sink.61.range-override',
    kind: 'sink',
    stdout: `6
7
8
`,
    files: {
      '/root/main.sink': `
namespace test
  def range a, b, c
    return {6, 7, 8}
  end
  for var v: range 10
    say v
  end
end
`,
    },
  });

  def({
    name: 'sink.62.for-novars',
    kind: 'sink',
    stdout: `hi
hi
hi
hi
hi
yo
yo
yo
`,
    files: {
      '/root/main.sink': `
for: range 5
  say 'hi'
end

for: {1, 2, 3}
  say 'yo'
end
`,
    },
  });

  def({
    name: 'sink.63.bitops',
    kind: 'sink',
    stdout: `0x0012
0x1234
0xCC5D
{}
{14, 6}
{1, 2, 3, 0}
{2, 0, 0}
{0, 32, 13}
{'0x78563412', '0x0DCCBBAA', '0x4D3C2B1A'}
`,
    files: {
      '/root/main.sink': `
say num.hex (int.and 0x7777, 0x8FFF, 0xF89A, 0xFFFF), 4
say num.hex (int.or  0x1000, 0x0200, 0x0030, 0x0004), 4
say num.hex (int.xor 0x1234, 0x5678, 0x0011, 0x8800), 4

say int.and {}
say int.and {15, 7}, 30
say int.and {1, 2, 3, 4}, {5, 6, 7, 8}, {9, 10, 11, 12}
say int.and {3, 3, 3}, {6, 6}, {2}

int.pop   {0x00000000, 0xFFFFFFFF, 0x12345678} | say
int.bswap {0x12345678, 0xAABBCC0D, 0x1A2B3C4D} | num.hex 8 | say
`,
    },
  });

  def({
    name: 'sink.64.include-plus',
    kind: 'sink',
    stdout: `included
included
included
included
foo {1}
`,
    files: {
      '/root/main.sink': `
include + './test.sink'
include A './test.sink', B './test.sink', + './test.sink'

foo 1
`,
      '/root/test.sink': `
say 'included'

def foo ...args
  say 'foo', args
end
`,
    },
  });

  def({
    name: 'sink.65.embed',
    kind: 'sink',
    stdout: `HELLO
ydwoh
`,
    files: {
      '/root/data1.txt': `hello
`,
      '/root/main.sink': `
embed './data1.txt' | str.upper | str.trim | say

include './test/index.sink'
`,
      '/root/test/data2.txt': `howdy
`,
      '/root/test/index.sink': `
embed './data2.txt' | str.rev | str.trim | say
`,
    },
  });

  def({
    name: 'sink.66.static-cat',
    kind: 'sink',
    stdout: `
ab
cd
abcd
abcd
{}
{1, 2}
{3, 4}
{1, 2, 3, 4}
{1, 2, 3, 4}
`,
    files: {
      '/root/main.sink': `
say '' ~ ''
say 'ab' ~ ''
say '' ~ 'cd'
say 'ab' ~ 'cd'
say 'a' ~ 'b' ~ 'c' ~ 'd'

say {} ~ {}
say {1, 2} ~ {}
say {} ~ {3, 4}
say {1, 2} ~ {3, 4}
say {1} ~ {2} ~ {3} ~ {4}
`,
    },
  });

  def({
    name: 'sink.67.stacktrace',
    kind: 'sink',
    stdout: `gt2 (/root/main.sink:5:14)
gt1 (/root/main.sink:7:12)
gettrace (/root/main.sink:9:23)
gettrace (/root/main.sink:9:28)
gettrace (/root/main.sink:9:28)
gettrace (/root/main.sink:9:28)
/root/main.sink:12:12
`,
    files: {
      '/root/main.sink': `
def gettrace a
  def gt1
    def gt2
      return stacktrace
    end
    return gt2
  end
  return pick a == 0, gt1, gettrace a - 1
end

for var i: gettrace 3
  say i
end
`,
    },
  });

  def({
    name: 'sink.68.lookup-bug',
    kind: 'sink',
    stdout: `1
`,
    files: {
      '/root/main.sink': `
def a
end
def b.a
  return 1
end
say b.a
`,
    },
  });

  def({
    name: 'sink.70.big-str-split',
    kind: 'sink',
    stdout: `pass
`,
    files: {
      '/root/main.sink':
        `var s = '0123456789012345012345678901234501234567890123450123456789012345012345678901234501234567890123450123456789012345012345678901234501234567890123450123456789012345012345678901234501234567890123450123456789012345012345678901234501234567890123450123456789012345'
var len = &str.split s, ''
if len == 256
  say 'pass'
else
  say 'fail'
end

`,
    },
  });

  def({
    name: 'sink.71.var-reinit',
    kind: 'sink',
    stdout: `nil nil nil nil nil nil nil nil
nil nil nil nil nil nil nil nil
`,
    files: {
      '/root/main.sink': `
for: range 2
  var a, b, {c}, {d, ...e}
  var {f}
  var {g, ...h}
  say a, b, c, d, e, f, g, h
  a = 1
  b = 2
  c = 3
  d = 4
  e = 5
  f = 6
  g = 7
  h = 8
end
`,
    },
  });

  def({
    name: 'sink.72.no-def',
    kind: 'sink',

    files: {
      '/root/main.sink': `declare foo
`,
    },
  });

  def({
    name: 'sink.73.no-label',
    kind: 'sink',

    files: {
      '/root/main.sink': `def foo
  goto fail
end
`,
    },
  });

  def({
    name: 'sink.74.d-error',
    kind: 'sink',

    files: {
      '/root/main.sink': `
include 'testinc'

foo 1
`,
      '/root/testinc-d.sink': `
decalre foo 'bar'
`,
    },
  });

  def({
    name: 'sink.75.rand-range',
    kind: 'sink',
    stdout: `0
18
15
`,
    files: {
      '/root/main.sink': `
rand.seed 0

say rand.range 10
say rand.range 10, 20
say rand.range 10, 20, 5
`,
    },
  });
}
