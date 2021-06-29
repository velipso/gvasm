//
// gbasm - Assembler and disassembler for Game Boy Advance homebrew
// by Sean Connelly (@velipso), https://sean.cm
// The Unlicense License
// Project Home: https://github.com/velipso/gbasm
//

import { ITest } from "../itest.ts";

export function load(def: (test: ITest) => void) {
  def({
    name: "arm.bx",
    desc: "Branch and exchange",
    kind: "make",
    files: {
      "/root/main": `
bx r9     /// 19 ff 2f e1
bxeq r14  /// 1e ff 2f 01
`,
    },
  });

  def({
    name: "arm.b",
    desc: "Branch",
    kind: "make",
    files: {
      "/root/main": `
@L1: b 0x08000008  /// 00 00 00 ea
@L2: b @L1         /// fd ff ff ea
@L3: bne @L3       /// fe ff ff 1a
bcs @L4            /// 01 00 00 2a
.i32 0, 0          /// 00 00 00 00 00 00 00 00
@L4:
`,
    },
  });

  def({
    name: "arm.b-misaligned",
    desc: "Branch misaligned",
    kind: "make",
    error: true,
    files: {
      "/root/main": `
b @L1  /// 00 00 00 00
.i8 0  /// 00
@L1:
`,
    },
  });

  // TODO: bl
}
