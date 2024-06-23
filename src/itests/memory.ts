//
// gvasm - Assembler and disassembler for Game Boy Advance homebrew
// by Sean Connelly (@velipso), https://sean.fun
// Project Home: https://github.com/velipso/gvasm
// SPDX-License-Identifier: 0BSD
//

import { ITest } from '../itest.ts';

export function load(def: (test: ITest) => void) {
  def({
    name: 'memory.basic',
    desc: 'Basic usage of allocating to IWRAM and EWRAM',
    kind: 'make',
    stdout: [
      'i1 03000000',
      'e1 02000000',
      'i2 03000008',
      'i3 0300000C',
      'e2 02000004',
    ],
    files: {
      '/root/main': `
.import './config' { FOO }

.struct i1 = iwram
  .i32 i1[FOO]
.end

.struct e1 = ewram
  .i32 e1
.end

.struct i2 = iwram
  .i32 i2
.end

.include './config'

.printf "i1 %08X", i1
.printf "e1 %08X", e1
.printf "i2 %08X", i2
`,
      '/root/config': `
.def FOO = 2

.struct i3 = iwram
  .i32 i3
.end

.struct e2 = ewram
  .i16 e2
.end

.printf "i3 %08X", i3
.printf "e2 %08X", e2
`,
    },
  });

  def({
    name: 'memory.iwram-no-overflow',
    desc: 'IWRAM can allocate 32k',
    kind: 'make',
    files: {
      '/root/main': `
.struct foo = iwram
  .i8 data[16 * 1024 - 256] // 256 bytes reserved for GBA BIOS
.end
.struct bar = iwram
  .i8 data[16 * 1024]
.end
.struct zero1 = iwram
.end
.struct zero2 = iwram
.end
`,
    },
  });

  def({
    name: 'memory.iwram-overflow',
    desc: 'Overflowing IWRAM will error',
    kind: 'make',
    error: true,
    files: {
      '/root/main': `
.struct foo = iwram
  .i8 data[16 * 1024 - 256] // 256 bytes reserved for GBA BIOS
.end
.struct bar = iwram
  .i8 data[16 * 1024]
.end
.struct baz = iwram
  .i8 data
.end
`,
    },
  });

  def({
    name: 'memory.ewram-no-overflow',
    desc: 'EWRAM can allocate 256k',
    kind: 'make',
    files: {
      '/root/main': `
.struct foo = ewram
  .i8 data[128 * 1024]
.end
.struct bar = ewram
  .i8 data[128 * 1024]
.end
`,
    },
  });

  def({
    name: 'memory.ewram-overflow',
    desc: 'Overflowing EWRAM will error',
    kind: 'make',
    error: true,
    files: {
      '/root/main': `
.struct foo = ewram
  .i8 data[128 * 1024]
.end
.struct bar = ewram
  .i8 data[128 * 1024]
.end
.struct baz = ewram
  .i8 data
.end
`,
    },
  });

  def({
    name: 'memory.multiple-files',
    desc: 'Memory allocation across disparate files',
    kind: 'make',
    stdout: [
      'one = 03000000',
      'two = 03000004',
      'three = 0300000c',
    ],
    files: {
      '/root/main': `
.import './two' { two }
.import './three' { three }
.struct one = iwram
  .i32 one
.end
.include './two'
.include './three'
.printf "one = %08x", one
.printf "two = %08x", two
.printf "three = %08x", three
`,
      '/root/two': `
.struct two = iwram
  .i32 two[2]
.end
`,
      '/root/three': `
.struct three = iwram
  .i32 three[3]
.end
`,
    },
  });
}
