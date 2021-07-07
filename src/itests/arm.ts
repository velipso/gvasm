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

  def({
    name: "arm.mrs",
    desc: "Transfer PSR to register",
    kind: "make",
    files: {
      "/root/main": `
mov r12, cpsr     /// 00 c0 0f e1
mov r12, spsr     /// 00 c0 4f e1
movvs r12, cpsr   /// 00 c0 0f 61
movvs r12, spsr   /// 00 c0 4f 61
mrs r12, cpsr     /// 00 c0 0f e1
mrs r12, spsr     /// 00 c0 4f e1
mrsvs r12, cpsr   /// 00 c0 0f 61
mrsvs r12, spsr   /// 00 c0 4f 61
`
    }
  });

  def({
    name: "arm.msr",
    desc: "Transfer register to PSR",
    kind: "make",
    files: {
      "/root/main": `
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

mov cpsr_flg, #0xf0000000    /// 0f f2 28 e3
mov spsr_flg, #0xf0000000    /// 0f f2 68 e3
movvc cpsr_flg, #0x50000000  /// 05 f2 28 73
movvc spsr_flg, #0xf0000000  /// 0f f2 68 73
msr cpsr_flg, #0xf0000000    /// 0f f2 28 e3
msr spsr_flg, #0xf0000000    /// 0f f2 68 e3
msrvc cpsr_flg, #0x50000000  /// 05 f2 28 73
msrvc spsr_flg, #0xf0000000  /// 0f f2 68 73
`
    }
  });

  def({
    name: "arm.mul",
    desc: "Multiply",
    kind: "make",
    files: {
      "/root/main": `
mul r1, r9, r4     /// 99 04 01 e0
muls r1, r9, r4    /// 99 04 11 e0
mulhi r1, r9, r4   /// 99 04 01 80
mulshi r1, r9, r4  /// 99 04 11 80
mulhis r1, r9, r4  /// 99 04 11 80
`
    }
  });

  def({
    name: "arm.mla",
    desc: "Multiply and accumulate",
    kind: "make",
    files: {
      "/root/main": `
mla r1, r9, r4, r12     /// 99 c4 21 e0
mlas r1, r9, r4, r12    /// 99 c4 31 e0
mlahi r1, r9, r4, r12   /// 99 c4 21 80
mlashi r1, r9, r4, r12  /// 99 c4 31 80
mlahis r1, r9, r4, r12  /// 99 c4 31 80
`
    }
  });

  def({
    name: "arm.mull",
    desc: "Multiply long",
    kind: "make",
    files: {
      "/root/main": `
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
`
    }
  });

  def({
    name: "arm.mlal",
    desc: "Multiply and accumulate long",
    kind: "make",
    files: {
      "/root/main": `
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
`
    }
  });

  for (
    const { op, desc, code } of [
      { op: "str", desc: "Store", code: 0 },
      { op: "ldr", desc: "Load", code: 1 },
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
      kind: "make",
      files: {
        "/root/main": `
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
`
      }
    });
  }
}
