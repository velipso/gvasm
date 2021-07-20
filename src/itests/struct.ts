//
// gvasm - Assembler and disassembler for Game Boy Advance homebrew
// by Sean Connelly (@velipso), https://sean.cm
// The Unlicense License
// Project Home: https://github.com/velipso/gvasm
//

import { ITest } from "../itest.ts";

export function load(def: (test: ITest) => void) {
  def({
    name: "struct.basic",
    desc: "Basic usage of .struct",
    kind: "make",
    files: {
      "/root/main": `
.struct $s
  .s8 one, two
  .s16 three
  .s32 four
.end

.i8 $s.one    /// 00
.i8 $s.two    /// 01
.i8 $s.three  /// 02
.i8 $s.four   /// 04
`,
    },
  });

  def({
    name: "struct.align",
    desc: "Struct members should align correctly",
    kind: "make",
    files: {
      "/root/main": `
.struct $s
  .s8 one
  .s32 two
  .s8 three
  .s16 four
  .s8 five
  .s32 six
.end

.i8 $s.one    /// 00
.i8 $s.two    /// 04
.i8 $s.three  /// 08
.i8 $s.four   /// 0a
.i8 $s.five   /// 0c
.i8 $s.six    /// 10
`,
    },
  });

  def({
    name: "struct.nested",
    desc: "Structs can contain structs",
    kind: "make",
    files: {
      "/root/main": `
.struct $s
  .s8 one
  .struct two
    .s16 one
    .s8 two
    .s32 three
  .end
  .s8 three
  .s16 four
.end

.i8 $s.one        /// 00
.i8 $s.two.one    /// 02
.i8 $s.two.two    /// 04
.i8 $s.two.three  /// 08
.i8 $s.three      /// 0c
.i8 $s.four       /// 0e
`,
    },
  });

  def({
    name: "struct.if",
    desc: "Structs can have conditional fields",
    kind: "make",
    files: {
      "/root/main": `
.struct $s
  .s8 one, two
  .if 0
    .s32 three
  .else
    .s16 three
  .end
  .s32 four
.end

.i8 $s.one    /// 00
.i8 $s.two    /// 01
.i8 $s.three  /// 02
.i8 $s.four   /// 04
`,
    },
  });

  def({
    name: "struct.reject-regular",
    desc: "Reject regular statements inside .struct",
    kind: "make",
    error: true,
    files: {
      "/root/main": `
.struct $a
mov r0, r1
.end
`,
    },
  });

  def({
    name: "struct.array",
    desc: "Arrays inside structs",
    kind: "make",
    files: {
      "/root/main": `
.struct $s
  .s16 one[5]
  .s32 two
.end

.i8 $s.one         /// 00
.i8 $s.one.length  /// 05
.i8 $s.one.bytes   /// 0a
.i8 $s.two         /// 0c
.i8 $s.two.length  /// 01
.i8 $s.two.bytes   /// 04
`,
    },
  });
}
