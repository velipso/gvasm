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

  def({
    name: "arm.bl",
    desc: "Branch and Link",
    kind: "make",
    files: {
      "/root/main": `
@L1: bl 0x08000008  /// 00 00 00 eb
@L2: bl @L1         /// fd ff ff eb
@L3: blhs @L3       /// fe ff ff 2b
blcc @L4            /// 01 00 00 3b
.i32 0, 0           /// 00 00 00 00 00 00 00 00
@L4:
`,
    },
  });

  for (
    const { op, desc, code } of [
      { op: "mov", desc: "Move", code: 13 },
      { op: "mvn", desc: "Move negative", code: 15 },
    ]
  ) {
    const b = (code & 7) << 1;
    const b0 = b.toString(16);
    const b1 = (b | 1).toString(16);
    def({
      name: `arm.${op}`,
      desc,
      kind: "make",
      files: {
        "/root/main": `
${op} r3, r14              /// 0e 30 ${b0}0 e1
${op}s r3, r14             /// 0e 30 ${b1}0 e1
${op}mi r3, r14            /// 0e 30 ${b0}0 41
${op}smi r3, r14           /// 0e 30 ${b1}0 41
${op}mis r3, r14           /// 0e 30 ${b1}0 41

${op} r3, r14, lsl #0      /// 0e 30 ${b0}0 e1
${op}s r3, r14, lsl #0     /// 0e 30 ${b1}0 e1
${op}mi r3, r14, lsl #0    /// 0e 30 ${b0}0 41
${op}smi r3, r14, lsl #0   /// 0e 30 ${b1}0 41
${op}mis r3, r14, lsl #0   /// 0e 30 ${b1}0 41

${op} r3, r14, lsr #0      /// 0e 30 ${b0}0 e1
${op}s r3, r14, lsr #0     /// 0e 30 ${b1}0 e1
${op}mi r3, r14, lsr #0    /// 0e 30 ${b0}0 41
${op}smi r3, r14, lsr #0   /// 0e 30 ${b1}0 41
${op}mis r3, r14, lsr #0   /// 0e 30 ${b1}0 41

${op} r3, r14, asr #0      /// 0e 30 ${b0}0 e1
${op}s r3, r14, asr #0     /// 0e 30 ${b1}0 e1
${op}mi r3, r14, asr #0    /// 0e 30 ${b0}0 41
${op}smi r3, r14, asr #0   /// 0e 30 ${b1}0 41
${op}mis r3, r14, asr #0   /// 0e 30 ${b1}0 41

${op} r3, r14, ror #0      /// 0e 30 ${b0}0 e1
${op}s r3, r14, ror #0     /// 0e 30 ${b1}0 e1
${op}mi r3, r14, ror #0    /// 0e 30 ${b0}0 41
${op}smi r3, r14, ror #0   /// 0e 30 ${b1}0 41
${op}mis r3, r14, ror #0   /// 0e 30 ${b1}0 41

${op} r3, r14, lsr #32     /// 2e 30 ${b0}0 e1
${op}s r3, r14, lsr #32    /// 2e 30 ${b1}0 e1
${op}mi r3, r14, lsr #32   /// 2e 30 ${b0}0 41
${op}smi r3, r14, lsr #32  /// 2e 30 ${b1}0 41
${op}mis r3, r14, lsr #32  /// 2e 30 ${b1}0 41

${op} r3, r14, asr #32     /// 4e 30 ${b0}0 e1
${op}s r3, r14, asr #32    /// 4e 30 ${b1}0 e1
${op}mi r3, r14, asr #32   /// 4e 30 ${b0}0 41
${op}smi r3, r14, asr #32  /// 4e 30 ${b1}0 41
${op}mis r3, r14, asr #32  /// 4e 30 ${b1}0 41

${op} r3, r14, rrx         /// 6e 30 ${b0}0 e1
${op}s r3, r14, rrx        /// 6e 30 ${b1}0 e1
${op}mi r3, r14, rrx       /// 6e 30 ${b0}0 41
${op}smi r3, r14, rrx      /// 6e 30 ${b1}0 41
${op}mis r3, r14, rrx      /// 6e 30 ${b1}0 41

${op} r3, r14, lsl #5      /// 8e 32 ${b0}0 e1
${op}s r3, r14, lsr #10    /// 2e 35 ${b1}0 e1
${op}mi r3, r14, asr #15   /// ce 37 ${b0}0 41
${op}smi r3, r14, ror #20  /// 6e 3a ${b1}0 41
${op}mis r3, r14, lsl #25  /// 8e 3c ${b1}0 41

${op} r3, r14, lsl r10     /// 1e 3a ${b0}0 e1
${op}s r3, r14, lsr r10    /// 3e 3a ${b1}0 e1
${op}mi r3, r14, asr r10   /// 5e 3a ${b0}0 41
${op}smi r3, r14, ror r10  /// 7e 3a ${b1}0 41
${op}mis r3, r14, lsl r10  /// 1e 3a ${b1}0 41

${op} r3, #0x34000000      /// 0d 33 ${b0}0 e3
${op}s r3, #0x560000       /// 56 38 ${b1}0 e3
${op}mi r3, #0x7800        /// 1e 3b ${b0}0 43
${op}smi r3, #0x91         /// 91 30 ${b1}0 43
${op}mis r3, #0x50         /// 05 3e ${b1}0 43
`,
      },
    });
  }

  for (
    const { op, desc, code } of [
      { op: "tst", desc: "Bitwise and test", code: 8 },
      { op: "teq", desc: "Bitwise exclusive or test", code: 9 },
      { op: "cmp", desc: "Compare", code: 10 },
      { op: "cmn", desc: "Compare negative", code: 11 },
    ]
  ) {
    const b = (code & 7) << 1;
    const b1 = (b | 1).toString(16);
    def({
      name: `arm.${op}`,
      desc,
      kind: "make",
      files: {
        "/root/main": `
${op} r9, r14              /// 0e 00 ${b1}9 e1
${op}pl r9, r14            /// 0e 00 ${b1}9 51

${op} r9, r14, lsl #0      /// 0e 00 ${b1}9 e1
${op}pl r9, r14, lsl #0    /// 0e 00 ${b1}9 51

${op} r9, r14, lsr #0      /// 0e 00 ${b1}9 e1
${op}pl r9, r14, lsr #0    /// 0e 00 ${b1}9 51

${op} r9, r14, asr #0      /// 0e 00 ${b1}9 e1
${op}pl r9, r14, asr #0    /// 0e 00 ${b1}9 51

${op} r9, r14, ror #0      /// 0e 00 ${b1}9 e1
${op}pl r9, r14, ror #0    /// 0e 00 ${b1}9 51

${op} r9, r14, lsr #32     /// 2e 00 ${b1}9 e1
${op}pl r9, r14, lsr #32   /// 2e 00 ${b1}9 51

${op} r9, r14, asr #32     /// 4e 00 ${b1}9 e1
${op}pl r9, r14, asr #32   /// 4e 00 ${b1}9 51

${op} r9, r14, rrx         /// 6e 00 ${b1}9 e1
${op}pl r9, r14, rrx       /// 6e 00 ${b1}9 51

${op} r9, r14, lsl #5      /// 8e 02 ${b1}9 e1
${op}pl r9, r14, asr #15   /// ce 07 ${b1}9 51

${op} r9, r14, lsl r10     /// 1e 0a ${b1}9 e1
${op}pl r9, r14, asr r10   /// 5e 0a ${b1}9 51

${op} r9, #0x34000000      /// 0d 03 ${b1}9 e3
${op}pl r9, #0x7800        /// 1e 0b ${b1}9 53
`,
      },
    });
  }

  for (
    const { op, desc, code } of [
      { op: "and", desc: "Bitwise and", code: 0 },
      { op: "eor", desc: "Bitwise exclusive or", code: 1 },
      { op: "sub", desc: "Subtraction", code: 2 },
      { op: "rsb", desc: "Reverse subtraction", code: 3 },
      { op: "add", desc: "Addition", code: 4 },
      { op: "adc", desc: "Addition with carry", code: 5 },
      { op: "sbc", desc: "Subtraction with carry", code: 6 },
      { op: "rsc", desc: "Reverse subtraction with carry", code: 7 },
      { op: "orr", desc: "Bitwise or", code: 12 },
      { op: "bic", desc: "Bit clear", code: 14 },
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
      kind: "make",
      files: {
        "/root/main": `
${op} r3, r9, r14              /// 0e 30 ${b0}9 e${a0}
${op}s r3, r9, r14             /// 0e 30 ${b1}9 e${a0}
${op}lo r3, r9, r14            /// 0e 30 ${b0}9 3${a0}
${op}slo r3, r9, r14           /// 0e 30 ${b1}9 3${a0}
${op}los r3, r9, r14           /// 0e 30 ${b1}9 3${a0}

${op} r3, r9, r14, lsl #0      /// 0e 30 ${b0}9 e${a0}
${op}s r3, r9, r14, lsl #0     /// 0e 30 ${b1}9 e${a0}
${op}lo r3, r9, r14, lsl #0    /// 0e 30 ${b0}9 3${a0}
${op}slo r3, r9, r14, lsl #0   /// 0e 30 ${b1}9 3${a0}
${op}los r3, r9, r14, lsl #0   /// 0e 30 ${b1}9 3${a0}

${op} r3, r9, r14, lsr #0      /// 0e 30 ${b0}9 e${a0}
${op}s r3, r9, r14, lsr #0     /// 0e 30 ${b1}9 e${a0}
${op}lo r3, r9, r14, lsr #0    /// 0e 30 ${b0}9 3${a0}
${op}slo r3, r9, r14, lsr #0   /// 0e 30 ${b1}9 3${a0}
${op}los r3, r9, r14, lsr #0   /// 0e 30 ${b1}9 3${a0}

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

${op} r3, r9, r14, asr #32     /// 4e 30 ${b0}9 e${a0}
${op}s r3, r9, r14, asr #32    /// 4e 30 ${b1}9 e${a0}
${op}lo r3, r9, r14, asr #32   /// 4e 30 ${b0}9 3${a0}
${op}slo r3, r9, r14, asr #32  /// 4e 30 ${b1}9 3${a0}
${op}los r3, r9, r14, asr #32  /// 4e 30 ${b1}9 3${a0}

${op} r3, r9, r14, rrx         /// 6e 30 ${b0}9 e${a0}
${op}s r3, r9, r14, rrx        /// 6e 30 ${b1}9 e${a0}
${op}lo r3, r9, r14, rrx       /// 6e 30 ${b0}9 3${a0}
${op}slo r3, r9, r14, rrx      /// 6e 30 ${b1}9 3${a0}
${op}los r3, r9, r14, rrx      /// 6e 30 ${b1}9 3${a0}

${op} r3, r9, r14, lsl #5      /// 8e 32 ${b0}9 e${a0}
${op}s r3, r9, r14, lsr #10    /// 2e 35 ${b1}9 e${a0}
${op}lo r3, r9, r14, asr #15   /// ce 37 ${b0}9 3${a0}
${op}slo r3, r9, r14, ror #20  /// 6e 3a ${b1}9 3${a0}
${op}los r3, r9, r14, lsl #25  /// 8e 3c ${b1}9 3${a0}

${op} r3, r9, r14, lsl r10     /// 1e 3a ${b0}9 e${a0}
${op}s r3, r9, r14, lsr r10    /// 3e 3a ${b1}9 e${a0}
${op}lo r3, r9, r14, asr r10   /// 5e 3a ${b0}9 3${a0}
${op}slo r3, r9, r14, ror r10  /// 7e 3a ${b1}9 3${a0}
${op}los r3, r9, r14, lsl r10  /// 1e 3a ${b1}9 3${a0}

${op} r3, r9, #0x34000000      /// 0d 33 ${b0}9 e${a2}
${op}s r3, r9, #0x560000       /// 56 38 ${b1}9 e${a2}
${op}lo r3, r9, #0x7800        /// 1e 3b ${b0}9 3${a2}
${op}slo r3, r9, #0x91         /// 91 30 ${b1}9 3${a2}
${op}los r3, r9, #0x50         /// 05 3e ${b1}9 3${a2}
`,
      },
    });
  }

  // TODO: PSR Transfer
}
