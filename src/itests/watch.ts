//
// gvasm - Assembler and disassembler for Game Boy Advance homebrew
// by Sean Connelly (@velipso), https://sean.fun
// Project Home: https://github.com/velipso/gvasm
// SPDX-License-Identifier: 0BSD
//

import { ITest } from '../itest.ts';

export function load(def: (test: ITest) => void) {
  def({
    name: 'watch.basic',
    desc: 'Basic watch behavior',
    kind: 'watch',
    logBytes: true,
    stdout: [
      'read: /root/main',
      '> 78 56 34 12',
      'watch: /root/main',
      'read: /root/main',
      '> 21 43 65 87',
      'watch: /root/main',
    ],
    history: [{
      '/root/main': `.i32 0x12345678`,
    }, {
      '/root/main': `.i32 0x87654321`,
    }],
  });

  def({
    name: 'watch.rename',
    desc: 'Renaming a file',
    kind: 'watch',
    logBytes: true,
    stdout: [
      'read: /root/main',
      'read: /root/test',
      '> 01 02',
      'watch: /root/main /root/test',
      '! root/main:2:10: Failed to import file: /root/test',
      'watch: /root/main /root/test',
      'read: /root/main',
      'read: /root/test2',
      '> 01 02',
      'watch: /root/main /root/test2',
    ],
    history: [{
      '/root/main': `.i8 1\n.include 'test'`,
      '/root/test': `.i8 2`,
    }, {
      '/root/test': false,
      '/root/test2': `.i8 2`,
    }, {
      '/root/main': `.i8 1\n.include 'test2'`,
    }],
  });

  def({
    name: 'watch.include-change',
    desc: 'Inserting byte during include',
    kind: 'watch',
    logBytes: true,
    stdout: [
      'read: /root/main',
      'read: /root/test',
      '> 01 02 04',
      'watch: /root/main /root/test',
      'read: /root/test',
      '> 01 02 03 04',
      'watch: /root/main /root/test',
    ],
    history: [{
      '/root/main': `.i8 1\n.include 'test'\n.i8 4`,
      '/root/test': `.i8 2`,
    }, {
      '/root/test': `.i8 2, 3`,
    }],
  });

  def({
    name: 'watch.embed',
    desc: 'Changing the embedded file',
    kind: 'watch',
    logBytes: true,
    stdout: [
      'read: /root/main',
      'read: /root/test',
      '> 01 02 04',
      'watch: /root/main /root/test',
      'read: /root/test',
      '> 01 02 03 04',
      'watch: /root/main /root/test',
    ],
    history: [{
      '/root/main': `.i8 1\n.embed 'test'\n.i8 4`,
      '/root/test': `/// 02`,
    }, {
      '/root/test': `/// 02 03`,
    }],
  });

  def({
    name: 'watch.embed-script',
    desc: 'Changing the embedded file in a script',
    kind: 'watch',
    logBytes: true,
    rawInclude: true,
    stdout: [
      'read: /root/main',
      'read: /root/test',
      '> 01 61 04',
      'watch: /root/main /root/test',
      'read: /root/main',
      'read: /root/test',
      '> 01 61 62 04',
      'watch: /root/main /root/test',
    ],
    history: [{
      '/root/main': `
.i8 1
.script
  i8 utf8.list embed 'test'
.end
.i8 4
`,
      '/root/test': `a`,
    }, {
      '/root/test': `ab`,
    }],
  });

  def({
    name: 'watch.include-script',
    desc: 'Changing the included file in a script',
    kind: 'watch',
    logBytes: true,
    rawInclude: true,
    stdout: [
      'read: /root/main',
      'read: /root/test',
      '> 01 02 04',
      'watch: /root/main /root/test',
      'read: /root/main',
      'read: /root/test',
      '> 01 02 03 04',
      'watch: /root/main /root/test',
    ],
    history: [{
      '/root/main': `
.i8 1
.script
  include 'test'
  test
.end
.i8 4
`,
      '/root/test': `
def test
  i8 2
end
`,
    }, {
      '/root/test': `
def test
  i8 2, 3
end
`,
    }],
  });

  def({
    name: 'watch.rerun-scripts',
    desc: 'Rerun scripts if they depend on a symbol in a changed file',
    kind: 'watch',
    logBytes: true,
    stdout: [
      'read: /root/main',
      'read: /root/test1',
      'read: /root/test2',
      '> 06',
      'watch: /root/main /root/test1 /root/test2',
      'read: /root/test1',
      'read: /root/test2',
      '> 07',
      'watch: /root/main /root/test1 /root/test2',
    ],
    history: [{
      '/root/main': `
.import 'test1' { foo }
.i8 foo
`,
      '/root/test1': `
.import 'test2' { bar }
.script
  export foo = 1 + lookup bar
.end
`,
      '/root/test2': `.def bar = 5`,
    }, {
      '/root/test2': `.def bar = 6`,
    }],
  });

  def({
    name: 'watch.cache-intermediate',
    desc: 'Verify that intermediate imports are cached',
    kind: 'watch',
    logBytes: true,
    stdout: [
      'read: /root/main',
      'read: /root/test1',
      'read: /root/test2',
      '> 03',
      'watch: /root/main /root/test1 /root/test2',
      'read: /root/test2',
      '> 04',
      'watch: /root/main /root/test1 /root/test2',
    ],
    history: [{
      '/root/main': `
.import 'test1' { foo }
.i8 foo
`,
      '/root/test1': `
.import 'test2' { bar }
.def foo = bar + 1
`,
      '/root/test2': `
.script
  export bar = 2
.end
`,
    }, {
      '/root/test2': `
.script
  export bar = 3
.end
`,
    }],
  });

  def({
    name: 'watch.import-replay',
    desc: 'Verify import replay happens in correct order',
    kind: 'watch',
    logBytes: true,
    stdout: [
      'read: /root/main',
      'read: /root/test1',
      'read: /root/test2',
      '> 09',
      'watch: /root/main /root/test1 /root/test2',
      'read: /root/test1',
      '> 0a',
      'watch: /root/main /root/test1 /root/test2',
    ],
    history: [{
      '/root/main': `
.import 'test1' { foo }
.import 'test2' { bar }
.def baz = 3
.i8 foo + bar
`,
      '/root/test1': `
.import 'main' { baz }
.def foo = 2 + baz
`,
      '/root/test2': `
.def bar = 4
`,
    }, {
      '/root/test1': `
.import 'main' { baz }
.def foo = 3 + baz
`,
    }],
  });

  def({
    name: 'watch.failed-imports',
    desc: 'Failed imports should work after file exists',
    kind: 'watch',
    logBytes: true,
    stdout: [
      'read: /root/main',
      '! root/main:2:1: Failed to import file: /root/test',
      'watch: /root/main /root/test',
      'read: /root/test',
      '> 01',
      'watch: /root/main /root/test',
    ],
    history: [{
      '/root/main': `
.import 'test' { foo }
.i8 foo
`,
    }, {
      '/root/test': `
.def foo = 1
`,
    }],
  });

  def({
    name: 'watch.failed-includes',
    desc: 'Failed includes should work after file exists',
    kind: 'watch',
    logBytes: true,
    stdout: [
      'read: /root/main',
      '! root/main:3:10: Failed to import file: /root/test',
      'watch: /root/main /root/test',
      'read: /root/test',
      '> 02 01',
      'watch: /root/main /root/test',
    ],
    history: [{
      '/root/main': `
.import 'test' { foo }
.include 'test'
.i8 foo
`,
    }, {
      '/root/test': `
.def foo = 1
.i8 2
`,
    }],
  });

  def({
    name: 'watch.import-deleted',
    desc: 'Deleted file that was imported should recover after placing back',
    kind: 'watch',
    logBytes: true,
    stdout: [
      'read: /root/main',
      'read: /root/test',
      '> 01',
      'watch: /root/main /root/test',
      '! root/main:2:1: Failed to import file: /root/test',
      'watch: /root/main /root/test',
      'read: /root/test',
      '> 02',
      'watch: /root/main /root/test',
    ],
    history: [{
      '/root/main': `
.import 'test' { foo }
.i8 foo
`,
      '/root/test': `
.def foo = 1
`,
    }, {
      '/root/test': false,
    }, {
      '/root/test': `
.def foo = 2
`,
    }],
  });

  def({
    name: 'watch.lsr',
    desc: 'Instructions that have constant numbers with unknown expressions should work',
    kind: 'watch',
    logBytes: true,
    stdout: [
      'read: /root/main',
      'read: /root/shift',
      '> 01 00 b0 e1 01 00 b0 e1',
      '> a1 00 b0 e1',
      'watch: /root/main /root/shift',
      'read: /root/main',
      'read: /root/shift',
      '> a1 00 b0 e1 01 00 b0 e1',
      '> a1 00 b0 e1',
      'watch: /root/main /root/shift',
    ],
    history: [{
      '/root/main': `
.import 'shift' { shift }
.arm
movs r0, r1, lsr #shift
movs r0, r1, lsr #0
movs r0, r1, lsr #1
`,
      '/root/shift': `
.def shift = 0
`,
    }, {
      '/root/shift': `
.def shift = 1
`,
    }],
  });

  def({
    name: 'watch.align',
    desc: 'Align dependencies should propagate',
    kind: 'watch',
    logBytes: true,
    stdout: [
      'read: /root/main',
      'read: /root/start',
      '> 01 01 01 01 03 04',
      'watch: /root/main /root/start',
      'read: /root/main',
      'read: /root/start',
      '> 02 02 02 02 02 02 02 02',
      '> 03 08',
      'watch: /root/main /root/start',
    ],
    history: [{
      '/root/main': `
.import 'start' { start, value }
.base 0
.i8 value
.align start, value
.i8 3

.struct foo
  .i8 one
  .align start
  .i8 two
.end
.i8 foo.two
`,
      '/root/start': `
.def start = 4
.def value = 1
`,
    }, {
      '/root/start': `
.def start = 8
.def value = 2
`,
    }],
  });

  def({
    name: 'watch.fill',
    desc: 'Fill dependencies should propagate',
    kind: 'watch',
    logBytes: true,
    stdout: [
      'read: /root/main',
      'read: /root/size',
      '> 01 01 01 01 03',
      'watch: /root/main /root/size',
      'read: /root/main',
      'read: /root/size',
      '> 02 02 02 02 02 02 02 02',
      '> 03',
      'watch: /root/main /root/size',
    ],
    history: [{
      '/root/main': `
.import 'size' { size, value }
.base 0
.i8fill size, value
.i8 3
`,
      '/root/size': `
.def size = 4
.def value = 1
`,
    }, {
      '/root/size': `
.def size = 8
.def value = 2
`,
    }],
  });

  def({
    name: 'watch.base',
    desc: 'Base dependencies should propagate',
    kind: 'watch',
    logBytes: true,
    stdout: [
      'read: /root/main',
      'read: /root/start',
      '> 08 00 00 00 08 00 00 00',
      'watch: /root/main /root/start',
      'read: /root/main',
      'read: /root/start',
      '> 10 00 00 00 10 00 00 00',
      'watch: /root/main /root/start',
    ],
    history: [{
      '/root/main': `
.import 'start' { start }
.arm
.base start
bar:
.i32 _here
.i32 bar
`,
      '/root/start': `
.def start = 8
`,
    }, {
      '/root/start': `
.def start = 16
`,
    }],
  });

  def({
    name: 'watch.if',
    desc: 'If dependencies should propagate',
    kind: 'watch',
    logBytes: true,
    stdout: [
      'read: /root/main',
      'read: /root/cond',
      '> 06 06',
      'watch: /root/cond /root/main',
      'read: /root/main',
      'read: /root/cond',
      '> 07 08',
      'watch: /root/cond /root/main',
    ],
    history: [{
      '/root/main': `
.import 'cond' { cond }
.if cond
  .i8 6
.else
  .i8 7
.end
.struct foo
  .i32 one
  .if cond
    .i8 two
    .i8 three
    .i16 four
  .else
    .i16 two
    .i16 three
    .i32 four
  .end
.end
.i8 foo.four
`,
      '/root/cond': `
.def cond = 1
`,
    }, {
      '/root/cond': `
.def cond = 0
`,
    }],
  });

  def({
    name: 'watch.add-neg-sp',
    desc: 'Negative words should work',
    kind: 'watch',
    logBytes: true,
    stdout: [
      'read: /root/main',
      'read: /root/offset',
      '> 02 b0 02 b0 82 b0',
      'watch: /root/main /root/offset',
      'read: /root/main',
      'read: /root/offset',
      '> 82 b0 02 b0 82 b0',
      'watch: /root/main /root/offset',
    ],
    history: [{
      '/root/main': `
.import 'offset' { offset }
.thumb
add sp, #offset
add sp, #8
add sp, #-8
`,
      '/root/offset': `
.def offset = 8
`,
    }, {
      '/root/offset': `
.def offset = -8
`,
    }],
  });
}
