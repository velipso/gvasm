//
// gvasm - Assembler and disassembler for Game Boy Advance homebrew
// by Sean Connelly (@velipso), https://sean.cm
// Project Home: https://github.com/velipso/gvasm
// SPDX-License-Identifier: 0BSD
//

import { ITest } from '../itest.ts';

export function load(def: (test: ITest) => void) {
  def({
    name: 'expr.neg',
    desc: 'Negation',
    kind: 'make',
    files: { '/root/main': `.i8 -1, --4, +1, -+-+4  /// ff 04 01 04` },
  });

  def({
    name: 'expr.bitnot',
    desc: 'Bitwise not',
    kind: 'make',
    files: { '/root/main': `.i8 ~14, ~~4  /// f1 04` },
  });

  def({
    name: 'expr.not',
    desc: 'Logical not',
    kind: 'make',
    files: { '/root/main': `.i8 !0, !1, !5  /// 01 00 00` },
  });

  def({
    name: 'expr.add',
    desc: 'Addition',
    kind: 'make',
    files: { '/root/main': `.i8 1 + 2, 3 + 4  /// 03 07` },
  });

  def({
    name: 'expr.sub',
    desc: 'Subtraction',
    kind: 'make',
    files: { '/root/main': `.i8 5 - 2, 14 - 7  /// 03 07` },
  });

  def({
    name: 'expr.mul',
    desc: 'Multiplication',
    kind: 'make',
    files: { '/root/main': `.i8 5 * 2, 3 * 7  /// 0a 15` },
  });

  def({
    name: 'expr.div',
    desc: 'Division',
    kind: 'make',
    files: { '/root/main': `.i8 50 / 10, 56 / 7  /// 05 08` },
  });

  def({
    name: 'expr.mod',
    desc: 'Modulo',
    kind: 'make',
    files: { '/root/main': `.i8 21 % 10, 67 % 8  /// 01 03` },
  });

  def({
    name: 'expr.lsl',
    desc: 'Logical shift left',
    kind: 'make',
    files: { '/root/main': `.i8 1 << 3, 3 << 2  /// 08 0c` },
  });

  def({
    name: 'expr.lsr',
    desc: 'Logical shift right',
    kind: 'make',
    files: { '/root/main': `.i8 100 >>> 2, -1 >>> 30  /// 19 03` },
  });

  def({
    name: 'expr.asr',
    desc: 'Arithmetic shift right',
    kind: 'make',
    files: { '/root/main': `.i8 100 >> 2, -1 >> 30  /// 19 ff` },
  });

  def({
    name: 'expr.bitand',
    desc: 'Bitwise and',
    kind: 'make',
    files: { '/root/main': `.i8 0xf5 & 0xe3, 0xff & 0x00  /// e1 00` },
  });

  def({
    name: 'expr.bitor',
    desc: 'Bitwise or',
    kind: 'make',
    files: { '/root/main': `.i8 0xf5 | 0xe3, 0xff | 0x00  /// f7 ff` },
  });

  def({
    name: 'expr.bitxor',
    desc: 'Bitwise xor',
    kind: 'make',
    files: { '/root/main': `.i8 0xf5 ^ 0xe3, 0xff ^ 0x00  /// 16 ff` },
  });

  def({
    name: 'expr.lt',
    desc: 'Less than',
    kind: 'make',
    files: { '/root/main': `.i8 1 < 2, 1 < -5, 1 < 1  /// 01 00 00` },
  });

  def({
    name: 'expr.lte',
    desc: 'Less than or equal',
    kind: 'make',
    files: { '/root/main': `.i8 1 <= 2, 1 <= -5, 1 <= 1  /// 01 00 01` },
  });

  def({
    name: 'expr.gt',
    desc: 'Greater than',
    kind: 'make',
    files: { '/root/main': `.i8 1 > 2, 1 > -5, 1 > 1  /// 00 01 00` },
  });

  def({
    name: 'expr.gte',
    desc: 'Greater than or equal',
    kind: 'make',
    files: { '/root/main': `.i8 1 >= 2, 1 >= -5, 1 >= 1  /// 00 01 01` },
  });

  def({
    name: 'expr.eq',
    desc: 'Equal',
    kind: 'make',
    files: { '/root/main': `.i8 1 == 2, 1 == -5, 1 == 1  /// 00 00 01` },
  });

  def({
    name: 'expr.neq',
    desc: 'Not equal',
    kind: 'make',
    files: { '/root/main': `.i8 1 != 2, 1 != -5, 1 != 1  /// 01 01 00` },
  });

  def({
    name: 'expr.and',
    desc: 'Logical and',
    kind: 'make',
    files: {
      '/root/main': `.i8 0 && 0, 4 && 0, 0 && 2, 6 && 8  /// 00 00 00 08`,
    },
  });

  def({
    name: 'expr.or',
    desc: 'Logical or',
    kind: 'make',
    files: {
      '/root/main': `.i8 0 || 0, 4 || 0, 0 || 2, 6 || 8  /// 00 04 02 06`,
    },
  });

  def({
    name: 'expr.ternary',
    desc: 'Ternary operator',
    kind: 'make',
    files: {
      '/root/main': `.i8 5 ? 2 : 3, 0 ? 6 : 9 /// 02 09`,
    },
  });

  def({
    name: 'expr.precedence',
    desc: 'Operator precedence',
    kind: 'make',
    files: {
      '/root/main': `
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

  def({
    name: 'expr.functions',
    desc: 'Built-in functions (sqrt, etc)',
    kind: 'make',
    files: {
      '/root/main': `
.i8 abs(5), abs(-5), abs(0)     /// 05 05 00
.i8 clamp(-1, 3, 5)             /// 03
.i8 clamp(-1, 5, 3)             /// 03
.i8 clamp(10, 3, 5)             /// 05
.i8 clamp(10, 5, 3)             /// 05
.i8 clamp(4, 3, 5)              /// 04
.i8 clamp(4, 5, 3)              /// 04
.i8 log2(100)                   /// 06
.i8 log2assert(128)             /// 07
.i8 max(6, 3, 0, 10, 4)         /// 0a
.i8 min(6, 3, 0, -3, 4)         /// fd
.i8 nrt(100, 3)                 /// 04
.i8 pow(3, 3)                   /// 1b
.align 2                        /// 00
.i16 rgb(2, 31, 10)             /// e2 2b
.i8 sign(0), sign(5), sign(-5)  /// 00 01 ff
.i8 sqrt(30), sqrt(-30)         /// 05 05
`,
    },
  });

  def({
    name: 'expr.log2assert',
    desc: 'Verify log2assert fails when log2 isn\'t exact',
    kind: 'make',
    error: true,
    files: {
      '/root/main': `.i8 log2assert(100)`,
    },
  });

  def({
    name: 'expr.functions-missing-parameters',
    desc: 'Error when function call is missing parameters',
    kind: 'make',
    error: true,
    files: {
      '/root/main': `.i8 pow(2)`,
    },
  });

  def({
    name: 'expr.functions-extra-parameters',
    desc: 'Error when function call has extra parameters',
    kind: 'make',
    error: true,
    files: {
      '/root/main': `.i8 pow(2, 3, 4)`,
    },
  });

  def({
    name: 'expr.assert-pass',
    desc: 'Use assert() in an expression',
    kind: 'make',
    files: {
      '/root/main': `
.def pos2neg(a) = \\
  assert("must pass positive value to pos2neg", a > 0) * \\
  -a
.i8 pos2neg(5)  /// fb
`,
    },
  });

  def({
    name: 'expr.assert-fail',
    desc: 'Fail an assertion',
    kind: 'make',
    error: true,
    files: {
      '/root/main': `
.def pos2neg(a) = \\
  assert("must pass positive value to pos2neg", a > 0) * \\
  -a
.i8 pos2neg(-5)
`,
    },
  });

  def({
    name: 'expr.defined',
    desc: 'Use defined() in an expression',
    kind: 'make',
    files: {
      '/root/main': `
.if defined(a)
  .i8 1
.else
  .i8 2 /// 02
  .def a = 3
.end

.if defined(a)
  .i8 a /// 03
.else
  .i8 4
.end
`,
    },
  });

  def({
    name: 'expr.precedence-bug',
    desc: 'Add/subtract should evaluate before greater than',
    kind: 'make',
    stdout: ['1', '1'],
    files: {
      '/root/main': `
.def a = 0x03000001
.i32 0 /// 00 00 00 00
b:
.printf "%d", b - 0x08000000 + 0x03000000 > a
.printf "%d", a < b - 0x08000000 + 0x03000000
`,
    },
  });

  def({
    name: 'expr.predefined',
    desc: 'Predefined values',
    kind: 'make',
    files: {
      '/root/main': `
.i8 DEFINED123  /// 7b
`,
    },
  });
}
