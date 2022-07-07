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
x.log "r0 = %d", r0
subs  r0, #1
bne   @again
x.log "done"
`,
    },
  });
}
