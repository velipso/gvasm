//
// gvasm - Assembler and disassembler for Game Boy Advance homebrew
// by Sean Connelly (@velipso), https://sean.cm
// Project Home: https://github.com/velipso/gvasm
// SPDX-License-Identifier: 0BSD
//

import { ITest } from '../itest.ts';

export function load(def: (test: ITest) => void) {
  def({
    name: 'arm.bx',
    desc: 'Branch and exchange',
    kind: 'make',
    files: {
      '/root/main': `.arm
bx r9      /// 19 ff 2f e1
bxeq r14   /// 1e ff 2f 01
bx.eq r14  /// 1e ff 2f 01
`,
    },
  });

  def({
    name: 'arm.bx-period',
    desc: 'Branch and exchange can\'t end in period',
    kind: 'make',
    error: true,
    files: {
      '/root/main': `.arm
bx. r9
`,
    },
  });

  def({
    name: 'arm.b',
    desc: 'Branch',
    kind: 'make',
    files: {
      '/root/main': `.arm
L1: b 0x08000008  /// 00 00 00 ea
L2: b L1          /// fd ff ff ea
L3: bne L3        /// fe ff ff 1a
b.cs L4           /// 01 00 00 2a
.i32 0, 0         /// 00 00 00 00 00 00 00 00
L4:
`,
    },
  });

  def({
    name: 'arm.b-misaligned',
    desc: 'Branch misaligned',
    kind: 'make',
    error: true,
    files: {
      '/root/main': `.arm
b L1   /// 00 00 00 00
.i8 0  /// 00
L1:
`,
    },
  });

  def({
    name: 'arm.bl',
    desc: 'Branch and Link',
    kind: 'make',
    files: {
      '/root/main': `.arm
L1: bl 0x08000008  /// 00 00 00 eb
L2: bl L1          /// fd ff ff eb
L3: blhs L3        /// fe ff ff 2b
bl.cc L4           /// 01 00 00 3b
.i32 0, 0          /// 00 00 00 00 00 00 00 00
L4:
`,
    },
  });

  def({
    name: 'arm.nop',
    desc: 'Nop',
    kind: 'make',
    files: {
      '/root/main': `.arm
mov r0, r0  /// 00 00 a0 e1
nop         /// 00 00 a0 e1
`,
    },
  });

  for (
    const { op, desc, code } of [
      { op: 'mov', desc: 'Move', code: 13 },
      { op: 'mvn', desc: 'Move not', code: 15 },
      { op: 'not', desc: 'Move not', code: 15 },
    ]
  ) {
    const b = (code & 7) << 1;
    const b0 = b.toString(16);
    const b1 = (b | 1).toString(16);
    def({
      name: `arm.${op}`,
      desc,
      kind: 'make',
      files: {
        '/root/main': `.arm
${op} r3, r14               /// 0e 30 ${b0}0 e1
${op}s r3, r14              /// 0e 30 ${b1}0 e1
${op}mi r3, r14             /// 0e 30 ${b0}0 41
${op}smi r3, r14            /// 0e 30 ${b1}0 41
${op}s.mi r3, r14           /// 0e 30 ${b1}0 41
${op}mis r3, r14            /// 0e 30 ${b1}0 41

${op} r3, r14, lsl #0       /// 0e 30 ${b0}0 e1
${op}s r3, r14, lsl #0      /// 0e 30 ${b1}0 e1
${op}mi r3, r14, lsl #0     /// 0e 30 ${b0}0 41
${op}smi r3, r14, lsl #0    /// 0e 30 ${b1}0 41
${op}s.mi r3, r14, lsl #0   /// 0e 30 ${b1}0 41
${op}mis r3, r14, lsl #0    /// 0e 30 ${b1}0 41

${op} r3, r14, lsr #0       /// 0e 30 ${b0}0 e1
${op}s r3, r14, lsr #0      /// 0e 30 ${b1}0 e1
${op}mi r3, r14, lsr #0     /// 0e 30 ${b0}0 41
${op}smi r3, r14, lsr #0    /// 0e 30 ${b1}0 41
${op}s.mi r3, r14, lsr #0   /// 0e 30 ${b1}0 41
${op}mis r3, r14, lsr #0    /// 0e 30 ${b1}0 41

${op} r3, r14, asr #0       /// 0e 30 ${b0}0 e1
${op}s r3, r14, asr #0      /// 0e 30 ${b1}0 e1
${op}mi r3, r14, asr #0     /// 0e 30 ${b0}0 41
${op}smi r3, r14, asr #0    /// 0e 30 ${b1}0 41
${op}s.mi r3, r14, asr #0   /// 0e 30 ${b1}0 41
${op}mis r3, r14, asr #0    /// 0e 30 ${b1}0 41

${op} r3, r14, ror #0       /// 0e 30 ${b0}0 e1
${op}s r3, r14, ror #0      /// 0e 30 ${b1}0 e1
${op}mi r3, r14, ror #0     /// 0e 30 ${b0}0 41
${op}smi r3, r14, ror #0    /// 0e 30 ${b1}0 41
${op}s.mi r3, r14, ror #0   /// 0e 30 ${b1}0 41
${op}mis r3, r14, ror #0    /// 0e 30 ${b1}0 41

${op} r3, r14, lsr #32      /// 2e 30 ${b0}0 e1
${op}s r3, r14, lsr #32     /// 2e 30 ${b1}0 e1
${op}mi r3, r14, lsr #32    /// 2e 30 ${b0}0 41
${op}smi r3, r14, lsr #32   /// 2e 30 ${b1}0 41
${op}s.mi r3, r14, lsr #32  /// 2e 30 ${b1}0 41
${op}mis r3, r14, lsr #32   /// 2e 30 ${b1}0 41

${op} r3, r14, asr #32      /// 4e 30 ${b0}0 e1
${op}s r3, r14, asr #32     /// 4e 30 ${b1}0 e1
${op}mi r3, r14, asr #32    /// 4e 30 ${b0}0 41
${op}smi r3, r14, asr #32   /// 4e 30 ${b1}0 41
${op}s.mi r3, r14, asr #32  /// 4e 30 ${b1}0 41
${op}mis r3, r14, asr #32   /// 4e 30 ${b1}0 41

${op} r3, r14, rrx          /// 6e 30 ${b0}0 e1
${op}s r3, r14, rrx         /// 6e 30 ${b1}0 e1
${op}mi r3, r14, rrx        /// 6e 30 ${b0}0 41
${op}smi r3, r14, rrx       /// 6e 30 ${b1}0 41
${op}s.mi r3, r14, rrx      /// 6e 30 ${b1}0 41
${op}mis r3, r14, rrx       /// 6e 30 ${b1}0 41

${op} r3, r14, lsl #5       /// 8e 32 ${b0}0 e1
${op}s r3, r14, lsr #10     /// 2e 35 ${b1}0 e1
${op}mi r3, r14, asr #15    /// ce 37 ${b0}0 41
${op}smi r3, r14, ror #20   /// 6e 3a ${b1}0 41
${op}s.mi r3, r14, ror #20  /// 6e 3a ${b1}0 41
${op}mis r3, r14, lsl #25   /// 8e 3c ${b1}0 41

${op} r3, r14, lsl r10      /// 1e 3a ${b0}0 e1
${op}s r3, r14, lsr r10     /// 3e 3a ${b1}0 e1
${op}mi r3, r14, asr r10    /// 5e 3a ${b0}0 41
${op}smi r3, r14, ror r10   /// 7e 3a ${b1}0 41
${op}s.mi r3, r14, ror r10  /// 7e 3a ${b1}0 41
${op}mis r3, r14, lsl r10   /// 1e 3a ${b1}0 41

${op} r3, #0x34000000       /// 0d 33 ${b0}0 e3
${op}s r3, #0x560000        /// 56 38 ${b1}0 e3
${op}mi r3, #0x7800         /// 1e 3b ${b0}0 43
${op}smi r3, #0x91          /// 91 30 ${b1}0 43
${op}s.mi r3, #0x91         /// 91 30 ${b1}0 43
${op}mis r3, #0x50          /// 05 3e ${b1}0 43
`,
      },
    });
  }

  for (
    const { op, desc, code } of [
      { op: 'tst', desc: 'Bitwise and test', code: 8 },
      { op: 'teq', desc: 'Bitwise exclusive or test', code: 9 },
      { op: 'cmp', desc: 'Compare', code: 10 },
      { op: 'cmn', desc: 'Compare negative', code: 11 },
    ]
  ) {
    const b = (code & 7) << 1;
    const b1 = (b | 1).toString(16);
    def({
      name: `arm.${op}`,
      desc,
      kind: 'make',
      files: {
        '/root/main': `.arm
${op} r9, r14              /// 0e 00 ${b1}9 e1
${op}pl r9, r14            /// 0e 00 ${b1}9 51
${op}.pl r9, r14           /// 0e 00 ${b1}9 51

${op} r9, r14, lsl #0      /// 0e 00 ${b1}9 e1
${op}pl r9, r14, lsl #0    /// 0e 00 ${b1}9 51
${op}.pl r9, r14, lsl #0   /// 0e 00 ${b1}9 51

${op} r9, r14, lsr #0      /// 0e 00 ${b1}9 e1
${op}pl r9, r14, lsr #0    /// 0e 00 ${b1}9 51
${op}.pl r9, r14, lsr #0   /// 0e 00 ${b1}9 51

${op} r9, r14, asr #0      /// 0e 00 ${b1}9 e1
${op}pl r9, r14, asr #0    /// 0e 00 ${b1}9 51
${op}.pl r9, r14, asr #0   /// 0e 00 ${b1}9 51

${op} r9, r14, ror #0      /// 0e 00 ${b1}9 e1
${op}pl r9, r14, ror #0    /// 0e 00 ${b1}9 51
${op}.pl r9, r14, ror #0   /// 0e 00 ${b1}9 51

${op} r9, r14, lsr #32     /// 2e 00 ${b1}9 e1
${op}pl r9, r14, lsr #32   /// 2e 00 ${b1}9 51
${op}.pl r9, r14, lsr #32  /// 2e 00 ${b1}9 51

${op} r9, r14, asr #32     /// 4e 00 ${b1}9 e1
${op}pl r9, r14, asr #32   /// 4e 00 ${b1}9 51
${op}.pl r9, r14, asr #32  /// 4e 00 ${b1}9 51

${op} r9, r14, rrx         /// 6e 00 ${b1}9 e1
${op}pl r9, r14, rrx       /// 6e 00 ${b1}9 51
${op}.pl r9, r14, rrx      /// 6e 00 ${b1}9 51

${op} r9, r14, lsl #5      /// 8e 02 ${b1}9 e1
${op}pl r9, r14, asr #15   /// ce 07 ${b1}9 51
${op}.pl r9, r14, asr #15  /// ce 07 ${b1}9 51

${op} r9, r14, lsl r10     /// 1e 0a ${b1}9 e1
${op}pl r9, r14, asr r10   /// 5e 0a ${b1}9 51
${op}.pl r9, r14, asr r10  /// 5e 0a ${b1}9 51

${op} r9, #0x34000000      /// 0d 03 ${b1}9 e3
${op}pl r9, #0x7800        /// 1e 0b ${b1}9 53
${op}.pl r9, #0x7800       /// 1e 0b ${b1}9 53
`,
      },
    });
  }

  for (
    const { op, desc, code } of [
      { op: 'and', desc: 'Bitwise and', code: 0 },
      { op: 'eor', desc: 'Bitwise exclusive or', code: 1 },
      { op: 'sub', desc: 'Subtraction', code: 2 },
      { op: 'rsb', desc: 'Reverse subtraction', code: 3 },
      { op: 'add', desc: 'Addition', code: 4 },
      { op: 'adc', desc: 'Addition with carry', code: 5 },
      { op: 'sbc', desc: 'Subtraction with carry', code: 6 },
      { op: 'rsc', desc: 'Reverse subtraction with carry', code: 7 },
      { op: 'orr', desc: 'Bitwise or', code: 12 },
      { op: 'bic', desc: 'Bit clear', code: 14 },
    ]
  ) {
    const a = code >> 3;
    const b = (code & 7) << 1;
    const b0 = b.toString(16);
    const b1 = (b | 1).toString(16);
    const a0 = a.toString(16);
    const a2 = (a | 2).toString(16);
    def({
      name: `arm.${op}`,
      desc,
      kind: 'make',
      files: {
        '/root/main': `.arm
${op} r3, r9, r14              /// 0e 30 ${b0}9 e${a0}
${op}s r3, r9, r14             /// 0e 30 ${b1}9 e${a0}
${op}lo r3, r9, r14            /// 0e 30 ${b0}9 3${a0}
${op}slo r3, r9, r14           /// 0e 30 ${b1}9 3${a0}
${op}los r3, r9, r14           /// 0e 30 ${b1}9 3${a0}

${op} r3, r14                  /// 0e 30 ${b0}3 e${a0}
${op}s r3, r14                 /// 0e 30 ${b1}3 e${a0}
${op}lo r3, r14                /// 0e 30 ${b0}3 3${a0}
${op}slo r3, r14               /// 0e 30 ${b1}3 3${a0}
${op}los r3, r14               /// 0e 30 ${b1}3 3${a0}

${op} r3, r9, r14, lsl #0      /// 0e 30 ${b0}9 e${a0}
${op}s r3, r9, r14, lsl #0     /// 0e 30 ${b1}9 e${a0}
${op}lo r3, r9, r14, lsl #0    /// 0e 30 ${b0}9 3${a0}
${op}slo r3, r9, r14, lsl #0   /// 0e 30 ${b1}9 3${a0}
${op}los r3, r9, r14, lsl #0   /// 0e 30 ${b1}9 3${a0}

${op} r3, r9, r14, asl #0      /// 0e 30 ${b0}9 e${a0}
${op}s r3, r9, r14, asl #0     /// 0e 30 ${b1}9 e${a0}
${op}lo r3, r9, r14, asl #0    /// 0e 30 ${b0}9 3${a0}
${op}slo r3, r9, r14, asl #0   /// 0e 30 ${b1}9 3${a0}
${op}los r3, r9, r14, asl #0   /// 0e 30 ${b1}9 3${a0}

${op} r3, r9, r14, lsr #0      /// 0e 30 ${b0}9 e${a0}
${op}s r3, r9, r14, lsr #0     /// 0e 30 ${b1}9 e${a0}
${op}lo r3, r9, r14, lsr #0    /// 0e 30 ${b0}9 3${a0}
${op}slo r3, r9, r14, lsr #0   /// 0e 30 ${b1}9 3${a0}
${op}los r3, r9, r14, lsr #0   /// 0e 30 ${b1}9 3${a0}

${op} r3, r14, lsr #0          /// 0e 30 ${b0}3 e${a0}
${op}s r3, r14, lsr #0         /// 0e 30 ${b1}3 e${a0}
${op}lo r3, r14, lsr #0        /// 0e 30 ${b0}3 3${a0}
${op}slo r3, r14, lsr #0       /// 0e 30 ${b1}3 3${a0}
${op}los r3, r14, lsr #0       /// 0e 30 ${b1}3 3${a0}

${op} r3, r9, r14, asr #0      /// 0e 30 ${b0}9 e${a0}
${op}s r3, r9, r14, asr #0     /// 0e 30 ${b1}9 e${a0}
${op}lo r3, r9, r14, asr #0    /// 0e 30 ${b0}9 3${a0}
${op}slo r3, r9, r14, asr #0   /// 0e 30 ${b1}9 3${a0}
${op}los r3, r9, r14, asr #0   /// 0e 30 ${b1}9 3${a0}

${op} r3, r9, r14, ror #0      /// 0e 30 ${b0}9 e${a0}
${op}s r3, r9, r14, ror #0     /// 0e 30 ${b1}9 e${a0}
${op}lo r3, r9, r14, ror #0    /// 0e 30 ${b0}9 3${a0}
${op}slo r3, r9, r14, ror #0   /// 0e 30 ${b1}9 3${a0}
${op}los r3, r9, r14, ror #0   /// 0e 30 ${b1}9 3${a0}

${op} r3, r9, r14, lsr #32     /// 2e 30 ${b0}9 e${a0}
${op}s r3, r9, r14, lsr #32    /// 2e 30 ${b1}9 e${a0}
${op}lo r3, r9, r14, lsr #32   /// 2e 30 ${b0}9 3${a0}
${op}slo r3, r9, r14, lsr #32  /// 2e 30 ${b1}9 3${a0}
${op}los r3, r9, r14, lsr #32  /// 2e 30 ${b1}9 3${a0}

${op} r3, r14, lsr #32         /// 2e 30 ${b0}3 e${a0}
${op}s r3, r14, lsr #32        /// 2e 30 ${b1}3 e${a0}
${op}lo r3, r14, lsr #32       /// 2e 30 ${b0}3 3${a0}
${op}slo r3, r14, lsr #32      /// 2e 30 ${b1}3 3${a0}
${op}los r3, r14, lsr #32      /// 2e 30 ${b1}3 3${a0}

${op} r3, r9, r14, asr #32     /// 4e 30 ${b0}9 e${a0}
${op}s r3, r9, r14, asr #32    /// 4e 30 ${b1}9 e${a0}
${op}lo r3, r9, r14, asr #32   /// 4e 30 ${b0}9 3${a0}
${op}slo r3, r9, r14, asr #32  /// 4e 30 ${b1}9 3${a0}
${op}los r3, r9, r14, asr #32  /// 4e 30 ${b1}9 3${a0}

${op} r3, r14, asr #32         /// 4e 30 ${b0}3 e${a0}
${op}s r3, r14, asr #32        /// 4e 30 ${b1}3 e${a0}
${op}lo r3, r14, asr #32       /// 4e 30 ${b0}3 3${a0}
${op}slo r3, r14, asr #32      /// 4e 30 ${b1}3 3${a0}
${op}los r3, r14, asr #32      /// 4e 30 ${b1}3 3${a0}

${op} r3, r9, r14, rrx         /// 6e 30 ${b0}9 e${a0}
${op}s r3, r9, r14, rrx        /// 6e 30 ${b1}9 e${a0}
${op}lo r3, r9, r14, rrx       /// 6e 30 ${b0}9 3${a0}
${op}slo r3, r9, r14, rrx      /// 6e 30 ${b1}9 3${a0}
${op}los r3, r9, r14, rrx      /// 6e 30 ${b1}9 3${a0}

${op} r3, r14, rrx             /// 6e 30 ${b0}3 e${a0}
${op}s r3, r14, rrx            /// 6e 30 ${b1}3 e${a0}
${op}lo r3, r14, rrx           /// 6e 30 ${b0}3 3${a0}
${op}slo r3, r14, rrx          /// 6e 30 ${b1}3 3${a0}
${op}los r3, r14, rrx          /// 6e 30 ${b1}3 3${a0}

${op} r3, r9, r14, lsl #5      /// 8e 32 ${b0}9 e${a0}
${op} r3, r9, r14, asl #5      /// 8e 32 ${b0}9 e${a0}
${op}s r3, r9, r14, lsr #10    /// 2e 35 ${b1}9 e${a0}
${op}lo r3, r9, r14, asr #15   /// ce 37 ${b0}9 3${a0}
${op}slo r3, r9, r14, ror #20  /// 6e 3a ${b1}9 3${a0}
${op}los r3, r9, r14, lsl #25  /// 8e 3c ${b1}9 3${a0}
${op}los r3, r9, r14, asl #25  /// 8e 3c ${b1}9 3${a0}

${op} r3, r14, lsl #5          /// 8e 32 ${b0}3 e${a0}
${op} r3, r14, asl #5          /// 8e 32 ${b0}3 e${a0}
${op}s r3, r14, lsr #10        /// 2e 35 ${b1}3 e${a0}
${op}lo r3, r14, asr #15       /// ce 37 ${b0}3 3${a0}
${op}slo r3, r14, ror #20      /// 6e 3a ${b1}3 3${a0}
${op}los r3, r14, lsl #25      /// 8e 3c ${b1}3 3${a0}
${op}los r3, r14, asl #25      /// 8e 3c ${b1}3 3${a0}

${op} r3, r9, r14, lsl r10     /// 1e 3a ${b0}9 e${a0}
${op} r3, r9, r14, asl r10     /// 1e 3a ${b0}9 e${a0}
${op}s r3, r9, r14, lsr r10    /// 3e 3a ${b1}9 e${a0}
${op}lo r3, r9, r14, asr r10   /// 5e 3a ${b0}9 3${a0}
${op}slo r3, r9, r14, ror r10  /// 7e 3a ${b1}9 3${a0}
${op}los r3, r9, r14, lsl r10  /// 1e 3a ${b1}9 3${a0}
${op}los r3, r9, r14, asl r10  /// 1e 3a ${b1}9 3${a0}

${op} r3, r14, lsl r10         /// 1e 3a ${b0}3 e${a0}
${op} r3, r14, asl r10         /// 1e 3a ${b0}3 e${a0}
${op}s r3, r14, lsr r10        /// 3e 3a ${b1}3 e${a0}
${op}lo r3, r14, asr r10       /// 5e 3a ${b0}3 3${a0}
${op}slo r3, r14, ror r10      /// 7e 3a ${b1}3 3${a0}
${op}los r3, r14, lsl r10      /// 1e 3a ${b1}3 3${a0}
${op}los r3, r14, asl r10      /// 1e 3a ${b1}3 3${a0}

${op} r3, r9, #0x34000000      /// 0d 33 ${b0}9 e${a2}
${op}s r3, r9, #0x560000       /// 56 38 ${b1}9 e${a2}
${op}lo r3, r9, #0x7800        /// 1e 3b ${b0}9 3${a2}
${op}slo r3, r9, #0x91         /// 91 30 ${b1}9 3${a2}
${op}los r3, r9, #0x50         /// 05 3e ${b1}9 3${a2}

${op} r3, #0x34000000          /// 0d 33 ${b0}3 e${a2}
${op}s r3, #0x560000           /// 56 38 ${b1}3 e${a2}
${op}lo r3, #0x7800            /// 1e 3b ${b0}3 3${a2}
${op}slo r3, #0x91             /// 91 30 ${b1}3 3${a2}
${op}los r3, #0x50             /// 05 3e ${b1}3 3${a2}
`,
      },
    });
  }

  for (
    const { op, desc, code } of [
      { op: 'lsl', desc: 'Logical shift left', code: 0 },
      { op: 'asl', desc: 'Logical shift left', code: 0 },
      { op: 'lsr', desc: 'Logical shift right', code: 1 },
      { op: 'asr', desc: 'Arithmetic shift right', code: 2 },
      { op: 'ror', desc: 'Rotate right', code: 3 },
    ]
  ) {
    const a0 = ((code << 1) | 0).toString(16);
    const a1 = ((code << 1) | 1).toString(16);
    const a8 = ((code << 1) | 8).toString(16);
    const b = op === 'lsr' ? '2' : '4';
    def({
      name: `arm.${op}`,
      desc,
      kind: 'make',
      files: {
        '/root/main': `.arm
${op} r3, r14, #0       /// 0e 30 a0 e1
${op}s r3, r14, #0      /// 0e 30 b0 e1
${op}mi r3, r14, #0     /// 0e 30 a0 41
${op}smi r3, r14, #0    /// 0e 30 b0 41
${op}s.mi r3, r14, #0   /// 0e 30 b0 41
${op}mis r3, r14, #0    /// 0e 30 b0 41

${op} r3, #0            /// 03 30 a0 e1
${op}s r3, #0           /// 03 30 b0 e1
${op}mi r3, #0          /// 03 30 a0 41
${op}smi r3, #0         /// 03 30 b0 41
${op}s.mi r3, #0        /// 03 30 b0 41
${op}mis r3, #0         /// 03 30 b0 41

${
          op === 'lsr' || op === 'asr'
            ? `
${op} r3, r14, #32      /// ${b}e 30 a0 e1
${op}s r3, r14, #32     /// ${b}e 30 b0 e1
${op}mi r3, r14, #32    /// ${b}e 30 a0 41
${op}smi r3, r14, #32   /// ${b}e 30 b0 41
${op}s.mi r3, r14, #32  /// ${b}e 30 b0 41
${op}mis r3, r14, #32   /// ${b}e 30 b0 41

${op} r3, #32           /// ${b}3 30 a0 e1
${op}s r3, #32          /// ${b}3 30 b0 e1
${op}mi r3, #32         /// ${b}3 30 a0 41
${op}smi r3, #32        /// ${b}3 30 b0 41
${op}s.mi r3, #32       /// ${b}3 30 b0 41
${op}mis r3, #32        /// ${b}3 30 b0 41
`
            : ''
        }

${op} r3, r14, #5       /// ${a8}e 32 a0 e1
${op}s r3, r14, #10     /// ${a0}e 35 b0 e1
${op}mi r3, r14, #15    /// ${a8}e 37 a0 41
${op}smi r3, r14, #20   /// ${a0}e 3a b0 41
${op}s.mi r3, r14, #25  /// ${a8}e 3c b0 41
${op}mis r3, r14, #30   /// ${a0}e 3f b0 41

${op} r3, r14, r10      /// ${a1}e 3a a0 e1
${op}s r3, r14, r10     /// ${a1}e 3a b0 e1
${op}mi r3, r14, r10    /// ${a1}e 3a a0 41
${op}smi r3, r14, r10   /// ${a1}e 3a b0 41
${op}s.mi r3, r14, r10  /// ${a1}e 3a b0 41
${op}mis r3, r14, r10   /// ${a1}e 3a b0 41

${op} r3, r10           /// ${a1}3 3a a0 e1
${op}s r3, r10          /// ${a1}3 3a b0 e1
${op}mi r3, r10         /// ${a1}3 3a a0 41
${op}smi r3, r10        /// ${a1}3 3a b0 41
${op}s.mi r3, r10       /// ${a1}3 3a b0 41
${op}mis r3, r10        /// ${a1}3 3a b0 41
`,
      },
    });
  }

  def({
    name: 'arm.rrx',
    desc: 'Rotate right extended',
    kind: 'make',
    files: {
      '/root/main': `.arm
rrx r3, r14      /// 6e 30 a0 e1
rrxs r3, r14     /// 6e 30 b0 e1
rrxmi r3, r14    /// 6e 30 a0 41
rrxsmi r3, r14   /// 6e 30 b0 41
rrxs.mi r3, r14  /// 6e 30 b0 41
rrxmis r3, r14   /// 6e 30 b0 41

rrx r3           /// 63 30 a0 e1
rrxs r3          /// 63 30 b0 e1
rrxmi r3         /// 63 30 a0 41
rrxsmi r3        /// 63 30 b0 41
rrxs.mi r3       /// 63 30 b0 41
rrxmis r3        /// 63 30 b0 41
`,
    },
  });

  def({
    name: 'arm.mrs',
    desc: 'Transfer PSR to register',
    kind: 'make',
    files: {
      '/root/main': `.arm
mov r12, cpsr     /// 00 c0 0f e1
mov r12, spsr     /// 00 c0 4f e1
movvs r12, cpsr   /// 00 c0 0f 61
movvs r12, spsr   /// 00 c0 4f 61
mrs r12, cpsr     /// 00 c0 0f e1
mrs r12, spsr     /// 00 c0 4f e1
mrsvs r12, cpsr   /// 00 c0 0f 61
mrsvs r12, spsr   /// 00 c0 4f 61
`,
    },
  });

  def({
    name: 'arm.msr',
    desc: 'Transfer register to PSR',
    kind: 'make',
    files: {
      '/root/main': `.arm
mov cpsr, r13                /// 0d f0 29 e1
mov spsr, r13                /// 0d f0 69 e1
movvc cpsr, r13              /// 0d f0 29 71
movvc spsr, r13              /// 0d f0 69 71
msr cpsr, r13                /// 0d f0 29 e1
msr spsr, r13                /// 0d f0 69 e1
msrvc cpsr, r13              /// 0d f0 29 71
msrvc spsr, r13              /// 0d f0 69 71

mov cpsr_flg, r13            /// 0d f0 28 e1
mov spsr_flg, r13            /// 0d f0 68 e1
movvc cpsr_flg, r13          /// 0d f0 28 71
movvc spsr_flg, r13          /// 0d f0 68 71
msr cpsr_flg, r13            /// 0d f0 28 e1
msr spsr_flg, r13            /// 0d f0 68 e1
msrvc cpsr_flg, r13          /// 0d f0 28 71
msrvc spsr_flg, r13          /// 0d f0 68 71

mov cpsr, #0xf0000000        /// 0f f2 29 e3
mov spsr, #0xf0000000        /// 0f f2 69 e3
movvc cpsr, #0x50000000      /// 05 f2 29 73
movvc spsr, #0xf0000000      /// 0f f2 69 73
msr cpsr, #0xf0000000        /// 0f f2 29 e3
msr spsr, #0xf0000000        /// 0f f2 69 e3
msrvc cpsr, #0x50000000      /// 05 f2 29 73
msrvc spsr, #0xf0000000      /// 0f f2 69 73

mov cpsr_flg, #0xf0000000    /// 0f f2 28 e3
mov spsr_flg, #0xf0000000    /// 0f f2 68 e3
movvc cpsr_flg, #0x50000000  /// 05 f2 28 73
movvc spsr_flg, #0xf0000000  /// 0f f2 68 73
msr cpsr_flg, #0xf0000000    /// 0f f2 28 e3
msr spsr_flg, #0xf0000000    /// 0f f2 68 e3
msrvc cpsr_flg, #0x50000000  /// 05 f2 28 73
msrvc spsr_flg, #0xf0000000  /// 0f f2 68 73
`,
    },
  });

  def({
    name: 'arm.mul',
    desc: 'Multiply',
    kind: 'make',
    files: {
      '/root/main': `.arm
mul r1, r9, r4     /// 99 04 01 e0
muls r1, r9, r4    /// 99 04 11 e0
mulhi r1, r9, r4   /// 99 04 01 80
mulshi r1, r9, r4  /// 99 04 11 80
mulhis r1, r9, r4  /// 99 04 11 80
`,
    },
  });

  def({
    name: 'arm.mla',
    desc: 'Multiply and accumulate',
    kind: 'make',
    files: {
      '/root/main': `.arm
mla r1, r9, r4, r12     /// 99 c4 21 e0
mlas r1, r9, r4, r12    /// 99 c4 31 e0
mlahi r1, r9, r4, r12   /// 99 c4 21 80
mlashi r1, r9, r4, r12  /// 99 c4 31 80
mlahis r1, r9, r4, r12  /// 99 c4 31 80
`,
    },
  });

  def({
    name: 'arm.mull',
    desc: 'Multiply long',
    kind: 'make',
    files: {
      '/root/main': `.arm
umull r5, r3, r13, r11     /// 9d 5b 83 e0
umulls r5, r3, r13, r11    /// 9d 5b 93 e0
umullls r5, r3, r13, r11   /// 9d 5b 83 90
umullsls r5, r3, r13, r11  /// 9d 5b 93 90
umulllss r5, r3, r13, r11  /// 9d 5b 93 90
smull r5, r3, r13, r11     /// 9d 5b c3 e0
smulls r5, r3, r13, r11    /// 9d 5b d3 e0
smullls r5, r3, r13, r11   /// 9d 5b c3 90
smullsls r5, r3, r13, r11  /// 9d 5b d3 90
smulllss r5, r3, r13, r11  /// 9d 5b d3 90
`,
    },
  });

  def({
    name: 'arm.mlal',
    desc: 'Multiply and accumulate long',
    kind: 'make',
    files: {
      '/root/main': `.arm
umlal r5, r3, r13, r11     /// 9d 5b a3 e0
umlals r5, r3, r13, r11    /// 9d 5b b3 e0
umlalls r5, r3, r13, r11   /// 9d 5b a3 90
umlalsls r5, r3, r13, r11  /// 9d 5b b3 90
umlallss r5, r3, r13, r11  /// 9d 5b b3 90
smlal r5, r3, r13, r11     /// 9d 5b e3 e0
smlals r5, r3, r13, r11    /// 9d 5b f3 e0
smlalls r5, r3, r13, r11   /// 9d 5b e3 90
smlalsls r5, r3, r13, r11  /// 9d 5b f3 90
smlallss r5, r3, r13, r11  /// 9d 5b f3 90
`,
    },
  });

  for (
    const { op, desc, code } of [
      { op: 'str', desc: 'Store', code: 0 },
      { op: 'ldr', desc: 'Load', code: 1 },
    ]
  ) {
    const c0 = code.toString(16);
    const c2 = (code | 2).toString(16);
    const c4 = (code | 4).toString(16);
    const c6 = (code | 6).toString(16);
    const c8 = (code | 8).toString(16);
    const ca = (code | 10).toString(16);
    const cc = (code | 12).toString(16);
    const ce = (code | 14).toString(16);
    def({
      name: `arm.${op}`,
      desc,
      kind: 'make',
      files: {
        '/root/main': `.arm
${op} r2, [r9]                        /// 00 20 ${c8}9 e5
${op}b r2, [r9]                       /// 00 20 ${cc}9 e5
${op}ge r2, [r9]                      /// 00 20 ${c8}9 a5
${op}bge r2, [r9]                     /// 00 20 ${cc}9 a5
${op}geb r2, [r9]                     /// 00 20 ${cc}9 a5

//====================== PRE-INDEX ======================

//
// IMMEDIATE
//

${op} r2, [r9, #290]                  /// 22 21 ${c8}9 e5
${op}b r2, [r9, #290]                 /// 22 21 ${cc}9 e5
${op}ge r2, [r9, #290]                /// 22 21 ${c8}9 a5
${op}bge r2, [r9, #290]               /// 22 21 ${cc}9 a5
${op}geb r2, [r9, #290]               /// 22 21 ${cc}9 a5

${op} r2, [r9, #-290]                 /// 22 21 ${c0}9 e5
${op}b r2, [r9, #-290]                /// 22 21 ${c4}9 e5
${op}ge r2, [r9, #-290]               /// 22 21 ${c0}9 a5
${op}bge r2, [r9, #-290]              /// 22 21 ${c4}9 a5
${op}geb r2, [r9, #-290]              /// 22 21 ${c4}9 a5

${op} r2, [r9, #290]!                 /// 22 21 ${ca}9 e5
${op}b r2, [r9, #290]!                /// 22 21 ${ce}9 e5
${op}ge r2, [r9, #290]!               /// 22 21 ${ca}9 a5
${op}bge r2, [r9, #290]!              /// 22 21 ${ce}9 a5
${op}geb r2, [r9, #290]!              /// 22 21 ${ce}9 a5

${op} r2, [r9, #-290]!                /// 22 21 ${c2}9 e5
${op}b r2, [r9, #-290]!               /// 22 21 ${c6}9 e5
${op}ge r2, [r9, #-290]!              /// 22 21 ${c2}9 a5
${op}bge r2, [r9, #-290]!             /// 22 21 ${c6}9 a5
${op}geb r2, [r9, #-290]!             /// 22 21 ${c6}9 a5

//
// NO SHIFT
//

${op} r2, [r9, r10]                   /// 0a 20 ${c8}9 e7
${op}b r2, [r9, r10]                  /// 0a 20 ${cc}9 e7
${op}ge r2, [r9, r10]                 /// 0a 20 ${c8}9 a7
${op}bge r2, [r9, r10]                /// 0a 20 ${cc}9 a7
${op}geb r2, [r9, r10]                /// 0a 20 ${cc}9 a7

${op} r2, [r9, +r10]                  /// 0a 20 ${c8}9 e7
${op}b r2, [r9, +r10]                 /// 0a 20 ${cc}9 e7
${op}ge r2, [r9, +r10]                /// 0a 20 ${c8}9 a7
${op}bge r2, [r9, +r10]               /// 0a 20 ${cc}9 a7
${op}geb r2, [r9, +r10]               /// 0a 20 ${cc}9 a7

${op} r2, [r9, -r10]                  /// 0a 20 ${c0}9 e7
${op}b r2, [r9, -r10]                 /// 0a 20 ${c4}9 e7
${op}ge r2, [r9, -r10]                /// 0a 20 ${c0}9 a7
${op}bge r2, [r9, -r10]               /// 0a 20 ${c4}9 a7
${op}geb r2, [r9, -r10]               /// 0a 20 ${c4}9 a7

${op} r2, [r9, r10]!                  /// 0a 20 ${ca}9 e7
${op}b r2, [r9, r10]!                 /// 0a 20 ${ce}9 e7
${op}ge r2, [r9, r10]!                /// 0a 20 ${ca}9 a7
${op}bge r2, [r9, r10]!               /// 0a 20 ${ce}9 a7
${op}geb r2, [r9, r10]!               /// 0a 20 ${ce}9 a7

${op} r2, [r9, +r10]!                 /// 0a 20 ${ca}9 e7
${op}b r2, [r9, +r10]!                /// 0a 20 ${ce}9 e7
${op}ge r2, [r9, +r10]!               /// 0a 20 ${ca}9 a7
${op}bge r2, [r9, +r10]!              /// 0a 20 ${ce}9 a7
${op}geb r2, [r9, +r10]!              /// 0a 20 ${ce}9 a7

${op} r2, [r9, -r10]!                 /// 0a 20 ${c2}9 e7
${op}b r2, [r9, -r10]!                /// 0a 20 ${c6}9 e7
${op}ge r2, [r9, -r10]!               /// 0a 20 ${c2}9 a7
${op}bge r2, [r9, -r10]!              /// 0a 20 ${c6}9 a7
${op}geb r2, [r9, -r10]!              /// 0a 20 ${c6}9 a7

//
// LSL #0
//

${op} r2, [r9, r10, lsl #0]           /// 0a 20 ${c8}9 e7
${op}b r2, [r9, r10, lsl #0]          /// 0a 20 ${cc}9 e7
${op}ge r2, [r9, r10, lsl #0]         /// 0a 20 ${c8}9 a7
${op}bge r2, [r9, r10, lsl #0]        /// 0a 20 ${cc}9 a7
${op}geb r2, [r9, r10, lsl #0]        /// 0a 20 ${cc}9 a7

${op} r2, [r9, +r10, lsl #0]          /// 0a 20 ${c8}9 e7
${op}b r2, [r9, +r10, lsl #0]         /// 0a 20 ${cc}9 e7
${op}ge r2, [r9, +r10, lsl #0]        /// 0a 20 ${c8}9 a7
${op}bge r2, [r9, +r10, lsl #0]       /// 0a 20 ${cc}9 a7
${op}geb r2, [r9, +r10, lsl #0]       /// 0a 20 ${cc}9 a7

${op} r2, [r9, -r10, lsl #0]          /// 0a 20 ${c0}9 e7
${op}b r2, [r9, -r10, lsl #0]         /// 0a 20 ${c4}9 e7
${op}ge r2, [r9, -r10, lsl #0]        /// 0a 20 ${c0}9 a7
${op}bge r2, [r9, -r10, lsl #0]       /// 0a 20 ${c4}9 a7
${op}geb r2, [r9, -r10, lsl #0]       /// 0a 20 ${c4}9 a7

${op} r2, [r9, r10, lsl #0]!          /// 0a 20 ${ca}9 e7
${op}b r2, [r9, r10, lsl #0]!         /// 0a 20 ${ce}9 e7
${op}ge r2, [r9, r10, lsl #0]!        /// 0a 20 ${ca}9 a7
${op}bge r2, [r9, r10, lsl #0]!       /// 0a 20 ${ce}9 a7
${op}geb r2, [r9, r10, lsl #0]!       /// 0a 20 ${ce}9 a7

${op} r2, [r9, +r10, lsl #0]!         /// 0a 20 ${ca}9 e7
${op}b r2, [r9, +r10, lsl #0]!        /// 0a 20 ${ce}9 e7
${op}ge r2, [r9, +r10, lsl #0]!       /// 0a 20 ${ca}9 a7
${op}bge r2, [r9, +r10, lsl #0]!      /// 0a 20 ${ce}9 a7
${op}geb r2, [r9, +r10, lsl #0]!      /// 0a 20 ${ce}9 a7

${op} r2, [r9, -r10, lsl #0]!         /// 0a 20 ${c2}9 e7
${op}b r2, [r9, -r10, lsl #0]!        /// 0a 20 ${c6}9 e7
${op}ge r2, [r9, -r10, lsl #0]!       /// 0a 20 ${c2}9 a7
${op}bge r2, [r9, -r10, lsl #0]!      /// 0a 20 ${c6}9 a7
${op}geb r2, [r9, -r10, lsl #0]!      /// 0a 20 ${c6}9 a7

//
// LSR #0
//

${op} r2, [r9, r10, lsr #0]           /// 0a 20 ${c8}9 e7
${op}b r2, [r9, r10, lsr #0]          /// 0a 20 ${cc}9 e7
${op}ge r2, [r9, r10, lsr #0]         /// 0a 20 ${c8}9 a7
${op}bge r2, [r9, r10, lsr #0]        /// 0a 20 ${cc}9 a7
${op}geb r2, [r9, r10, lsr #0]        /// 0a 20 ${cc}9 a7

${op} r2, [r9, +r10, lsr #0]          /// 0a 20 ${c8}9 e7
${op}b r2, [r9, +r10, lsr #0]         /// 0a 20 ${cc}9 e7
${op}ge r2, [r9, +r10, lsr #0]        /// 0a 20 ${c8}9 a7
${op}bge r2, [r9, +r10, lsr #0]       /// 0a 20 ${cc}9 a7
${op}geb r2, [r9, +r10, lsr #0]       /// 0a 20 ${cc}9 a7

${op} r2, [r9, -r10, lsr #0]          /// 0a 20 ${c0}9 e7
${op}b r2, [r9, -r10, lsr #0]         /// 0a 20 ${c4}9 e7
${op}ge r2, [r9, -r10, lsr #0]        /// 0a 20 ${c0}9 a7
${op}bge r2, [r9, -r10, lsr #0]       /// 0a 20 ${c4}9 a7
${op}geb r2, [r9, -r10, lsr #0]       /// 0a 20 ${c4}9 a7

${op} r2, [r9, r10, lsr #0]!          /// 0a 20 ${ca}9 e7
${op}b r2, [r9, r10, lsr #0]!         /// 0a 20 ${ce}9 e7
${op}ge r2, [r9, r10, lsr #0]!        /// 0a 20 ${ca}9 a7
${op}bge r2, [r9, r10, lsr #0]!       /// 0a 20 ${ce}9 a7
${op}geb r2, [r9, r10, lsr #0]!       /// 0a 20 ${ce}9 a7

${op} r2, [r9, +r10, lsr #0]!         /// 0a 20 ${ca}9 e7
${op}b r2, [r9, +r10, lsr #0]!        /// 0a 20 ${ce}9 e7
${op}ge r2, [r9, +r10, lsr #0]!       /// 0a 20 ${ca}9 a7
${op}bge r2, [r9, +r10, lsr #0]!      /// 0a 20 ${ce}9 a7
${op}geb r2, [r9, +r10, lsr #0]!      /// 0a 20 ${ce}9 a7

${op} r2, [r9, -r10, lsr #0]!         /// 0a 20 ${c2}9 e7
${op}b r2, [r9, -r10, lsr #0]!        /// 0a 20 ${c6}9 e7
${op}ge r2, [r9, -r10, lsr #0]!       /// 0a 20 ${c2}9 a7
${op}bge r2, [r9, -r10, lsr #0]!      /// 0a 20 ${c6}9 a7
${op}geb r2, [r9, -r10, lsr #0]!      /// 0a 20 ${c6}9 a7

//
// ASR #0
//

${op} r2, [r9, r10, asr #0]           /// 0a 20 ${c8}9 e7
${op}b r2, [r9, r10, asr #0]          /// 0a 20 ${cc}9 e7
${op}ge r2, [r9, r10, asr #0]         /// 0a 20 ${c8}9 a7
${op}bge r2, [r9, r10, asr #0]        /// 0a 20 ${cc}9 a7
${op}geb r2, [r9, r10, asr #0]        /// 0a 20 ${cc}9 a7

${op} r2, [r9, +r10, asr #0]          /// 0a 20 ${c8}9 e7
${op}b r2, [r9, +r10, asr #0]         /// 0a 20 ${cc}9 e7
${op}ge r2, [r9, +r10, asr #0]        /// 0a 20 ${c8}9 a7
${op}bge r2, [r9, +r10, asr #0]       /// 0a 20 ${cc}9 a7
${op}geb r2, [r9, +r10, asr #0]       /// 0a 20 ${cc}9 a7

${op} r2, [r9, -r10, asr #0]          /// 0a 20 ${c0}9 e7
${op}b r2, [r9, -r10, asr #0]         /// 0a 20 ${c4}9 e7
${op}ge r2, [r9, -r10, asr #0]        /// 0a 20 ${c0}9 a7
${op}bge r2, [r9, -r10, asr #0]       /// 0a 20 ${c4}9 a7
${op}geb r2, [r9, -r10, asr #0]       /// 0a 20 ${c4}9 a7

${op} r2, [r9, r10, asr #0]!          /// 0a 20 ${ca}9 e7
${op}b r2, [r9, r10, asr #0]!         /// 0a 20 ${ce}9 e7
${op}ge r2, [r9, r10, asr #0]!        /// 0a 20 ${ca}9 a7
${op}bge r2, [r9, r10, asr #0]!       /// 0a 20 ${ce}9 a7
${op}geb r2, [r9, r10, asr #0]!       /// 0a 20 ${ce}9 a7

${op} r2, [r9, +r10, asr #0]!         /// 0a 20 ${ca}9 e7
${op}b r2, [r9, +r10, asr #0]!        /// 0a 20 ${ce}9 e7
${op}ge r2, [r9, +r10, asr #0]!       /// 0a 20 ${ca}9 a7
${op}bge r2, [r9, +r10, asr #0]!      /// 0a 20 ${ce}9 a7
${op}geb r2, [r9, +r10, asr #0]!      /// 0a 20 ${ce}9 a7

${op} r2, [r9, -r10, asr #0]!         /// 0a 20 ${c2}9 e7
${op}b r2, [r9, -r10, asr #0]!        /// 0a 20 ${c6}9 e7
${op}ge r2, [r9, -r10, asr #0]!       /// 0a 20 ${c2}9 a7
${op}bge r2, [r9, -r10, asr #0]!      /// 0a 20 ${c6}9 a7
${op}geb r2, [r9, -r10, asr #0]!      /// 0a 20 ${c6}9 a7

//
// ROR #0
//

${op} r2, [r9, r10, ror #0]           /// 0a 20 ${c8}9 e7
${op}b r2, [r9, r10, ror #0]          /// 0a 20 ${cc}9 e7
${op}ge r2, [r9, r10, ror #0]         /// 0a 20 ${c8}9 a7
${op}bge r2, [r9, r10, ror #0]        /// 0a 20 ${cc}9 a7
${op}geb r2, [r9, r10, ror #0]        /// 0a 20 ${cc}9 a7

${op} r2, [r9, +r10, ror #0]          /// 0a 20 ${c8}9 e7
${op}b r2, [r9, +r10, ror #0]         /// 0a 20 ${cc}9 e7
${op}ge r2, [r9, +r10, ror #0]        /// 0a 20 ${c8}9 a7
${op}bge r2, [r9, +r10, ror #0]       /// 0a 20 ${cc}9 a7
${op}geb r2, [r9, +r10, ror #0]       /// 0a 20 ${cc}9 a7

${op} r2, [r9, -r10, ror #0]          /// 0a 20 ${c0}9 e7
${op}b r2, [r9, -r10, ror #0]         /// 0a 20 ${c4}9 e7
${op}ge r2, [r9, -r10, ror #0]        /// 0a 20 ${c0}9 a7
${op}bge r2, [r9, -r10, ror #0]       /// 0a 20 ${c4}9 a7
${op}geb r2, [r9, -r10, ror #0]       /// 0a 20 ${c4}9 a7

${op} r2, [r9, r10, ror #0]!          /// 0a 20 ${ca}9 e7
${op}b r2, [r9, r10, ror #0]!         /// 0a 20 ${ce}9 e7
${op}ge r2, [r9, r10, ror #0]!        /// 0a 20 ${ca}9 a7
${op}bge r2, [r9, r10, ror #0]!       /// 0a 20 ${ce}9 a7
${op}geb r2, [r9, r10, ror #0]!       /// 0a 20 ${ce}9 a7

${op} r2, [r9, +r10, ror #0]!         /// 0a 20 ${ca}9 e7
${op}b r2, [r9, +r10, ror #0]!        /// 0a 20 ${ce}9 e7
${op}ge r2, [r9, +r10, ror #0]!       /// 0a 20 ${ca}9 a7
${op}bge r2, [r9, +r10, ror #0]!      /// 0a 20 ${ce}9 a7
${op}geb r2, [r9, +r10, ror #0]!      /// 0a 20 ${ce}9 a7

${op} r2, [r9, -r10, ror #0]!         /// 0a 20 ${c2}9 e7
${op}b r2, [r9, -r10, ror #0]!        /// 0a 20 ${c6}9 e7
${op}ge r2, [r9, -r10, ror #0]!       /// 0a 20 ${c2}9 a7
${op}bge r2, [r9, -r10, ror #0]!      /// 0a 20 ${c6}9 a7
${op}geb r2, [r9, -r10, ror #0]!      /// 0a 20 ${c6}9 a7

//
// LSR #32
//

${op} r2, [r9, r10, lsr #32]          /// 2a 20 ${c8}9 e7
${op}b r2, [r9, r10, lsr #32]         /// 2a 20 ${cc}9 e7
${op}ge r2, [r9, r10, lsr #32]        /// 2a 20 ${c8}9 a7
${op}bge r2, [r9, r10, lsr #32]       /// 2a 20 ${cc}9 a7
${op}geb r2, [r9, r10, lsr #32]       /// 2a 20 ${cc}9 a7

${op} r2, [r9, +r10, lsr #32]         /// 2a 20 ${c8}9 e7
${op}b r2, [r9, +r10, lsr #32]        /// 2a 20 ${cc}9 e7
${op}ge r2, [r9, +r10, lsr #32]       /// 2a 20 ${c8}9 a7
${op}bge r2, [r9, +r10, lsr #32]      /// 2a 20 ${cc}9 a7
${op}geb r2, [r9, +r10, lsr #32]      /// 2a 20 ${cc}9 a7

${op} r2, [r9, -r10, lsr #32]         /// 2a 20 ${c0}9 e7
${op}b r2, [r9, -r10, lsr #32]        /// 2a 20 ${c4}9 e7
${op}ge r2, [r9, -r10, lsr #32]       /// 2a 20 ${c0}9 a7
${op}bge r2, [r9, -r10, lsr #32]      /// 2a 20 ${c4}9 a7
${op}geb r2, [r9, -r10, lsr #32]      /// 2a 20 ${c4}9 a7

${op} r2, [r9, r10, lsr #32]!         /// 2a 20 ${ca}9 e7
${op}b r2, [r9, r10, lsr #32]!        /// 2a 20 ${ce}9 e7
${op}ge r2, [r9, r10, lsr #32]!       /// 2a 20 ${ca}9 a7
${op}bge r2, [r9, r10, lsr #32]!      /// 2a 20 ${ce}9 a7
${op}geb r2, [r9, r10, lsr #32]!      /// 2a 20 ${ce}9 a7

${op} r2, [r9, +r10, lsr #32]!        /// 2a 20 ${ca}9 e7
${op}b r2, [r9, +r10, lsr #32]!       /// 2a 20 ${ce}9 e7
${op}ge r2, [r9, +r10, lsr #32]!      /// 2a 20 ${ca}9 a7
${op}bge r2, [r9, +r10, lsr #32]!     /// 2a 20 ${ce}9 a7
${op}geb r2, [r9, +r10, lsr #32]!     /// 2a 20 ${ce}9 a7

${op} r2, [r9, -r10, lsr #32]!        /// 2a 20 ${c2}9 e7
${op}b r2, [r9, -r10, lsr #32]!       /// 2a 20 ${c6}9 e7
${op}ge r2, [r9, -r10, lsr #32]!      /// 2a 20 ${c2}9 a7
${op}bge r2, [r9, -r10, lsr #32]!     /// 2a 20 ${c6}9 a7
${op}geb r2, [r9, -r10, lsr #32]!     /// 2a 20 ${c6}9 a7

//
// ASR #32
//

${op} r2, [r9, r10, asr #32]          /// 4a 20 ${c8}9 e7
${op}b r2, [r9, r10, asr #32]         /// 4a 20 ${cc}9 e7
${op}ge r2, [r9, r10, asr #32]        /// 4a 20 ${c8}9 a7
${op}bge r2, [r9, r10, asr #32]       /// 4a 20 ${cc}9 a7
${op}geb r2, [r9, r10, asr #32]       /// 4a 20 ${cc}9 a7

${op} r2, [r9, +r10, asr #32]         /// 4a 20 ${c8}9 e7
${op}b r2, [r9, +r10, asr #32]        /// 4a 20 ${cc}9 e7
${op}ge r2, [r9, +r10, asr #32]       /// 4a 20 ${c8}9 a7
${op}bge r2, [r9, +r10, asr #32]      /// 4a 20 ${cc}9 a7
${op}geb r2, [r9, +r10, asr #32]      /// 4a 20 ${cc}9 a7

${op} r2, [r9, -r10, asr #32]         /// 4a 20 ${c0}9 e7
${op}b r2, [r9, -r10, asr #32]        /// 4a 20 ${c4}9 e7
${op}ge r2, [r9, -r10, asr #32]       /// 4a 20 ${c0}9 a7
${op}bge r2, [r9, -r10, asr #32]      /// 4a 20 ${c4}9 a7
${op}geb r2, [r9, -r10, asr #32]      /// 4a 20 ${c4}9 a7

${op} r2, [r9, r10, asr #32]!         /// 4a 20 ${ca}9 e7
${op}b r2, [r9, r10, asr #32]!        /// 4a 20 ${ce}9 e7
${op}ge r2, [r9, r10, asr #32]!       /// 4a 20 ${ca}9 a7
${op}bge r2, [r9, r10, asr #32]!      /// 4a 20 ${ce}9 a7
${op}geb r2, [r9, r10, asr #32]!      /// 4a 20 ${ce}9 a7

${op} r2, [r9, +r10, asr #32]!        /// 4a 20 ${ca}9 e7
${op}b r2, [r9, +r10, asr #32]!       /// 4a 20 ${ce}9 e7
${op}ge r2, [r9, +r10, asr #32]!      /// 4a 20 ${ca}9 a7
${op}bge r2, [r9, +r10, asr #32]!     /// 4a 20 ${ce}9 a7
${op}geb r2, [r9, +r10, asr #32]!     /// 4a 20 ${ce}9 a7

${op} r2, [r9, -r10, asr #32]!        /// 4a 20 ${c2}9 e7
${op}b r2, [r9, -r10, asr #32]!       /// 4a 20 ${c6}9 e7
${op}ge r2, [r9, -r10, asr #32]!      /// 4a 20 ${c2}9 a7
${op}bge r2, [r9, -r10, asr #32]!     /// 4a 20 ${c6}9 a7
${op}geb r2, [r9, -r10, asr #32]!     /// 4a 20 ${c6}9 a7

//
// RRX
//

${op} r2, [r9, r10, rrx]              /// 6a 20 ${c8}9 e7
${op}b r2, [r9, r10, rrx]             /// 6a 20 ${cc}9 e7
${op}ge r2, [r9, r10, rrx]            /// 6a 20 ${c8}9 a7
${op}bge r2, [r9, r10, rrx]           /// 6a 20 ${cc}9 a7
${op}geb r2, [r9, r10, rrx]           /// 6a 20 ${cc}9 a7

${op} r2, [r9, +r10, rrx]             /// 6a 20 ${c8}9 e7
${op}b r2, [r9, +r10, rrx]            /// 6a 20 ${cc}9 e7
${op}ge r2, [r9, +r10, rrx]           /// 6a 20 ${c8}9 a7
${op}bge r2, [r9, +r10, rrx]          /// 6a 20 ${cc}9 a7
${op}geb r2, [r9, +r10, rrx]          /// 6a 20 ${cc}9 a7

${op} r2, [r9, -r10, rrx]             /// 6a 20 ${c0}9 e7
${op}b r2, [r9, -r10, rrx]            /// 6a 20 ${c4}9 e7
${op}ge r2, [r9, -r10, rrx]           /// 6a 20 ${c0}9 a7
${op}bge r2, [r9, -r10, rrx]          /// 6a 20 ${c4}9 a7
${op}geb r2, [r9, -r10, rrx]          /// 6a 20 ${c4}9 a7

${op} r2, [r9, r10, rrx]!             /// 6a 20 ${ca}9 e7
${op}b r2, [r9, r10, rrx]!            /// 6a 20 ${ce}9 e7
${op}ge r2, [r9, r10, rrx]!           /// 6a 20 ${ca}9 a7
${op}bge r2, [r9, r10, rrx]!          /// 6a 20 ${ce}9 a7
${op}geb r2, [r9, r10, rrx]!          /// 6a 20 ${ce}9 a7

${op} r2, [r9, +r10, rrx]!            /// 6a 20 ${ca}9 e7
${op}b r2, [r9, +r10, rrx]!           /// 6a 20 ${ce}9 e7
${op}ge r2, [r9, +r10, rrx]!          /// 6a 20 ${ca}9 a7
${op}bge r2, [r9, +r10, rrx]!         /// 6a 20 ${ce}9 a7
${op}geb r2, [r9, +r10, rrx]!         /// 6a 20 ${ce}9 a7

${op} r2, [r9, -r10, rrx]!            /// 6a 20 ${c2}9 e7
${op}b r2, [r9, -r10, rrx]!           /// 6a 20 ${c6}9 e7
${op}ge r2, [r9, -r10, rrx]!          /// 6a 20 ${c2}9 a7
${op}bge r2, [r9, -r10, rrx]!         /// 6a 20 ${c6}9 a7
${op}geb r2, [r9, -r10, rrx]!         /// 6a 20 ${c6}9 a7

//
// GENERIC SHIFT
//

${op} r2, [r9, -r10, lsl #13]         /// 8a 26 ${c0}9 e7
${op}b r2, [r9, +r10, lsr #13]        /// aa 26 ${cc}9 e7
${op}ge r2, [r9, +r10, asr #13]       /// ca 26 ${c8}9 a7
${op}bge r2, [r9, r10, ror #13]       /// ea 26 ${cc}9 a7
${op}geb r2, [r9, -r10, lsl #13]      /// 8a 26 ${c4}9 a7

${op} r2, [r9, -r10, lsl #13]!        /// 8a 26 ${c2}9 e7
${op}b r2, [r9, +r10, lsr #13]!       /// aa 26 ${ce}9 e7
${op}ge r2, [r9, +r10, asr #13]!      /// ca 26 ${ca}9 a7
${op}bge r2, [r9, r10, ror #13]!      /// ea 26 ${ce}9 a7
${op}geb r2, [r9, -r10, lsl #13]!     /// 8a 26 ${c6}9 a7

//===================== POST-INDEX ======================

//
// IMMEDIATE
//

${op} r2, [r9], #290                  /// 22 21 ${c8}9 e4
${op}b r2, [r9], #290                 /// 22 21 ${cc}9 e4
${op}ge r2, [r9], #290                /// 22 21 ${c8}9 a4
${op}bge r2, [r9], #290               /// 22 21 ${cc}9 a4
${op}geb r2, [r9], #290               /// 22 21 ${cc}9 a4

${op} r2, [r9], #-290                 /// 22 21 ${c0}9 e4
${op}b r2, [r9], #-290                /// 22 21 ${c4}9 e4
${op}ge r2, [r9], #-290               /// 22 21 ${c0}9 a4
${op}bge r2, [r9], #-290              /// 22 21 ${c4}9 a4
${op}geb r2, [r9], #-290              /// 22 21 ${c4}9 a4

${op}t r2, [r9], #290                 /// 22 21 ${ca}9 e4
${op}bt r2, [r9], #290                /// 22 21 ${ce}9 e4
${op}tge r2, [r9], #290               /// 22 21 ${ca}9 a4
${op}get r2, [r9], #290               /// 22 21 ${ca}9 a4
${op}btge r2, [r9], #290              /// 22 21 ${ce}9 a4
${op}gebt r2, [r9], #290              /// 22 21 ${ce}9 a4

${op}t r2, [r9], #-290                /// 22 21 ${c2}9 e4
${op}bt r2, [r9], #-290               /// 22 21 ${c6}9 e4
${op}tge r2, [r9], #-290              /// 22 21 ${c2}9 a4
${op}get r2, [r9], #-290              /// 22 21 ${c2}9 a4
${op}btge r2, [r9], #-290             /// 22 21 ${c6}9 a4
${op}gebt r2, [r9], #-290             /// 22 21 ${c6}9 a4

//
// NO SHIFT
//

${op} r2, [r9], r10                   /// 0a 20 ${c8}9 e6
${op}b r2, [r9], r10                  /// 0a 20 ${cc}9 e6
${op}ge r2, [r9], r10                 /// 0a 20 ${c8}9 a6
${op}bge r2, [r9], r10                /// 0a 20 ${cc}9 a6
${op}geb r2, [r9], r10                /// 0a 20 ${cc}9 a6

${op} r2, [r9], +r10                  /// 0a 20 ${c8}9 e6
${op}b r2, [r9], +r10                 /// 0a 20 ${cc}9 e6
${op}ge r2, [r9], +r10                /// 0a 20 ${c8}9 a6
${op}bge r2, [r9], +r10               /// 0a 20 ${cc}9 a6
${op}geb r2, [r9], +r10               /// 0a 20 ${cc}9 a6

${op} r2, [r9], -r10                  /// 0a 20 ${c0}9 e6
${op}b r2, [r9], -r10                 /// 0a 20 ${c4}9 e6
${op}ge r2, [r9], -r10                /// 0a 20 ${c0}9 a6
${op}bge r2, [r9], -r10               /// 0a 20 ${c4}9 a6
${op}geb r2, [r9], -r10               /// 0a 20 ${c4}9 a6

${op}t r2, [r9], r10                  /// 0a 20 ${ca}9 e6
${op}bt r2, [r9], r10                 /// 0a 20 ${ce}9 e6
${op}tge r2, [r9], r10                /// 0a 20 ${ca}9 a6
${op}get r2, [r9], r10                /// 0a 20 ${ca}9 a6
${op}btge r2, [r9], r10               /// 0a 20 ${ce}9 a6
${op}gebt r2, [r9], r10               /// 0a 20 ${ce}9 a6

${op}t r2, [r9], +r10                 /// 0a 20 ${ca}9 e6
${op}bt r2, [r9], +r10                /// 0a 20 ${ce}9 e6
${op}tge r2, [r9], +r10               /// 0a 20 ${ca}9 a6
${op}get r2, [r9], +r10               /// 0a 20 ${ca}9 a6
${op}btge r2, [r9], +r10              /// 0a 20 ${ce}9 a6
${op}gebt r2, [r9], +r10              /// 0a 20 ${ce}9 a6

${op}t r2, [r9], -r10                 /// 0a 20 ${c2}9 e6
${op}bt r2, [r9], -r10                /// 0a 20 ${c6}9 e6
${op}tge r2, [r9], -r10               /// 0a 20 ${c2}9 a6
${op}get r2, [r9], -r10               /// 0a 20 ${c2}9 a6
${op}btge r2, [r9], -r10              /// 0a 20 ${c6}9 a6
${op}gebt r2, [r9], -r10              /// 0a 20 ${c6}9 a6

//
// LSL #0
//

${op} r2, [r9], r10, lsl #0           /// 0a 20 ${c8}9 e6
${op}b r2, [r9], r10, lsl #0          /// 0a 20 ${cc}9 e6
${op}ge r2, [r9], r10, lsl #0         /// 0a 20 ${c8}9 a6
${op}bge r2, [r9], r10, lsl #0        /// 0a 20 ${cc}9 a6
${op}geb r2, [r9], r10, lsl #0        /// 0a 20 ${cc}9 a6

${op} r2, [r9], +r10, lsl #0          /// 0a 20 ${c8}9 e6
${op}b r2, [r9], +r10, lsl #0         /// 0a 20 ${cc}9 e6
${op}ge r2, [r9], +r10, lsl #0        /// 0a 20 ${c8}9 a6
${op}bge r2, [r9], +r10, lsl #0       /// 0a 20 ${cc}9 a6
${op}geb r2, [r9], +r10, lsl #0       /// 0a 20 ${cc}9 a6

${op} r2, [r9], -r10, lsl #0          /// 0a 20 ${c0}9 e6
${op}b r2, [r9], -r10, lsl #0         /// 0a 20 ${c4}9 e6
${op}ge r2, [r9], -r10, lsl #0        /// 0a 20 ${c0}9 a6
${op}bge r2, [r9], -r10, lsl #0       /// 0a 20 ${c4}9 a6
${op}geb r2, [r9], -r10, lsl #0       /// 0a 20 ${c4}9 a6

${op}t r2, [r9], r10, lsl #0          /// 0a 20 ${ca}9 e6
${op}bt r2, [r9], r10, lsl #0         /// 0a 20 ${ce}9 e6
${op}tge r2, [r9], r10, lsl #0        /// 0a 20 ${ca}9 a6
${op}get r2, [r9], r10, lsl #0        /// 0a 20 ${ca}9 a6
${op}btge r2, [r9], r10, lsl #0       /// 0a 20 ${ce}9 a6
${op}gebt r2, [r9], r10, lsl #0       /// 0a 20 ${ce}9 a6

${op}t r2, [r9], +r10, lsl #0         /// 0a 20 ${ca}9 e6
${op}bt r2, [r9], +r10, lsl #0        /// 0a 20 ${ce}9 e6
${op}tge r2, [r9], +r10, lsl #0       /// 0a 20 ${ca}9 a6
${op}get r2, [r9], +r10, lsl #0       /// 0a 20 ${ca}9 a6
${op}btge r2, [r9], +r10, lsl #0      /// 0a 20 ${ce}9 a6
${op}gebt r2, [r9], +r10, lsl #0      /// 0a 20 ${ce}9 a6

${op}t r2, [r9], -r10, lsl #0         /// 0a 20 ${c2}9 e6
${op}bt r2, [r9], -r10, lsl #0        /// 0a 20 ${c6}9 e6
${op}tge r2, [r9], -r10, lsl #0       /// 0a 20 ${c2}9 a6
${op}get r2, [r9], -r10, lsl #0       /// 0a 20 ${c2}9 a6
${op}btge r2, [r9], -r10, lsl #0      /// 0a 20 ${c6}9 a6
${op}gebt r2, [r9], -r10, lsl #0      /// 0a 20 ${c6}9 a6

//
// LSR #0
//

${op} r2, [r9], r10, lsr #0           /// 0a 20 ${c8}9 e6
${op}b r2, [r9], r10, lsr #0          /// 0a 20 ${cc}9 e6
${op}ge r2, [r9], r10, lsr #0         /// 0a 20 ${c8}9 a6
${op}bge r2, [r9], r10, lsr #0        /// 0a 20 ${cc}9 a6
${op}geb r2, [r9], r10, lsr #0        /// 0a 20 ${cc}9 a6

${op} r2, [r9], +r10, lsr #0          /// 0a 20 ${c8}9 e6
${op}b r2, [r9], +r10, lsr #0         /// 0a 20 ${cc}9 e6
${op}ge r2, [r9], +r10, lsr #0        /// 0a 20 ${c8}9 a6
${op}bge r2, [r9], +r10, lsr #0       /// 0a 20 ${cc}9 a6
${op}geb r2, [r9], +r10, lsr #0       /// 0a 20 ${cc}9 a6

${op} r2, [r9], -r10, lsr #0          /// 0a 20 ${c0}9 e6
${op}b r2, [r9], -r10, lsr #0         /// 0a 20 ${c4}9 e6
${op}ge r2, [r9], -r10, lsr #0        /// 0a 20 ${c0}9 a6
${op}bge r2, [r9], -r10, lsr #0       /// 0a 20 ${c4}9 a6
${op}geb r2, [r9], -r10, lsr #0       /// 0a 20 ${c4}9 a6

${op}t r2, [r9], r10, lsr #0          /// 0a 20 ${ca}9 e6
${op}bt r2, [r9], r10, lsr #0         /// 0a 20 ${ce}9 e6
${op}tge r2, [r9], r10, lsr #0        /// 0a 20 ${ca}9 a6
${op}get r2, [r9], r10, lsr #0        /// 0a 20 ${ca}9 a6
${op}btge r2, [r9], r10, lsr #0       /// 0a 20 ${ce}9 a6
${op}gebt r2, [r9], r10, lsr #0       /// 0a 20 ${ce}9 a6

${op}t r2, [r9], +r10, lsr #0         /// 0a 20 ${ca}9 e6
${op}bt r2, [r9], +r10, lsr #0        /// 0a 20 ${ce}9 e6
${op}tge r2, [r9], +r10, lsr #0       /// 0a 20 ${ca}9 a6
${op}get r2, [r9], +r10, lsr #0       /// 0a 20 ${ca}9 a6
${op}btge r2, [r9], +r10, lsr #0      /// 0a 20 ${ce}9 a6
${op}gebt r2, [r9], +r10, lsr #0      /// 0a 20 ${ce}9 a6

${op}t r2, [r9], -r10, lsr #0         /// 0a 20 ${c2}9 e6
${op}bt r2, [r9], -r10, lsr #0        /// 0a 20 ${c6}9 e6
${op}tge r2, [r9], -r10, lsr #0       /// 0a 20 ${c2}9 a6
${op}get r2, [r9], -r10, lsr #0       /// 0a 20 ${c2}9 a6
${op}btge r2, [r9], -r10, lsr #0      /// 0a 20 ${c6}9 a6
${op}gebt r2, [r9], -r10, lsr #0      /// 0a 20 ${c6}9 a6

//
// ASR #0
//

${op} r2, [r9], r10, asr #0           /// 0a 20 ${c8}9 e6
${op}b r2, [r9], r10, asr #0          /// 0a 20 ${cc}9 e6
${op}ge r2, [r9], r10, asr #0         /// 0a 20 ${c8}9 a6
${op}bge r2, [r9], r10, asr #0        /// 0a 20 ${cc}9 a6
${op}geb r2, [r9], r10, asr #0        /// 0a 20 ${cc}9 a6

${op} r2, [r9], +r10, asr #0          /// 0a 20 ${c8}9 e6
${op}b r2, [r9], +r10, asr #0         /// 0a 20 ${cc}9 e6
${op}ge r2, [r9], +r10, asr #0        /// 0a 20 ${c8}9 a6
${op}bge r2, [r9], +r10, asr #0       /// 0a 20 ${cc}9 a6
${op}geb r2, [r9], +r10, asr #0       /// 0a 20 ${cc}9 a6

${op} r2, [r9], -r10, asr #0          /// 0a 20 ${c0}9 e6
${op}b r2, [r9], -r10, asr #0         /// 0a 20 ${c4}9 e6
${op}ge r2, [r9], -r10, asr #0        /// 0a 20 ${c0}9 a6
${op}bge r2, [r9], -r10, asr #0       /// 0a 20 ${c4}9 a6
${op}geb r2, [r9], -r10, asr #0       /// 0a 20 ${c4}9 a6

${op}t r2, [r9], r10, asr #0          /// 0a 20 ${ca}9 e6
${op}bt r2, [r9], r10, asr #0         /// 0a 20 ${ce}9 e6
${op}tge r2, [r9], r10, asr #0        /// 0a 20 ${ca}9 a6
${op}get r2, [r9], r10, asr #0        /// 0a 20 ${ca}9 a6
${op}btge r2, [r9], r10, asr #0       /// 0a 20 ${ce}9 a6
${op}gebt r2, [r9], r10, asr #0       /// 0a 20 ${ce}9 a6

${op}t r2, [r9], +r10, asr #0         /// 0a 20 ${ca}9 e6
${op}bt r2, [r9], +r10, asr #0        /// 0a 20 ${ce}9 e6
${op}tge r2, [r9], +r10, asr #0       /// 0a 20 ${ca}9 a6
${op}get r2, [r9], +r10, asr #0       /// 0a 20 ${ca}9 a6
${op}btge r2, [r9], +r10, asr #0      /// 0a 20 ${ce}9 a6
${op}gebt r2, [r9], +r10, asr #0      /// 0a 20 ${ce}9 a6

${op}t r2, [r9], -r10, asr #0         /// 0a 20 ${c2}9 e6
${op}bt r2, [r9], -r10, asr #0        /// 0a 20 ${c6}9 e6
${op}tge r2, [r9], -r10, asr #0       /// 0a 20 ${c2}9 a6
${op}get r2, [r9], -r10, asr #0       /// 0a 20 ${c2}9 a6
${op}btge r2, [r9], -r10, asr #0      /// 0a 20 ${c6}9 a6
${op}gebt r2, [r9], -r10, asr #0      /// 0a 20 ${c6}9 a6

//
// ROR #0
//

${op} r2, [r9], r10, ror #0           /// 0a 20 ${c8}9 e6
${op}b r2, [r9], r10, ror #0          /// 0a 20 ${cc}9 e6
${op}ge r2, [r9], r10, ror #0         /// 0a 20 ${c8}9 a6
${op}bge r2, [r9], r10, ror #0        /// 0a 20 ${cc}9 a6
${op}geb r2, [r9], r10, ror #0        /// 0a 20 ${cc}9 a6

${op} r2, [r9], +r10, ror #0          /// 0a 20 ${c8}9 e6
${op}b r2, [r9], +r10, ror #0         /// 0a 20 ${cc}9 e6
${op}ge r2, [r9], +r10, ror #0        /// 0a 20 ${c8}9 a6
${op}bge r2, [r9], +r10, ror #0       /// 0a 20 ${cc}9 a6
${op}geb r2, [r9], +r10, ror #0       /// 0a 20 ${cc}9 a6

${op} r2, [r9], -r10, ror #0          /// 0a 20 ${c0}9 e6
${op}b r2, [r9], -r10, ror #0         /// 0a 20 ${c4}9 e6
${op}ge r2, [r9], -r10, ror #0        /// 0a 20 ${c0}9 a6
${op}bge r2, [r9], -r10, ror #0       /// 0a 20 ${c4}9 a6
${op}geb r2, [r9], -r10, ror #0       /// 0a 20 ${c4}9 a6

${op}t r2, [r9], r10, ror #0          /// 0a 20 ${ca}9 e6
${op}bt r2, [r9], r10, ror #0         /// 0a 20 ${ce}9 e6
${op}tge r2, [r9], r10, ror #0        /// 0a 20 ${ca}9 a6
${op}get r2, [r9], r10, ror #0        /// 0a 20 ${ca}9 a6
${op}btge r2, [r9], r10, ror #0       /// 0a 20 ${ce}9 a6
${op}gebt r2, [r9], r10, ror #0       /// 0a 20 ${ce}9 a6

${op}t r2, [r9], +r10, ror #0         /// 0a 20 ${ca}9 e6
${op}bt r2, [r9], +r10, ror #0        /// 0a 20 ${ce}9 e6
${op}tge r2, [r9], +r10, ror #0       /// 0a 20 ${ca}9 a6
${op}get r2, [r9], +r10, ror #0       /// 0a 20 ${ca}9 a6
${op}btge r2, [r9], +r10, ror #0      /// 0a 20 ${ce}9 a6
${op}gebt r2, [r9], +r10, ror #0      /// 0a 20 ${ce}9 a6

${op}t r2, [r9], -r10, ror #0         /// 0a 20 ${c2}9 e6
${op}bt r2, [r9], -r10, ror #0        /// 0a 20 ${c6}9 e6
${op}tge r2, [r9], -r10, ror #0       /// 0a 20 ${c2}9 a6
${op}get r2, [r9], -r10, ror #0       /// 0a 20 ${c2}9 a6
${op}btge r2, [r9], -r10, ror #0      /// 0a 20 ${c6}9 a6
${op}gebt r2, [r9], -r10, ror #0      /// 0a 20 ${c6}9 a6

//
// LSR #32
//

${op} r2, [r9], r10, lsr #32          /// 2a 20 ${c8}9 e6
${op}b r2, [r9], r10, lsr #32         /// 2a 20 ${cc}9 e6
${op}ge r2, [r9], r10, lsr #32        /// 2a 20 ${c8}9 a6
${op}bge r2, [r9], r10, lsr #32       /// 2a 20 ${cc}9 a6
${op}geb r2, [r9], r10, lsr #32       /// 2a 20 ${cc}9 a6

${op} r2, [r9], +r10, lsr #32         /// 2a 20 ${c8}9 e6
${op}b r2, [r9], +r10, lsr #32        /// 2a 20 ${cc}9 e6
${op}ge r2, [r9], +r10, lsr #32       /// 2a 20 ${c8}9 a6
${op}bge r2, [r9], +r10, lsr #32      /// 2a 20 ${cc}9 a6
${op}geb r2, [r9], +r10, lsr #32      /// 2a 20 ${cc}9 a6

${op} r2, [r9], -r10, lsr #32         /// 2a 20 ${c0}9 e6
${op}b r2, [r9], -r10, lsr #32        /// 2a 20 ${c4}9 e6
${op}ge r2, [r9], -r10, lsr #32       /// 2a 20 ${c0}9 a6
${op}bge r2, [r9], -r10, lsr #32      /// 2a 20 ${c4}9 a6
${op}geb r2, [r9], -r10, lsr #32      /// 2a 20 ${c4}9 a6

${op}t r2, [r9], r10, lsr #32         /// 2a 20 ${ca}9 e6
${op}bt r2, [r9], r10, lsr #32        /// 2a 20 ${ce}9 e6
${op}tge r2, [r9], r10, lsr #32       /// 2a 20 ${ca}9 a6
${op}get r2, [r9], r10, lsr #32       /// 2a 20 ${ca}9 a6
${op}btge r2, [r9], r10, lsr #32      /// 2a 20 ${ce}9 a6
${op}gebt r2, [r9], r10, lsr #32      /// 2a 20 ${ce}9 a6

${op}t r2, [r9], +r10, lsr #32        /// 2a 20 ${ca}9 e6
${op}bt r2, [r9], +r10, lsr #32       /// 2a 20 ${ce}9 e6
${op}tge r2, [r9], +r10, lsr #32      /// 2a 20 ${ca}9 a6
${op}get r2, [r9], +r10, lsr #32      /// 2a 20 ${ca}9 a6
${op}btge r2, [r9], +r10, lsr #32     /// 2a 20 ${ce}9 a6
${op}gebt r2, [r9], +r10, lsr #32     /// 2a 20 ${ce}9 a6

${op}t r2, [r9], -r10, lsr #32        /// 2a 20 ${c2}9 e6
${op}bt r2, [r9], -r10, lsr #32       /// 2a 20 ${c6}9 e6
${op}tge r2, [r9], -r10, lsr #32      /// 2a 20 ${c2}9 a6
${op}get r2, [r9], -r10, lsr #32      /// 2a 20 ${c2}9 a6
${op}btge r2, [r9], -r10, lsr #32     /// 2a 20 ${c6}9 a6
${op}gebt r2, [r9], -r10, lsr #32     /// 2a 20 ${c6}9 a6

//
// ASR #32
//

${op} r2, [r9], r10, asr #32          /// 4a 20 ${c8}9 e6
${op}b r2, [r9], r10, asr #32         /// 4a 20 ${cc}9 e6
${op}ge r2, [r9], r10, asr #32        /// 4a 20 ${c8}9 a6
${op}bge r2, [r9], r10, asr #32       /// 4a 20 ${cc}9 a6
${op}geb r2, [r9], r10, asr #32       /// 4a 20 ${cc}9 a6

${op} r2, [r9], +r10, asr #32         /// 4a 20 ${c8}9 e6
${op}b r2, [r9], +r10, asr #32        /// 4a 20 ${cc}9 e6
${op}ge r2, [r9], +r10, asr #32       /// 4a 20 ${c8}9 a6
${op}bge r2, [r9], +r10, asr #32      /// 4a 20 ${cc}9 a6
${op}geb r2, [r9], +r10, asr #32      /// 4a 20 ${cc}9 a6

${op} r2, [r9], -r10, asr #32         /// 4a 20 ${c0}9 e6
${op}b r2, [r9], -r10, asr #32        /// 4a 20 ${c4}9 e6
${op}ge r2, [r9], -r10, asr #32       /// 4a 20 ${c0}9 a6
${op}bge r2, [r9], -r10, asr #32      /// 4a 20 ${c4}9 a6
${op}geb r2, [r9], -r10, asr #32      /// 4a 20 ${c4}9 a6

${op}t r2, [r9], r10, asr #32         /// 4a 20 ${ca}9 e6
${op}bt r2, [r9], r10, asr #32        /// 4a 20 ${ce}9 e6
${op}tge r2, [r9], r10, asr #32       /// 4a 20 ${ca}9 a6
${op}get r2, [r9], r10, asr #32       /// 4a 20 ${ca}9 a6
${op}btge r2, [r9], r10, asr #32      /// 4a 20 ${ce}9 a6
${op}gebt r2, [r9], r10, asr #32      /// 4a 20 ${ce}9 a6

${op}t r2, [r9], +r10, asr #32        /// 4a 20 ${ca}9 e6
${op}bt r2, [r9], +r10, asr #32       /// 4a 20 ${ce}9 e6
${op}tge r2, [r9], +r10, asr #32      /// 4a 20 ${ca}9 a6
${op}get r2, [r9], +r10, asr #32      /// 4a 20 ${ca}9 a6
${op}btge r2, [r9], +r10, asr #32     /// 4a 20 ${ce}9 a6
${op}gebt r2, [r9], +r10, asr #32     /// 4a 20 ${ce}9 a6

${op}t r2, [r9], -r10, asr #32        /// 4a 20 ${c2}9 e6
${op}bt r2, [r9], -r10, asr #32       /// 4a 20 ${c6}9 e6
${op}tge r2, [r9], -r10, asr #32      /// 4a 20 ${c2}9 a6
${op}get r2, [r9], -r10, asr #32      /// 4a 20 ${c2}9 a6
${op}btge r2, [r9], -r10, asr #32     /// 4a 20 ${c6}9 a6
${op}gebt r2, [r9], -r10, asr #32     /// 4a 20 ${c6}9 a6

//
// RRX
//

${op} r2, [r9], r10, rrx              /// 6a 20 ${c8}9 e6
${op}b r2, [r9], r10, rrx             /// 6a 20 ${cc}9 e6
${op}ge r2, [r9], r10, rrx            /// 6a 20 ${c8}9 a6
${op}bge r2, [r9], r10, rrx           /// 6a 20 ${cc}9 a6
${op}geb r2, [r9], r10, rrx           /// 6a 20 ${cc}9 a6

${op} r2, [r9], +r10, rrx             /// 6a 20 ${c8}9 e6
${op}b r2, [r9], +r10, rrx            /// 6a 20 ${cc}9 e6
${op}ge r2, [r9], +r10, rrx           /// 6a 20 ${c8}9 a6
${op}bge r2, [r9], +r10, rrx          /// 6a 20 ${cc}9 a6
${op}geb r2, [r9], +r10, rrx          /// 6a 20 ${cc}9 a6

${op} r2, [r9], -r10, rrx             /// 6a 20 ${c0}9 e6
${op}b r2, [r9], -r10, rrx            /// 6a 20 ${c4}9 e6
${op}ge r2, [r9], -r10, rrx           /// 6a 20 ${c0}9 a6
${op}bge r2, [r9], -r10, rrx          /// 6a 20 ${c4}9 a6
${op}geb r2, [r9], -r10, rrx          /// 6a 20 ${c4}9 a6

${op}t r2, [r9], r10, rrx             /// 6a 20 ${ca}9 e6
${op}bt r2, [r9], r10, rrx            /// 6a 20 ${ce}9 e6
${op}tge r2, [r9], r10, rrx           /// 6a 20 ${ca}9 a6
${op}get r2, [r9], r10, rrx           /// 6a 20 ${ca}9 a6
${op}btge r2, [r9], r10, rrx          /// 6a 20 ${ce}9 a6
${op}gebt r2, [r9], r10, rrx          /// 6a 20 ${ce}9 a6

${op}t r2, [r9], +r10, rrx            /// 6a 20 ${ca}9 e6
${op}bt r2, [r9], +r10, rrx           /// 6a 20 ${ce}9 e6
${op}tge r2, [r9], +r10, rrx          /// 6a 20 ${ca}9 a6
${op}get r2, [r9], +r10, rrx          /// 6a 20 ${ca}9 a6
${op}btge r2, [r9], +r10, rrx         /// 6a 20 ${ce}9 a6
${op}gebt r2, [r9], +r10, rrx         /// 6a 20 ${ce}9 a6

${op}t r2, [r9], -r10, rrx            /// 6a 20 ${c2}9 e6
${op}bt r2, [r9], -r10, rrx           /// 6a 20 ${c6}9 e6
${op}tge r2, [r9], -r10, rrx          /// 6a 20 ${c2}9 a6
${op}get r2, [r9], -r10, rrx          /// 6a 20 ${c2}9 a6
${op}btge r2, [r9], -r10, rrx         /// 6a 20 ${c6}9 a6
${op}gebt r2, [r9], -r10, rrx         /// 6a 20 ${c6}9 a6

//
// GENERIC SHIFT
//

${op} r2, [r9], -r10, lsl #13         /// 8a 26 ${c0}9 e6
${op}b r2, [r9], +r10, lsr #13        /// aa 26 ${cc}9 e6
${op}ge r2, [r9], +r10, asr #13       /// ca 26 ${c8}9 a6
${op}bge r2, [r9], r10, ror #13       /// ea 26 ${cc}9 a6
${op}geb r2, [r9], -r10, lsl #13      /// 8a 26 ${c4}9 a6

${op}t r2, [r9], -r10, lsl #13        /// 8a 26 ${c2}9 e6
${op}bt r2, [r9], +r10, lsr #13       /// aa 26 ${ce}9 e6
${op}tge r2, [r9], +r10, asr #13      /// ca 26 ${ca}9 a6
${op}get r2, [r9], +r10, asr #13      /// ca 26 ${ca}9 a6
${op}btge r2, [r9], r10, ror #13      /// ea 26 ${ce}9 a6
${op}gebt r2, [r9], -r10, lsl #13     /// 8a 26 ${c6}9 a6
`,
      },
    });
  }

  def({
    name: 'arm.str-pc-relative',
    desc: 'Store word relative to PC',
    kind: 'make',
    files: {
      '/root/main': `.arm
L0: .i16 100, 200  /// 64 00 c8 00
str r2, [#L0]      /// 0c 20 0f e5
strb r2, [#L0]     /// 10 20 4f e5
strbge r2, [#L0]   /// 14 20 4f a5
strgeb r2, [#L0]   /// 18 20 4f a5

str r2, [#L1]!     /// 08 20 af e5
strb r2, [#L1]!    /// 04 20 ef e5
strbge r2, [#L1]!  /// 00 20 ef a5
strgeb r2, [#L1]!  /// 04 20 6f a5
L1: .i16 100, 200  /// 64 00 c8 00
`,
    },
  });

  def({
    name: 'arm.ldr-pc-relative',
    desc: 'Load word relative to PC',
    kind: 'make',
    files: {
      '/root/main': `.arm
L0: .i16 100, 200  /// 64 00 c8 00
ldr r2, [#L0]      /// 0c 20 1f e5
ldrb r2, [#L0]     /// 10 20 5f e5
ldrbge r2, [#L0]   /// 14 20 5f a5
ldrgeb r2, [#L0]   /// 18 20 5f a5

ldr r2, [#L1]!     /// 08 20 bf e5
ldrb r2, [#L1]!    /// 04 20 ff e5
ldrbge r2, [#L1]!  /// 00 20 ff a5
ldrgeb r2, [#L1]!  /// 04 20 7f a5
L1: .i16 100, 200  /// 64 00 c8 00
`,
    },
  });

  def({
    name: 'arm.str-overflow-immediate',
    desc: 'Store with overflow immediate',
    kind: 'make',
    error: true,
    files: {
      '/root/main': `.arm
str r2, [r9], r10, lsl #32
`,
    },
  });

  def({
    name: 'arm.str-overflow-offset',
    desc: 'Store with overflow offset',
    kind: 'make',
    error: true,
    files: {
      '/root/main': `.arm
str r2, [r9, #4096]
`,
    },
  });

  def({
    name: 'arm.strh',
    desc: 'Store half word',
    kind: 'make',
    files: {
      '/root/main': `.arm
strh r11, [r4]                /// b0 b0 c4 e1
strhlt r11, [r4]              /// b0 b0 c4 b1
strlth r11, [r4]              /// b0 b0 c4 b1

strh r11, [r4, #100]          /// b4 b6 c4 e1
strhlt r11, [r4, #100]        /// b4 b6 c4 b1
strlth r11, [r4, #100]        /// b4 b6 c4 b1
strh r11, [r4, #100]!         /// b4 b6 e4 e1
strhlt r11, [r4, #100]!       /// b4 b6 e4 b1
strlth r11, [r4, #100]!       /// b4 b6 e4 b1

strh r11, [r4, #-100]         /// b4 b6 44 e1
strhlt r11, [r4, #-100]       /// b4 b6 44 b1
strlth r11, [r4, #-100]       /// b4 b6 44 b1
strh r11, [r4, #-100]!        /// b4 b6 64 e1
strhlt r11, [r4, #-100]!      /// b4 b6 64 b1
strlth r11, [r4, #-100]!      /// b4 b6 64 b1

strh r11, [r4, r13]           /// bd b0 84 e1
strhlt r11, [r4, r13]         /// bd b0 84 b1
strlth r11, [r4, r13]         /// bd b0 84 b1
strh r11, [r4, r13]!          /// bd b0 a4 e1
strhlt r11, [r4, r13]!        /// bd b0 a4 b1
strlth r11, [r4, r13]!        /// bd b0 a4 b1

strh r11, [r4, +r13]          /// bd b0 84 e1
strhlt r11, [r4, +r13]        /// bd b0 84 b1
strlth r11, [r4, +r13]        /// bd b0 84 b1
strh r11, [r4, +r13]!         /// bd b0 a4 e1
strhlt r11, [r4, +r13]!       /// bd b0 a4 b1
strlth r11, [r4, +r13]!       /// bd b0 a4 b1

strh r11, [r4, -r13]          /// bd b0 04 e1
strhlt r11, [r4, -r13]        /// bd b0 04 b1
strlth r11, [r4, -r13]        /// bd b0 04 b1
strh r11, [r4, -r13]!         /// bd b0 24 e1
strhlt r11, [r4, -r13]!       /// bd b0 24 b1
strlth r11, [r4, -r13]!       /// bd b0 24 b1

strh r11, [r4], #100          /// b4 b6 c4 e0
strhlt r11, [r4], #100        /// b4 b6 c4 b0
strlth r11, [r4], #100        /// b4 b6 c4 b0

strh r11, [r4], #-100         /// b4 b6 44 e0
strhlt r11, [r4], #-100       /// b4 b6 44 b0
strlth r11, [r4], #-100       /// b4 b6 44 b0

strh r11, [r4], r13           /// bd b0 84 e0
strhlt r11, [r4], r13         /// bd b0 84 b0
strlth r11, [r4], r13         /// bd b0 84 b0

strh r11, [r4], +r13          /// bd b0 84 e0
strhlt r11, [r4], +r13        /// bd b0 84 b0
strlth r11, [r4], +r13        /// bd b0 84 b0

strh r11, [r4], -r13          /// bd b0 04 e0
strhlt r11, [r4], -r13        /// bd b0 04 b0
strlth r11, [r4], -r13        /// bd b0 04 b0
`,
    },
  });

  def({
    name: 'arm.strh-pc-relative',
    desc: 'Store half word relative to PC',
    kind: 'make',
    files: {
      '/root/main': `.arm
L0: .i16 100, 200  /// 64 00 c8 00
strh r11, [#L0]    /// bc b0 4f e1
strh r11, [#L0]!   /// b0 b1 6f e1

strh r11, [#L1]    /// b0 b0 cf e1
strh r11, [#L1]!   /// b4 b0 6f e1
L1: .i16 100, 200  /// 64 00 c8 00
`,
    },
  });

  def({
    name: 'arm.strh-overflow',
    desc: 'Store half word with overflow offset',
    kind: 'make',
    error: true,
    files: {
      '/root/main': `.arm
strh r2, [r9, #256]
`,
    },
  });

  def({
    name: 'arm.ldrh',
    desc: 'Load half word',
    kind: 'make',
    files: {
      '/root/main': `.arm
ldrh r11, [r4]                /// b0 b0 d4 e1
ldrhgt r11, [r4]              /// b0 b0 d4 c1
ldrgth r11, [r4]              /// b0 b0 d4 c1

ldrsb r11, [r4]               /// d0 b0 d4 e1
ldrsbgt r11, [r4]             /// d0 b0 d4 c1
ldrgtsb r11, [r4]             /// d0 b0 d4 c1

ldrsh r11, [r4]               /// f0 b0 d4 e1
ldrshgt r11, [r4]             /// f0 b0 d4 c1
ldrgtsh r11, [r4]             /// f0 b0 d4 c1

ldrh r11, [r4, #100]          /// b4 b6 d4 e1
ldrhgt r11, [r4, #100]        /// b4 b6 d4 c1
ldrgth r11, [r4, #100]        /// b4 b6 d4 c1

ldrsb r11, [r4, #100]         /// d4 b6 d4 e1
ldrsbgt r11, [r4, #100]       /// d4 b6 d4 c1
ldrgtsb r11, [r4, #100]       /// d4 b6 d4 c1

ldrsh r11, [r4, #100]         /// f4 b6 d4 e1
ldrshgt r11, [r4, #100]       /// f4 b6 d4 c1
ldrgtsh r11, [r4, #100]       /// f4 b6 d4 c1

ldrh r11, [r4, #100]!         /// b4 b6 f4 e1
ldrhgt r11, [r4, #100]!       /// b4 b6 f4 c1
ldrgth r11, [r4, #100]!       /// b4 b6 f4 c1

ldrsb r11, [r4, #100]!        /// d4 b6 f4 e1
ldrsbgt r11, [r4, #100]!      /// d4 b6 f4 c1
ldrgtsb r11, [r4, #100]!      /// d4 b6 f4 c1

ldrsh r11, [r4, #100]!        /// f4 b6 f4 e1
ldrshgt r11, [r4, #100]!      /// f4 b6 f4 c1
ldrgtsh r11, [r4, #100]!      /// f4 b6 f4 c1

ldrh r11, [r4, #-100]         /// b4 b6 54 e1
ldrhgt r11, [r4, #-100]       /// b4 b6 54 c1
ldrgth r11, [r4, #-100]       /// b4 b6 54 c1

ldrsb r11, [r4, #-100]        /// d4 b6 54 e1
ldrsbgt r11, [r4, #-100]      /// d4 b6 54 c1
ldrgtsb r11, [r4, #-100]      /// d4 b6 54 c1

ldrsh r11, [r4, #-100]        /// f4 b6 54 e1
ldrshgt r11, [r4, #-100]      /// f4 b6 54 c1
ldrgtsh r11, [r4, #-100]      /// f4 b6 54 c1

ldrh r11, [r4, #-100]!        /// b4 b6 74 e1
ldrhgt r11, [r4, #-100]!      /// b4 b6 74 c1
ldrgth r11, [r4, #-100]!      /// b4 b6 74 c1

ldrsb r11, [r4, #-100]!       /// d4 b6 74 e1
ldrsbgt r11, [r4, #-100]!     /// d4 b6 74 c1
ldrgtsb r11, [r4, #-100]!     /// d4 b6 74 c1

ldrsh r11, [r4, #-100]!       /// f4 b6 74 e1
ldrshgt r11, [r4, #-100]!     /// f4 b6 74 c1
ldrgtsh r11, [r4, #-100]!     /// f4 b6 74 c1

ldrh r11, [r4, r13]           /// bd b0 94 e1
ldrhgt r11, [r4, r13]         /// bd b0 94 c1
ldrgth r11, [r4, r13]         /// bd b0 94 c1

ldrsb r11, [r4, r13]          /// dd b0 94 e1
ldrsbgt r11, [r4, r13]        /// dd b0 94 c1
ldrgtsb r11, [r4, r13]        /// dd b0 94 c1

ldrsh r11, [r4, r13]          /// fd b0 94 e1
ldrshgt r11, [r4, r13]        /// fd b0 94 c1
ldrgtsh r11, [r4, r13]        /// fd b0 94 c1

ldrh r11, [r4, r13]!          /// bd b0 b4 e1
ldrhgt r11, [r4, r13]!        /// bd b0 b4 c1
ldrgth r11, [r4, r13]!        /// bd b0 b4 c1

ldrsb r11, [r4, r13]!         /// dd b0 b4 e1
ldrsbgt r11, [r4, r13]!       /// dd b0 b4 c1
ldrgtsb r11, [r4, r13]!       /// dd b0 b4 c1

ldrsh r11, [r4, r13]!         /// fd b0 b4 e1
ldrshgt r11, [r4, r13]!       /// fd b0 b4 c1
ldrgtsh r11, [r4, r13]!       /// fd b0 b4 c1

ldrh r11, [r4, +r13]          /// bd b0 94 e1
ldrhgt r11, [r4, +r13]        /// bd b0 94 c1
ldrgth r11, [r4, +r13]        /// bd b0 94 c1

ldrsb r11, [r4, +r13]         /// dd b0 94 e1
ldrsbgt r11, [r4, +r13]       /// dd b0 94 c1
ldrgtsb r11, [r4, +r13]       /// dd b0 94 c1

ldrsh r11, [r4, +r13]         /// fd b0 94 e1
ldrshgt r11, [r4, +r13]       /// fd b0 94 c1
ldrgtsh r11, [r4, +r13]       /// fd b0 94 c1

ldrh r11, [r4, +r13]!         /// bd b0 b4 e1
ldrhgt r11, [r4, +r13]!       /// bd b0 b4 c1
ldrgth r11, [r4, +r13]!       /// bd b0 b4 c1

ldrsb r11, [r4, +r13]!        /// dd b0 b4 e1
ldrsbgt r11, [r4, +r13]!      /// dd b0 b4 c1
ldrgtsb r11, [r4, +r13]!      /// dd b0 b4 c1

ldrsh r11, [r4, +r13]!        /// fd b0 b4 e1
ldrshgt r11, [r4, +r13]!      /// fd b0 b4 c1
ldrgtsh r11, [r4, +r13]!      /// fd b0 b4 c1

ldrh r11, [r4, -r13]          /// bd b0 14 e1
ldrhgt r11, [r4, -r13]        /// bd b0 14 c1
ldrgth r11, [r4, -r13]        /// bd b0 14 c1

ldrsb r11, [r4, -r13]         /// dd b0 14 e1
ldrsbgt r11, [r4, -r13]       /// dd b0 14 c1
ldrgtsb r11, [r4, -r13]       /// dd b0 14 c1

ldrsh r11, [r4, -r13]         /// fd b0 14 e1
ldrshgt r11, [r4, -r13]       /// fd b0 14 c1
ldrgtsh r11, [r4, -r13]       /// fd b0 14 c1

ldrh r11, [r4, -r13]!         /// bd b0 34 e1
ldrhgt r11, [r4, -r13]!       /// bd b0 34 c1
ldrgth r11, [r4, -r13]!       /// bd b0 34 c1

ldrsb r11, [r4, -r13]!        /// dd b0 34 e1
ldrsbgt r11, [r4, -r13]!      /// dd b0 34 c1
ldrgtsb r11, [r4, -r13]!      /// dd b0 34 c1

ldrsh r11, [r4, -r13]!        /// fd b0 34 e1
ldrshgt r11, [r4, -r13]!      /// fd b0 34 c1
ldrgtsh r11, [r4, -r13]!      /// fd b0 34 c1

ldrh r11, [r4], #100          /// b4 b6 d4 e0
ldrhgt r11, [r4], #100        /// b4 b6 d4 c0
ldrgth r11, [r4], #100        /// b4 b6 d4 c0

ldrsb r11, [r4], #100         /// d4 b6 d4 e0
ldrsbgt r11, [r4], #100       /// d4 b6 d4 c0
ldrgtsb r11, [r4], #100       /// d4 b6 d4 c0

ldrsh r11, [r4], #100         /// f4 b6 d4 e0
ldrshgt r11, [r4], #100       /// f4 b6 d4 c0
ldrgtsh r11, [r4], #100       /// f4 b6 d4 c0

ldrh r11, [r4], #-100         /// b4 b6 54 e0
ldrhgt r11, [r4], #-100       /// b4 b6 54 c0
ldrgth r11, [r4], #-100       /// b4 b6 54 c0

ldrsb r11, [r4], #-100        /// d4 b6 54 e0
ldrsbgt r11, [r4], #-100      /// d4 b6 54 c0
ldrgtsb r11, [r4], #-100      /// d4 b6 54 c0

ldrsh r11, [r4], #-100        /// f4 b6 54 e0
ldrshgt r11, [r4], #-100      /// f4 b6 54 c0
ldrgtsh r11, [r4], #-100      /// f4 b6 54 c0

ldrh r11, [r4], r13           /// bd b0 94 e0
ldrhgt r11, [r4], r13         /// bd b0 94 c0
ldrgth r11, [r4], r13         /// bd b0 94 c0

ldrsb r11, [r4], r13          /// dd b0 94 e0
ldrsbgt r11, [r4], r13        /// dd b0 94 c0
ldrgtsb r11, [r4], r13        /// dd b0 94 c0

ldrsh r11, [r4], r13          /// fd b0 94 e0
ldrshgt r11, [r4], r13        /// fd b0 94 c0
ldrgtsh r11, [r4], r13        /// fd b0 94 c0

ldrh r11, [r4], +r13          /// bd b0 94 e0
ldrhgt r11, [r4], +r13        /// bd b0 94 c0
ldrgth r11, [r4], +r13        /// bd b0 94 c0

ldrsb r11, [r4], +r13         /// dd b0 94 e0
ldrsbgt r11, [r4], +r13       /// dd b0 94 c0
ldrgtsb r11, [r4], +r13       /// dd b0 94 c0

ldrsh r11, [r4], +r13         /// fd b0 94 e0
ldrshgt r11, [r4], +r13       /// fd b0 94 c0
ldrgtsh r11, [r4], +r13       /// fd b0 94 c0

ldrh r11, [r4], -r13          /// bd b0 14 e0
ldrhgt r11, [r4], -r13        /// bd b0 14 c0
ldrgth r11, [r4], -r13        /// bd b0 14 c0

ldrsb r11, [r4], -r13         /// dd b0 14 e0
ldrsbgt r11, [r4], -r13       /// dd b0 14 c0
ldrgtsb r11, [r4], -r13       /// dd b0 14 c0

ldrsh r11, [r4], -r13         /// fd b0 14 e0
ldrshgt r11, [r4], -r13       /// fd b0 14 c0
ldrgtsh r11, [r4], -r13       /// fd b0 14 c0
`,
    },
  });

  def({
    name: 'arm.ldrh-pc-relative',
    desc: 'Load half word relative to PC',
    kind: 'make',
    files: {
      '/root/main': `.arm
L0: .i16 100, 200  /// 64 00 c8 00
ldrh r11, [#L0]    /// bc b0 5f e1
ldrsh r11, [#L0]   /// f0 b1 5f e1
ldrsb r11, [#L0]   /// d4 b1 5f e1
ldrh r11, [#L0]!   /// b8 b1 7f e1
ldrsh r11, [#L0]!  /// fc b1 7f e1
ldrsb r11, [#L0]!  /// d0 b2 7f e1

ldrh r11, [#L1]    /// b0 b1 df e1
ldrsh r11, [#L1]   /// fc b0 df e1
ldrsb r11, [#L1]   /// d8 b0 df e1
ldrh r11, [#L1]!   /// b4 b0 ff e1
ldrsh r11, [#L1]!  /// f0 b0 ff e1
ldrsb r11, [#L1]!  /// d4 b0 7f e1
L1: .i16 100, 200  /// 64 00 c8 00
`,
    },
  });

  def({
    name: 'arm.push',
    desc: 'Push registers to stack',
    kind: 'make',
    files: {
      '/root/main': `.arm
push {r0-r4, r8, lr}           /// 1f 41 2d e9
pushle {r3, r5-r9, r13-r15}    /// e8 e3 2d d9

push {r0-r4, r8, lr}^          /// 1f 41 6d e9
pushle {r3, r5-r9, r13-r15}^   /// e8 e3 6d d9
`,
    },
  });

  def({
    name: 'arm.stm',
    desc: 'Store multiple registers',
    kind: 'make',
    files: {
      '/root/main': `.arm
stmed r5, {r1-lr}             /// fe 7f 05 e8
stmdale r5, {r1-lr}           /// fe 7f 05 d8
stmleda r5, {r1-lr}           /// fe 7f 05 d8
stmed r5!, {r1-lr}            /// fe 7f 25 e8
stmdale r5!, {r1-lr}          /// fe 7f 25 d8
stmleda r5!, {r1-lr}          /// fe 7f 25 d8
stmed r5, {r1-lr}^            /// fe 7f 45 e8
stmdale r5, {r1-lr}^          /// fe 7f 45 d8
stmleda r5, {r1-lr}^          /// fe 7f 45 d8
stmda r5!, {r1-lr}^           /// fe 7f 65 e8
stmedle r5!, {r1-lr}^         /// fe 7f 65 d8
stmleed r5!, {r1-lr}^         /// fe 7f 65 d8

stmea r5, {r1-lr}             /// fe 7f 85 e8
stmiale r5, {r1-lr}           /// fe 7f 85 d8
stmleia r5, {r1-lr}           /// fe 7f 85 d8
stmea r5!, {r1-lr}            /// fe 7f a5 e8
stmiale r5!, {r1-lr}          /// fe 7f a5 d8
stmleia r5!, {r1-lr}          /// fe 7f a5 d8
stmea r5, {r1-lr}^            /// fe 7f c5 e8
stmiale r5, {r1-lr}^          /// fe 7f c5 d8
stmleia r5, {r1-lr}^          /// fe 7f c5 d8
stmia r5!, {r1-lr}^           /// fe 7f e5 e8
stmeale r5!, {r1-lr}^         /// fe 7f e5 d8
stmleea r5!, {r1-lr}^         /// fe 7f e5 d8

stmfd r5, {r1-lr}             /// fe 7f 05 e9
stmdble r5, {r1-lr}           /// fe 7f 05 d9
stmledb r5, {r1-lr}           /// fe 7f 05 d9
stmfd r5!, {r1-lr}            /// fe 7f 25 e9
stmdble r5!, {r1-lr}          /// fe 7f 25 d9
stmledb r5!, {r1-lr}          /// fe 7f 25 d9
stmfd r5, {r1-lr}^            /// fe 7f 45 e9
stmdble r5, {r1-lr}^          /// fe 7f 45 d9
stmledb r5, {r1-lr}^          /// fe 7f 45 d9
stmdb r5!, {r1-lr}^           /// fe 7f 65 e9
stmfdle r5!, {r1-lr}^         /// fe 7f 65 d9
stmlefd r5!, {r1-lr}^         /// fe 7f 65 d9

stmfa r5, {r1-lr}             /// fe 7f 85 e9
stmible r5, {r1-lr}           /// fe 7f 85 d9
stmleib r5, {r1-lr}           /// fe 7f 85 d9
stmfa r5!, {r1-lr}            /// fe 7f a5 e9
stmible r5!, {r1-lr}          /// fe 7f a5 d9
stmleib r5!, {r1-lr}          /// fe 7f a5 d9
stmfa r5, {r1-lr}^            /// fe 7f c5 e9
stmible r5, {r1-lr}^          /// fe 7f c5 d9
stmleib r5, {r1-lr}^          /// fe 7f c5 d9
stmib r5!, {r1-lr}^           /// fe 7f e5 e9
stmfale r5!, {r1-lr}^         /// fe 7f e5 d9
stmlefa r5!, {r1-lr}^         /// fe 7f e5 d9
`,
    },
  });

  def({
    name: 'arm.pop',
    desc: 'Pop registers from stack',
    kind: 'make',
    files: {
      '/root/main': `.arm
pop {r0-r4, r8, lr}           /// 1f 41 bd e8
pople {r3, r5-r9, r13-r15}    /// e8 e3 bd d8

pop {r0-r4, r8, lr}^          /// 1f 41 fd e8
pople {r3, r5-r9, r13-r15}^   /// e8 e3 fd d8
`,
    },
  });

  def({
    name: 'arm.ldm',
    desc: 'Store multiple registers',
    kind: 'make',
    files: {
      '/root/main': `.arm
ldmfa r5, {r1-lr}             /// fe 7f 15 e8
ldmdale r5, {r1-lr}           /// fe 7f 15 d8
ldmleda r5, {r1-lr}           /// fe 7f 15 d8
ldmfa r5!, {r1-lr}            /// fe 7f 35 e8
ldmdale r5!, {r1-lr}          /// fe 7f 35 d8
ldmleda r5!, {r1-lr}          /// fe 7f 35 d8
ldmfa r5, {r1-lr}^            /// fe 7f 55 e8
ldmdale r5, {r1-lr}^          /// fe 7f 55 d8
ldmleda r5, {r1-lr}^          /// fe 7f 55 d8
ldmda r5!, {r1-lr}^           /// fe 7f 75 e8
ldmfale r5!, {r1-lr}^         /// fe 7f 75 d8
ldmlefa r5!, {r1-lr}^         /// fe 7f 75 d8

ldmfd r5, {r1-lr}             /// fe 7f 95 e8
ldmiale r5, {r1-lr}           /// fe 7f 95 d8
ldmleia r5, {r1-lr}           /// fe 7f 95 d8
ldmfd r5!, {r1-lr}            /// fe 7f b5 e8
ldmiale r5!, {r1-lr}          /// fe 7f b5 d8
ldmleia r5!, {r1-lr}          /// fe 7f b5 d8
ldmfd r5, {r1-lr}^            /// fe 7f d5 e8
ldmiale r5, {r1-lr}^          /// fe 7f d5 d8
ldmleia r5, {r1-lr}^          /// fe 7f d5 d8
ldmia r5!, {r1-lr}^           /// fe 7f f5 e8
ldmfdle r5!, {r1-lr}^         /// fe 7f f5 d8
ldmlefd r5!, {r1-lr}^         /// fe 7f f5 d8

ldmea r5, {r1-lr}             /// fe 7f 15 e9
ldmdble r5, {r1-lr}           /// fe 7f 15 d9
ldmledb r5, {r1-lr}           /// fe 7f 15 d9
ldmea r5!, {r1-lr}            /// fe 7f 35 e9
ldmdble r5!, {r1-lr}          /// fe 7f 35 d9
ldmledb r5!, {r1-lr}          /// fe 7f 35 d9
ldmea r5, {r1-lr}^            /// fe 7f 55 e9
ldmdble r5, {r1-lr}^          /// fe 7f 55 d9
ldmledb r5, {r1-lr}^          /// fe 7f 55 d9
ldmdb r5!, {r1-lr}^           /// fe 7f 75 e9
ldmeale r5!, {r1-lr}^         /// fe 7f 75 d9
ldmleea r5!, {r1-lr}^         /// fe 7f 75 d9

ldmed r5, {r1-lr}             /// fe 7f 95 e9
ldmible r5, {r1-lr}           /// fe 7f 95 d9
ldmleib r5, {r1-lr}           /// fe 7f 95 d9
ldmed r5!, {r1-lr}            /// fe 7f b5 e9
ldmible r5!, {r1-lr}          /// fe 7f b5 d9
ldmleib r5!, {r1-lr}          /// fe 7f b5 d9
ldmed r5, {r1-lr}^            /// fe 7f d5 e9
ldmible r5, {r1-lr}^          /// fe 7f d5 d9
ldmleib r5, {r1-lr}^          /// fe 7f d5 d9
ldmib r5!, {r1-lr}^           /// fe 7f f5 e9
ldmedle r5!, {r1-lr}^         /// fe 7f f5 d9
ldmleed r5!, {r1-lr}^         /// fe 7f f5 d9
`,
    },
  });

  def({
    name: 'arm.swp',
    desc: 'Swap',
    kind: 'make',
    files: {
      '/root/main': `.arm
swp r8, r9, [r1]      /// 99 80 01 e1
swpb r8, r9, [r1]     /// 99 80 41 e1
swppl r8, r9, [r1]    /// 99 80 01 51
swp.pl r8, r9, [r1]   /// 99 80 01 51
swpbpl r8, r9, [r1]   /// 99 80 41 51
swpb.pl r8, r9, [r1]  /// 99 80 41 51
swpplb r8, r9, [r1]   /// 99 80 41 51
`,
    },
  });

  def({
    name: 'arm.swi',
    desc: 'Software interrupt',
    kind: 'make',
    files: {
      '/root/main': `.arm
swi 0            /// 00 00 00 ef
swi 100          /// 64 00 00 ef
swi 0xffffff     /// ff ff ff ef
swimi 0          /// 00 00 00 4f
swimi 100        /// 64 00 00 4f
swimi 0xffffff   /// ff ff ff 4f
swi.mi 0xffffff  /// ff ff ff 4f
`,
    },
  });

  def({
    name: 'arm.swi-overflow',
    desc: 'Software interrupt with overflowed comment',
    kind: 'make',
    error: true,
    files: {
      '/root/main': `.arm
swi 16777216
`,
    },
  });

  def({
    name: 'arm.swi-underflow',
    desc: 'Software interrupt with underflowed comment',
    kind: 'make',
    error: true,
    files: {
      '/root/main': `.arm
swi -1
`,
    },
  });
}
