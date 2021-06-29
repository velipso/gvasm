//
// gbasm - Assembler and disassembler for Game Boy Advance homebrew
// by Sean Connelly (@velipso), https://sean.cm
// The Unlicense License
// Project Home: https://github.com/velipso/gbasm
//

import { ITest } from "../itest.ts";

export function load(def: (test: ITest) => void) {
  def({
    name: "expr.neg",
    desc: "Negation",
    kind: "make",
    files: { "/root/main": `.i8 -1, --4, +1, -+-+4  /// ff 04 01 04` },
  });

  def({
    name: "expr.bitnot",
    desc: "Bitwise not",
    kind: "make",
    files: { "/root/main": `.i8 ~14, ~~4  /// f1 04` },
  });

  def({
    name: "expr.not",
    desc: "Logical not",
    kind: "make",
    files: { "/root/main": `.i8 !0, !1, !5  /// 01 00 00` },
  });

  def({
    name: "expr.add",
    desc: "Addition",
    kind: "make",
    files: { "/root/main": `.i8 1 + 2, 3 + 4  /// 03 07` },
  });

  def({
    name: "expr.sub",
    desc: "Subtraction",
    kind: "make",
    files: { "/root/main": `.i8 5 - 2, 14 - 7  /// 03 07` },
  });

  def({
    name: "expr.mul",
    desc: "Multiplication",
    kind: "make",
    files: { "/root/main": `.i8 5 * 2, 3 * 7  /// 0a 15` },
  });

  def({
    name: "expr.div",
    desc: "Division",
    kind: "make",
    files: { "/root/main": `.i8 50 / 10, 56 / 7  /// 05 08` },
  });

  def({
    name: "expr.mod",
    desc: "Modulo",
    kind: "make",
    files: { "/root/main": `.i8 21 % 10, 67 % 8  /// 01 03` },
  });

  def({
    name: "expr.lsl",
    desc: "Logical left shift",
    kind: "make",
    files: { "/root/main": `.i8 1 << 3, 3 << 2  /// 08 0c` },
  });

  def({
    name: "expr.lsr",
    desc: "Logical right shift",
    kind: "make",
    files: { "/root/main": `.i8 100 >>> 2, -1 >>> 30  /// 19 03` },
  });

  def({
    name: "expr.asr",
    desc: "Sign-extended right shift",
    kind: "make",
    files: { "/root/main": `.i8 100 >> 2, -1 >> 30  /// 19 ff` },
  });

  def({
    name: "expr.bitand",
    desc: "Bitwise and",
    kind: "make",
    files: { "/root/main": `.i8 0xf5 & 0xe3, 0xff & 0x00  /// e1 00` },
  });

  def({
    name: "expr.bitor",
    desc: "Bitwise or",
    kind: "make",
    files: { "/root/main": `.i8 0xf5 | 0xe3, 0xff | 0x00  /// f7 ff` },
  });

  def({
    name: "expr.bitxor",
    desc: "Bitwise xor",
    kind: "make",
    files: { "/root/main": `.i8 0xf5 ^ 0xe3, 0xff ^ 0x00  /// 16 ff` },
  });

  def({
    name: "expr.lt",
    desc: "Less than",
    kind: "make",
    files: { "/root/main": `.i8 1 < 2, 1 < -5, 1 < 1  /// 01 00 00` },
  });

  def({
    name: "expr.lte",
    desc: "Less than or equal",
    kind: "make",
    files: { "/root/main": `.i8 1 <= 2, 1 <= -5, 1 <= 1  /// 01 00 01` },
  });

  def({
    name: "expr.gt",
    desc: "Greater than",
    kind: "make",
    files: { "/root/main": `.i8 1 > 2, 1 > -5, 1 > 1  /// 00 01 00` },
  });

  def({
    name: "expr.gte",
    desc: "Greater than or equal",
    kind: "make",
    files: { "/root/main": `.i8 1 >= 2, 1 >= -5, 1 >= 1  /// 00 01 01` },
  });

  def({
    name: "expr.eq",
    desc: "Equal",
    kind: "make",
    files: { "/root/main": `.i8 1 == 2, 1 == -5, 1 == 1  /// 00 00 01` },
  });

  def({
    name: "expr.neq",
    desc: "Not equal",
    kind: "make",
    files: { "/root/main": `.i8 1 != 2, 1 != -5, 1 != 1  /// 01 01 00` },
  });

  def({
    name: "expr.and",
    desc: "Logical and",
    kind: "make",
    files: {
      "/root/main": `.i8 0 && 0, 4 && 0, 0 && 2, 6 && 8  /// 00 00 00 01`,
    },
  });

  def({
    name: "expr.or",
    desc: "Logical or",
    kind: "make",
    files: {
      "/root/main": `.i8 0 || 0, 4 || 0, 0 || 2, 6 || 8  /// 00 01 01 01`,
    },
  });

  def({
    name: "expr.ternary",
    desc: "Ternary operator",
    kind: "make",
    files: {
      "/root/main": `.i8 5 ? 2 : 3, 0 ? 6 : 9 /// 02 09`,
    },
  });

  def({
    name: "expr.precedence",
    desc: "Operator precedence",
    kind: "make",
    files: {
      "/root/main": `
.i8 3 + 4 * 5      /// 17
.i8 (3 + 4) * 5    /// 23
.i8 3 * 4 + 5      /// 11
.i8 3 * 4 / 5      /// 02
.i8 3 * (4 / 5)    /// 00
.i8 9 / 4 * 5      /// 0a
.i8 9 / (4 * 5)    /// 00
.i8 3 * 7 % 4      /// 01
.i8 3 % 7 * 4      /// 0c
.i8 14 & 3 == 2    /// 01
.i8 14 & (3 == 2)  /// 00
.i8 2 == 14 & 3    /// 01
.i8 3 & 7 == 7     /// 00
`,
    },
  });
}
