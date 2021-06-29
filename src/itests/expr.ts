//
// gbasm - Assembler and disassembler for Game Boy Advance homebrew
// by Sean Connelly (@velipso), https://sean.cm
// The Unlicense License
// Project Home: https://github.com/velipso/gbasm
//

import { ITest } from "../itest.ts";

export function load(def: (test: ITest) => void) {
  def({
    name: "expr.simple",
    desc: "Simple expressions",
    kind: "make",
    files: {
      "/root/main": `
.u8 0, 1, 2, -1    /// 00 01 02 ff
.u8 1 + 2, 3 + 4   /// 03 07
.u8 2 * 3 + 4      /// 0a
.u8 2 + 3 * 4      /// 0e
.u8 3 / 4          /// 00
.u8 2 * 3 / 4      /// 01
.u8 2 * (3 / 4)    /// 00
.u8 100 % 7        /// 02
.u8 1 << 2         /// 04
.u8 8 >> 2         /// 02
.u8 -1 >> 1        /// ff
.u8 -1 >>> 1       /// ff
.u8 -1 >> 30       /// ff
.u8 -1 >>> 30      /// 03
.u8 0xab           /// ab
.u8 -1 & 0xab      /// ab
.u8 15 & 0xab      /// 0b
.u8 15 | 0xab      /// af
.u8 15 ^ 0xab      /// a4
.u8 ~0             /// ff
.u8 ~0xab          /// 54
.u8 2 + 3 & 4      /// 04
.u8 2 + (3 & 4)    /// 02
.u8 --++--++~~1    /// 01
.u8 !0             /// 01
.u8 !1             /// 00
.u8 1 ? 2 : 3      /// 02
.u8 !1 ? 2 : 3     /// 03
`,
    },
  });
}
