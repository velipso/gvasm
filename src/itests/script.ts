//
// gvasm - Assembler and disassembler for Game Boy Advance homebrew
// by Sean Connelly (@velipso), https://sean.cm
// Project Home: https://github.com/velipso/gvasm
// SPDX-License-Identifier: 0BSD
//

import { ITest } from '../itest.ts';

export function load(def: (test: ITest) => void) {
  def({
    name: 'script.i8',
    desc: 'Use .i8 command inside .script',
    kind: 'make',
    files: {
      '/root/main': `
.script
  for: range 5
    put '.i8 0, 1, 2, 3'
  end
  /// 00 01 02 03
  /// 00 01 02 03
  /// 00 01 02 03
  /// 00 01 02 03
  /// 00 01 02 03
.end
`,
    },
  });

  /* TODO: if
  def({
    name: 'script.if',
    desc: 'Wrap .script in .if',
    kind: 'make',
    files: {
      '/root/main': `
.if 0
  .script
    for: range 5
      put '.i8 0, 1, 2, 3'
    end
  .end
.else
  .i8 5 /// 05
.end
`,
    },
  }); */

  def({
    name: 'script.missing-end',
    desc: 'Forget to close .script with .end',
    kind: 'make',
    error: true,
    files: {
      '/root/main': `
.script
put '.i8 0'
`,
    },
  });

  def({
    name: 'script.bad-comment',
    desc: 'Forget to close block comment in .script',
    kind: 'make',
    error: true,
    files: {
      '/root/main': `
.script
/*
.end
.i8 5
// */
.end
`,
    },
  });

  def({
    name: 'script.include',
    desc: 'Use include inside .script',
    kind: 'make',
    rawInclude: true,
    files: {
      '/root/main': `
.script
include "common.sink" /// 05 06
include "common.sink" /// 05 06
include "../one.sink" /// 01 02
.end
`,
      '/root/common.sink': `put '.i8 5, 6'`,
      '/one.sink': `put '.i8 1, 2'`,
    },
  });

  def({
    name: 'script.end-comments',
    desc: 'Comments at .end should work',
    kind: 'make',
    files: {
      '/root/main': `
.script
  put '.i8 0, 1, 2, 3'
  /// 00 01 02 03
.end // end
.script
  put '.i8 4, 5, 6, 7'
  /// 04 05 06 07
.end /* end
*/
.script
  put '.i8 8, 9, 10, 11'
  /// 08 09 0a 0b
.end /* end */
`,
    },
  });

  def({
    name: 'script.export-lookup-scripts',
    desc: 'Export and lookup values between scripts',
    kind: 'make',
    stdout: ['2', '{\'world\', 2}', 'two = 2'],
    files: {
      '/root/main': `
.def one = 1
.script sc
  export world = {'world', 2}
  export two = 2
.end
.script
  say lookup one + 1
  say lookup sc.world
.end
.printf "two = %d", sc.two
`,
    },
  });

  def({
    name: 'script.export-lookup-files',
    desc: 'Export and lookup values between files',
    kind: 'make',
    stdout: ['2', '{\'world\', 2}', 'two = 2'],
    files: {
      '/root/main': `
.import 'hello' hello
.script
  say lookup hello.one + 1
  say lookup hello.sc.world
.end
.printf "two = %d", hello.sc.two
`,
      '/root/hello': `
.def one = 1
.script sc
  export world = {'world', 2}
  export two = 2
.end
`,
    },
  });

  def({
    name: 'script.image.load',
    desc: 'Load images',
    kind: 'make',
    stdout: [
      '{{{0, 0, 0, 255}, {255, 255, 255, 255}, {0, 0, 0, 0}}, ' +
      '{{255, 0, 0, 255}, {0, 255, 0, 255}, {0, 0, 255, 255}}, ' +
      '{{69, 103, 137, 255}, {76, 59, 42, 127}, {0, 0, 0, 1}}}',
      '{{{0, 0, 0, 255}, {255, 255, 255, 255}, {0, 0, 0, 0}}, ' +
      '{{255, 0, 0, 255}, {0, 255, 0, 255}, {0, 0, 255, 255}}, ' +
      '{{69, 103, 137, 255}, {76, 59, 42, 127}, {0, 0, 0, 1}}}',
    ],
    files: {
      '/root/main': `
.script
  var png = { // raw png data
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x03, 0x00, 0x00, 0x00, 0x03, 0x08, 0x06, 0x00, 0x00, 0x00, 0x56, 0x28, 0xb5,
    0xbf, 0x00, 0x00, 0x00, 0x2d, 0x49, 0x44, 0x41, 0x54, 0x08, 0x99, 0x05, 0xc1, 0x41, 0x01, 0x40,
    0x00, 0x14, 0x40, 0xb1, 0x7d, 0x0d, 0x64, 0x91, 0x41, 0x03, 0x32, 0x68, 0xe0, 0xea, 0xac, 0x81,
    0xb6, 0xcf, 0x06, 0x55, 0xc1, 0x12, 0xc6, 0xa0, 0xec, 0xd7, 0xdb, 0x77, 0x1f, 0xcf, 0xb9, 0xad,
    0xf3, 0x03, 0xff, 0x1f, 0x0c, 0xac, 0x55, 0x57, 0x90, 0x28, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45,
    0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
  }
  say image.load png // load as array of numbers
  say image.load list.str png // load as byte string
.end
`,
    },
  });

  def({
    name: 'script.image.load-fail',
    desc: 'Fail to load image',
    kind: 'make',
    error: true,
    files: {
      '/root/main': `
.script
  image.load {'one', 'two'}
.end
`,
    },
  });

  def({
    name: 'script.large-put',
    desc: 'Support a lot of puts',
    kind: 'make',
    files: {
      '/root/main': `
.script
  for: range 200000
    put "// hello"
  end
.end
`,
    },
  });

  def({
    name: 'script.put-space',
    desc: 'Put with multiple arguments should join with space',
    kind: 'make',
    files: {
      '/root/main': `
.script
  put ".i8 ", 0xff /// ff
.end
`,
    },
  });

  def({
    name: 'script.dot-bytes',
    desc: 'Use dot statement commands inside .script',
    kind: 'make',
    files: {
      '/root/main': `
.script
  i8 0, 1, 2, 3         /// 00 01 02 03
  ib8 0, 1, 2, 3        /// 00 01 02 03
  i8 {0, 1, 2, 3}       /// 00 01 02 03
  ib8 {0, 1, 2, 3}      /// 00 01 02 03
  i8 1.1, 2.9, 3.5, 4   /// 01 02 03 04
  i8 utf8.list 'gba!'   /// 67 62 61 21
  i16 0x0100, 0x0302    /// 00 01 02 03
  ib16 0x0001, 0x0203   /// 00 01 02 03
  i16 {0x0100, 0x0302}  /// 00 01 02 03
  ib16 {0x0001, 0x0203} /// 00 01 02 03
  i16 1.5, 1.9          /// 01 00 01 00
  i32 0x03020100        /// 00 01 02 03
  ib32 0x00010203       /// 00 01 02 03
  i32 {0x03020100}      /// 00 01 02 03
  ib32 {0x00010203}     /// 00 01 02 03
  i32 1.5               /// 01 00 00 00
  i8fill 4              /// 00 00 00 00
  i8fill 4, 3           /// 03 03 03 03
  ib8fill 4             /// 00 00 00 00
  ib8fill 4, 3          /// 03 03 03 03
  i16fill 2             /// 00 00 00 00
  i16fill 2, 9          /// 09 00 09 00
  ib16fill 2            /// 00 00 00 00
  ib16fill 2, 9         /// 00 09 00 09
  i32fill 2             /// 00 00 00 00 00 00 00 00
  i32fill 2, 9          /// 09 00 00 00 09 00 00 00
  ib32fill 2            /// 00 00 00 00 00 00 00 00
  ib32fill 2, 9         /// 00 00 00 09 00 00 00 09
.end
`,
    },
  });

  def({
    name: 'script.dot-bytes-misaligned',
    desc: 'Misaligned data is an error',
    kind: 'make',
    error: true,
    files: {
      '/root/main': `
.script
  i8 0
  i16 0
.end
`,
    },
  });

  def({
    name: 'script.dot-bytes-realigned',
    desc: 'Using align to realign data',
    kind: 'make',
    files: {
      '/root/main': `
.script
  i8 0     /// 00
  align 2  /// 00
  i16 0    /// 00 00
.end
`,
    },
  });

  def({
    name: 'script.printf',
    desc: 'Use printf command',
    kind: 'make',
    stdout: [
      'hello 5',
    ],
    files: {
      '/root/main': `
.script
  printf 'hello %d', 5
.end
`,
    },
  });

  def({
    name: 'script.error',
    desc: 'Use error command',
    kind: 'make',
    error: true,
    files: {
      '/root/main': `
.script
  error 'oh no'
.end
`,
    },
  });

  def({
    name: 'script.circular-i8',
    desc: 'Use i8 with circular lists',
    kind: 'make',
    error: true,
    files: {
      '/root/main': `
.script
  var a = {1, 2, 3}
  list.push a, a
  i8 a
.end
`,
    },
  });

  def({
    name: 'script.json',
    desc: 'Use json.* commands',
    kind: 'make',
    stdout: [
      '0',
      '0',
      '1',
      '1',
      '1',
      '2',
      '2',
      '3',
      '3',
      '4',
      '4',
      '5',
      '5',
      '1',
      'nil',
      '123',
      '-45',
      'hi',
      'yo',
      '{{\'json\'}, {\'json\'}}',
      '{{\'hello\', {\'json\'}}}',
      ' object:',
      ' [one] 1',
      ' [empty] null',
      ' [ar] array:',
      ' [ar] [0] 1',
      ' [ar] [1] 2',
      ' [ar] [2] 3',
      ' [ar2] array:',
      ' [ar2] [0] object:',
      ' [ar2] [0] [one] 1',
      ' [ar2] [1] object:',
      ' [ar2] [1] [two] 2',
      '3',
      '200',
      '300',
      'world',
    ],
    files: {
      '/root/main': `
.script
  'null'              | json.load | json.type | say
  say json.NULL
  'true'              | json.load | json.type | say
  'false'             | json.load | json.type | say
  say json.BOOLEAN
  '123.45'            | json.load | json.type | say
  say json.NUMBER
  '"hello, world"'    | json.load | json.type | say
  say json.STRING
  '[1, 2, 3]'         | json.load | json.type | say
  say json.ARRAY
  '{"hello":"world"}' | json.load | json.type | say
  say json.OBJECT

  'true'  | json.load | json.boolean | say
  'false' | json.load | json.boolean | say

  '123' | json.load | json.number | say
  '-45' | json.load | json.number | say

  '"hi"' | json.load | json.string | say
  '"yo"' | json.load | json.string | say

  '[123, 456]' | json.load | json.array | say

  '{"hello":"world"}' | json.load | json.object | say

  def print_json prefix, data
    var type = json.type data
    if type == json.NULL
      say "$prefix null"
    elseif type == json.BOOLEAN
      say "$prefix \${pick (json.boolean data), "true", "false"}"
    elseif type == json.NUMBER
      say "$prefix \${json.number data}"
    elseif type == json.STRING
      say "$prefix \${json.string data}"
    elseif type == json.ARRAY
      say "$prefix array:"
      for var element, i: json.array data
        print_json "$prefix [$i]", element
      end
    elseif type == json.OBJECT
      say "$prefix object:"
      for var kv, i: json.object data
        var {key, value} = kv
        print_json "$prefix [$key]", value
      end
    end
  end

  print_json '', json.load '{"one":1,"empty":null,"ar":[1,2,3],"ar2":[{"one":1},{"two":2}]}'

  '[1, 2, 3]' | json.load | json.size | say
  '[100, 200, 300]' | json.load | json.get 1 | json.number | say
  '[100, 200, 300]' | json.load | json.get -1 | json.number | say
  '{"hello":"world"}' | json.load | json.get 'hello' | json.string | say
.end
`,
    },
  });
}
