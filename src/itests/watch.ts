//
// gvasm - Assembler and disassembler for Game Boy Advance homebrew
// by Sean Connelly (@velipso), https://sean.cm
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
}
