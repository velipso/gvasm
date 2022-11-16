//
// gvasm - Assembler and disassembler for Game Boy Advance homebrew
// by Sean Connelly (@velipso), https://sean.cm
// Project Home: https://github.com/velipso/gvasm
// SPDX-License-Identifier: 0BSD
//

import { ITest } from '../itest.ts';

export function load(def: (test: ITest) => void) {
  def({
    name: 'files.include-basic',
    desc: 'Include another file',
    kind: 'make',
    files: {
      '/root/main': `
.i32 0            /// 00 00 00 00
.include "hello"  /// 01 00 00 00
.i32 -1           /// ff ff ff ff
`,
      '/root/hello': `.i32 1`,
    },
  });

  def({
    name: 'files.include-multiple',
    desc: 'Include another file multiple times',
    kind: 'make',
    files: {
      '/root/main': `
.i32 0            /// 00 00 00 00
.include "hello"  /// 01 00 00 00
.include "hello"  /// 01 00 00 00
.include "hello"  /// 01 00 00 00
.i32 -1           /// ff ff ff ff
`,
      '/root/hello': `.i32 1`,
    },
  });

  def({
    name: 'files.include-relative',
    desc: 'Include files relative to included file',
    kind: 'make',
    files: {
      '/root/main': `
.i32 0           /// 00 00 00 00
.include "../test/hello"
/// 01 00 00 00
/// 03 00 00 00
/// 02 00 00 00
.i32 -1          /// ff ff ff ff
`,
      '/test/hello': `
.i32 1
.include "world"
.i32 2
`,
      '/test/world': `.i32 3`,
      '/root/world': `.error "Wrong"`,
    },
  });

  def({
    name: 'files.include-subdir',
    desc: 'Include files in subdirectory',
    kind: 'make',
    files: {
      '/root/main': `
.i32 0           /// 00 00 00 00
.include "one/hello"
/// 01 00 00 00
/// 02 00 00 00
/// 03 00 00 00
.i32 -1          /// ff ff ff ff
`,
      '/root/one/hello': `
.i32 1
.include "./two/another"
`,
      '/root/one/two/another': `
.i32 2
.include "../../onemore"
`,
      '/root/onemore': `.i32 3`,
    },
  });

  def({
    name: 'files.include-error',
    desc: 'Include a missing file',
    kind: 'make',
    error: true,
    files: {
      '/root/main': `
.i32 0
.include "hello"
.i32 -1
`,
    },
  });

  def({
    name: 'files.include-circular',
    desc: 'Include circular files',
    kind: 'make',
    error: true,
    files: {
      '/root/main': `.include "cir0"`,
      '/root/cir0': `.include "cir1"`,
      '/root/cir1': `.include "cir2"`,
      '/root/cir2': `.include "cir3"`,
      '/root/cir3': `.include "cir4"`,
      '/root/cir4': `.include "cir5"`,
      '/root/cir5': `.include "cir6"`,
      '/root/cir6': `.include "cir7"`,
      '/root/cir7': `.include "cir0"`,
    },
  });

  def({
    name: 'files.include-self',
    desc: 'Include main file from main file',
    kind: 'make',
    error: true,
    files: {
      '/root/main': `.include "main"`,
    },
  });

  def({
    name: 'files.import-circular',
    desc: 'Import circular files',
    kind: 'make',
    stdout: ['FOO = 2', 'BAR = 1'],
    files: {
      '/root/main': `
.import 'test' { FOO }
.def BAR = 1
.printf "FOO = %d", FOO
`,
      '/root/test': `
.import 'main' { BAR }
.def FOO = 2
.printf "BAR = %d", BAR
`,
    },
  });

  def({
    name: 'files.embed-basic',
    desc: 'Embed another file',
    kind: 'make',
    files: {
      '/root/main': `
.i32 0          /// 00 00 00 00
.embed "hello"  /// 12 34 56 78
.i32 -1         /// ff ff ff ff
`,
      '/root/hello': `/// 12 34 56 78`,
    },
  });

  def({
    name: 'files.embed-multiple',
    desc: 'Embed another file multiple times',
    kind: 'make',
    files: {
      '/root/main': `
.i32 0          /// 00 00 00 00
.embed "hello"  /// 12 34 56 78
.embed "hello"  /// 12 34 56 78
.embed "hello"  /// 12 34 56 78
.i32 -1         /// ff ff ff ff
`,
      '/root/hello': `/// 12 34 56 78`,
    },
  });

  def({
    name: 'files.embed-relative',
    desc: 'Embed files relative to included file',
    kind: 'make',
    files: {
      '/root/main': `
.i32 0           /// 00 00 00 00
.include "../test/hello"
/// 01 00 00 00
/// 12 34 56 78
/// 02 00 00 00
.i32 -1          /// ff ff ff ff
`,
      '/test/hello': `
.i32 1
.embed "world"
.i32 2
`,
      '/test/world': `/// 12 34 56 78`,
      '/root/world': `/// 00 00 00 00`,
    },
  });

  def({
    name: 'files.embed-subdir',
    desc: 'Embed files in subdirectory',
    kind: 'make',
    files: {
      '/root/main': `
.i32 0           /// 00 00 00 00
.include "one/hello"
/// 01 00 00 00
/// 02 00 00 00
/// 12 34 56 78
.i32 -1          /// ff ff ff ff
`,
      '/root/one/hello': `
.i32 1
.include "./two/another"
`,
      '/root/one/two/another': `
.i32 2
.embed "../../onemore"
`,
      '/root/onemore': `/// 12 34 56 78`,
    },
  });

  def({
    name: 'files.embed-error',
    desc: 'Embed a missing file',
    kind: 'make',
    error: true,
    files: {
      '/root/main': `
.i32 0
.embed "hello"
.i32 -1
`,
    },
  });

  def({
    name: 'files.import-error',
    desc: 'Import a missing file',
    kind: 'make',
    error: true,
    files: {
      '/root/main': `
.import 'foo' { foo }
.i32 0
`,
    },
  });

  def({
    name: 'files.import-struct-scope',
    desc: 'A struct being imported will use the correct scope',
    kind: 'make',
    files: {
      '/root/main': `
.def FOO = 1
.struct bar
  .i8 baz[FOO]
.end
.include 'test' /// 01
`,
      '/root/test': `
.import 'main' { bar }
.i8 bar.baz._length
`,
    },
  });

  def({
    name: 'files.order-of-execution',
    desc: 'Print messages in each phase of execution',
    kind: 'make',
    stdout: [
      'first = 1',
      'second = 2',
      'fourth = 4',
    ],
    files: {
      '/root/main': `
.import 'test' { fourth }
.base 0

.printf "fourth = %d", fourth
.i8 third  /// 03

.def third = _base + 3

.include 'test'
`,
      '/root/test': `
.def first = 1

.printf "second = %d", second
.printf "first = %d", first

.def second = 2
.def fourth = _here + 3
`,
    },
  });
}
