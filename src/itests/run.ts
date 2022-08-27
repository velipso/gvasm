//
// gvasm - Assembler and disassembler for Game Boy Advance homebrew
// by Sean Connelly (@velipso), https://sean.cm
// Project Home: https://github.com/velipso/gvasm
// SPDX-License-Identifier: 0BSD
//

import { ITest } from '../itest.ts';

export function load(def: (test: ITest) => void) {
  def({
    name: 'run.arm.basic',
    desc: 'Basic usage of run using ARM mode',
    kind: 'run',
    stdout: [
      'r0 = 5',
      'r0 = 4',
      'r0 = 3',
      'r0 = 2',
      'r0 = 1',
      'r0 = 0',
      'r0 = 1',
      'r0 = 2',
      'r0 = 3',
      'r0 = 4',
      'done',
    ],
    files: {
      '/root/main': `
movs  r0, #5
@again:
_log  "r0 = %d", r0
subs  r0, #1
bne   @again
@again2:
_log  "r0 = %d", r0
add   r0, #1
cmp   r0, #5
blt   @again2
_log  "done"
_exit
_log  "shouldn't run"
`,
    },
  });

  def({
    name: 'run.arm.ldr-pool',
    desc: 'ARM ldr from pool',
    kind: 'run',
    stdout: [
      '12345678',
      '7856',
      '12345678',
      '7856',
    ],
    files: {
      '/root/main': `
ldr   r0, =@data
nop
nop
_log  "%08x", [r0]
_log  "%04x", b16[r0]
ldr   r0, =@data
_log  "%08x", [r0]
_log  "%04x", b16[r0]
_exit
@data:
.i32  0x12345678
.pool
`,
    },
  });

  def({
    name: 'run.thumb.basic',
    desc: 'Basic usage of run using Thumb mode',
    kind: 'run',
    stdout: [
      'r0 = 5',
      'r0 = 4',
      'r0 = 3',
      'r0 = 2',
      'r0 = 1',
      'r0 = 0',
      'r0 = 1',
      'r0 = 2',
      'r0 = 3',
      'r0 = 4',
      'done',
    ],
    files: {
      '/root/main': `
.thumb
movs  r0, #5
@again:
_log  "r0 = %d", r0
subs  r0, #1
bne   @again
@again2:
_log  "r0 = %d", r0
adds  r0, #1
cmp   r0, #5
blt   @again2
_log  "done"
_exit
_log  "shouldn't run"
`,
    },
  });
}
