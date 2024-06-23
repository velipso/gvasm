//
// gvasm - Assembler and disassembler for Game Boy Advance homebrew
// by Sean Connelly (@velipso), https://sean.fun
// Project Home: https://github.com/velipso/gvasm
// SPDX-License-Identifier: 0BSD
//

import { ITest } from '../itest.ts';

export function load(def: (test: ITest) => void) {
  def({
    name: 'regs.default',
    desc: 'Verify default registers',
    kind: 'make',
    files: {
      '/root/main': `.arm
mov r0, #0   /// 00 00 a0 e3
mov r1, #0   /// 00 10 a0 e3
mov r2, #0   /// 00 20 a0 e3
mov r3, #0   /// 00 30 a0 e3
mov r4, #0   /// 00 40 a0 e3
mov r5, #0   /// 00 50 a0 e3
mov r6, #0   /// 00 60 a0 e3
mov r7, #0   /// 00 70 a0 e3
mov r8, #0   /// 00 80 a0 e3
mov r9, #0   /// 00 90 a0 e3
mov r10, #0  /// 00 a0 a0 e3
mov r11, #0  /// 00 b0 a0 e3
mov r12, #0  /// 00 c0 a0 e3
mov ip, #0   /// 00 c0 a0 e3
mov r13, #0  /// 00 d0 a0 e3
mov sp, #0   /// 00 d0 a0 e3
mov r14, #0  /// 00 e0 a0 e3
mov lr, #0   /// 00 e0 a0 e3
mov r15, #0  /// 00 f0 a0 e3
mov pc, #0   /// 00 f0 a0 e3
`,
    },
  });

  def({
    name: 'regs.reset',
    desc: 'Reset register names',
    kind: 'make',
    files: {
      '/root/main': `.arm
.regs r0-r11
mov r0, #0   /// 00 00 a0 e3
mov r1, #0   /// 00 10 a0 e3
mov r2, #0   /// 00 20 a0 e3
mov r3, #0   /// 00 30 a0 e3
mov r4, #0   /// 00 40 a0 e3
mov r5, #0   /// 00 50 a0 e3
mov r6, #0   /// 00 60 a0 e3
mov r7, #0   /// 00 70 a0 e3
mov r8, #0   /// 00 80 a0 e3
mov r9, #0   /// 00 90 a0 e3
mov r10, #0  /// 00 a0 a0 e3
mov r11, #0  /// 00 b0 a0 e3
mov r12, #0  /// 00 c0 a0 e3
mov ip, #0   /// 00 c0 a0 e3
mov r13, #0  /// 00 d0 a0 e3
mov sp, #0   /// 00 d0 a0 e3
mov r14, #0  /// 00 e0 a0 e3
mov lr, #0   /// 00 e0 a0 e3
mov r15, #0  /// 00 f0 a0 e3
mov pc, #0   /// 00 f0 a0 e3
`,
    },
  });

  def({
    name: 'regs.descending',
    desc: 'Descending register names',
    kind: 'make',
    files: {
      '/root/main': `.arm
.regs r11-r0
mov r0, #0   /// 00 b0 a0 e3
mov r1, #0   /// 00 a0 a0 e3
mov r2, #0   /// 00 90 a0 e3
mov r3, #0   /// 00 80 a0 e3
mov r4, #0   /// 00 70 a0 e3
mov r5, #0   /// 00 60 a0 e3
mov r6, #0   /// 00 50 a0 e3
mov r7, #0   /// 00 40 a0 e3
mov r8, #0   /// 00 30 a0 e3
mov r9, #0   /// 00 20 a0 e3
mov r10, #0  /// 00 10 a0 e3
mov r11, #0  /// 00 00 a0 e3
mov r12, #0  /// 00 c0 a0 e3
mov ip, #0   /// 00 c0 a0 e3
mov r13, #0  /// 00 d0 a0 e3
mov sp, #0   /// 00 d0 a0 e3
mov r14, #0  /// 00 e0 a0 e3
mov lr, #0   /// 00 e0 a0 e3
mov r15, #0  /// 00 f0 a0 e3
mov pc, #0   /// 00 f0 a0 e3
`,
    },
  });

  def({
    name: 'regs.replace',
    desc: 'Verify register names are replaced',
    kind: 'make',
    error: true,
    files: {
      '/root/main': `.arm
.regs a, r1-r11
mov r0, #0
`,
    },
  });

  def({
    name: 'regs.range',
    desc: 'Parse register ranges correctly',
    kind: 'make',
    files: {
      '/root/main': `.arm
.regs temp0-temp3, foo, bar, baz10-baz8, qux, r5, r20-r20
mov temp0, #0  /// 00 00 a0 e3
mov temp1, #0  /// 00 10 a0 e3
mov temp2, #0  /// 00 20 a0 e3
mov temp3, #0  /// 00 30 a0 e3
mov foo, #0    /// 00 40 a0 e3
mov bar, #0    /// 00 50 a0 e3
mov baz10, #0  /// 00 60 a0 e3
mov baz9, #0   /// 00 70 a0 e3
mov baz8, #0   /// 00 80 a0 e3
mov qux, #0    /// 00 90 a0 e3
mov r5, #0     /// 00 a0 a0 e3
mov r20, #0    /// 00 b0 a0 e3
`,
    },
  });

  def({
    name: 'regs.reserved-range',
    desc: 'Fail to rename to a reserved register',
    kind: 'make',
    error: true,
    files: {
      '/root/main': `.arm
.regs r5-r16
mov r5, #0  /// 00 00 a0 e3
`,
    },
  });

  def({
    name: 'regs.reserved-name',
    desc: 'Fail to rename to a reserved register',
    kind: 'make',
    error: true,
    files: {
      '/root/main': `.arm
.regs r0-r10, sp
mov r5, #0  /// 00 00 a0 e3
`,
    },
  });

  def({
    name: 'regs.scope',
    desc: 'Register names are scoped',
    kind: 'make',
    files: {
      '/root/main': `.arm
.regs r0, r1-r11
mov r0, #0        /// 00 00 a0 e3
.begin
  .regs temp, r1-r11
  mov temp, #0    /// 00 00 a0 e3
  .begin
    mov temp, #0  /// 00 00 a0 e3
    .regs foo, r1-r11
    mov foo, #0   /// 00 00 a0 e3
  .end
  mov temp, #0    /// 00 00 a0 e3
.end
mov r0, #0        /// 00 00 a0 e3
`,
    },
  });

  def({
    name: 'regs.print',
    desc: 'Print the register names',
    kind: 'make',
    stdout: [
      '/root/main:3:1: Registers: temp0, temp1, temp2, temp3, foo, bar, baz10, baz9, baz8, qux, r5, r20',
    ],
    files: {
      '/root/main': `.arm
.regs temp0-temp3, foo, bar, baz10-baz8, qux, r5, r20-r20
.regs
`,
    },
  });
}
