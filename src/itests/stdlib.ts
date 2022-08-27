//
// gvasm - Assembler and disassembler for Game Boy Advance homebrew
// by Sean Connelly (@velipso), https://sean.cm
// Project Home: https://github.com/velipso/gvasm
// SPDX-License-Identifier: 0BSD
//

import { ITest } from '../itest.ts';

export function load(def: (test: ITest) => void) {
  def({
    name: 'stdlib.registers',
    desc: 'Validate register names are equal',
    kind: 'make',
    stdout: ['success'],
    files: {
      '/root/main': `
.stdlib
.script
  for var dma: range 4
    put ".if \\$REG_DMA\${dma}SAD != \\$REG_DMA\${dma}SRC"
    put '  .error "DMASAD != DMASRC"'
    put '.end'
    put ".if \\$REG_DMA\${dma}DAD != \\$REG_DMA\${dma}DST"
    put '  .error "DMADAD != DMADST"'
    put '.end'
    put ".if \\$REG_DMA\${dma}CNT_L != \\$REG_DMA\${dma}LEN"
    put '  .error "DMACNT_L != DMALEN"'
    put '.end'
    put ".if \\$REG_DMA\${dma}CNT_H != \\$REG_DMA\${dma}CNT"
    put '  .error "DMACNT_H != DMACNT"'
    put '.end'
  end
  for var tm: range 4
    put ".if \\$REG_TM\${tm}CNT_L != \\$REG_TM\${tm}D || \\$REG_TM\${tm}CNT_L != \\$REG_TM\${tm}VAL"
    put '  .error "TMCNT_L != TMD != TMVAL"'
    put '.end'
    put ".if \\$REG_TM\${tm}CNT_H != \\$REG_TM\${tm}CNT"
    put '  .error "TMCNT_H != TMCNT"'
    put '.end'
  end
.end
.if $REG_SIODATA32 != $REG_SIOMULTI0
  .error "SIODATA32 != SIOMULTI0"
.end
.if $REG_SIOMLT_SEND != $REG_SIODATA8
  .error "SIOMLT_SEND != SIODATA8"
.end
.if $REG_RCNT != $REG_SIOMODE2
  .error "RCNT != SIOMODE2"
.end
.if $REG_JOYCNT != $REG_HS_CTRL
  .error "JOYCNT != HS_CTRL"
.end
.if $REG_JOY_RECV != $REG_JOYRE
  .error "JOY_RECV != JOYRE"
.end
.if $REG_JOY_TRANS != $REG_JOYTR
  .error "JOY_TRANS != JOYTR"
.end
.if $REG_JOYSTAT != $REG_JSTAT
  .error "JOYSTAT != JSTAT"
.end
.printf 'success'
`,
    },
  });
}
