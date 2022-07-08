//
// gvasm - Assembler and disassembler for Game Boy Advance homebrew
// by Sean Connelly (@velipso), https://sean.cm
// The Unlicense License
// Project Home: https://github.com/velipso/gvasm
//

import { ITest } from '../itest.ts';

export function load(def: (test: ITest) => void) {
  def({
    name: 'run.basic',
    desc: 'Basic usage of run',
    kind: 'run',
    stdout: [
      'r0 = 5',
      'r0 = 4',
      'r0 = 3',
      'r0 = 2',
      'r0 = 1',
      'done',
    ],
    files: {
      '/root/main': `
movs  r0, #5
@again:
_log  "r0 = %d", r0
subs  r0, #1
bne   @again
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
}