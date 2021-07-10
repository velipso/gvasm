//
// gvasm - Assembler and disassembler for Game Boy Advance homebrew
// by Sean Connelly (@velipso), https://sean.cm
// The Unlicense License
// Project Home: https://github.com/velipso/gvasm
//

import { ITest } from "../itest.ts";

export function load(def: (test: ITest) => void) {
  def({
    name: "thumb.lsl-move",
    desc: "Logical shift left and move",
    kind: "make",
    files: {
      "/root/main": `.thumb
// move and shift
lsl r3, r5, #10  /// ab 02
lsl r7, r7, #31  /// ff 07
// just shift
lsl r3, r5       /// ab 40
lsl r7, r7       /// bf 40
`,
    },
  });

  def({
    name: "thumb.lsl-overflow",
    desc: "Logical shift left with overflow",
    kind: "make",
    error: true,
    files: {
      "/root/main": `.thumb\nlsl r3, r5, #32`,
    },
  });

  def({
    name: "thumb.lsr-move",
    desc: "Logical shift right and move",
    kind: "make",
    files: {
      "/root/main": `.thumb
// move and shift
lsr r3, r5, #10  /// ab 0a
lsr r7, r7, #31  /// ff 0f
// just shift
lsr r3, r5       /// eb 40
lsr r7, r7       /// ff 40
`,
    },
  });

  def({
    name: "thumb.asr-move",
    desc: "Arithmetic shift right and move",
    kind: "make",
    files: {
      "/root/main": `.thumb
// move and shift
asr r3, r5, #10  /// ab 12
asr r7, r7, #31  /// ff 17
// just shift
asr r3, r5       /// 2b 41
asr r7, r7       /// 3f 41
`,
    },
  });

  def({
    name: "thumb.add",
    desc: "Add",
    kind: "make",
    files: {
      "/root/main": `.thumb
// add registers
add r4, r1, r6     /// 8c 19
add r4, r1, #6     /// 8c 1d
// add immediate
add r4, #0         /// 00 34
add r4, #200       /// c8 34
add r4, #255       /// ff 34
// add pc/sp
add r4, pc, #800   /// c8 a4
add r4, sp, #844   /// d3 ac
// add sp
add sp, #400       /// 64 b0
add sp, #404       /// 65 b0
`,
    },
  });

  def({
    name: "thumb.sub",
    desc: "Subtract",
    kind: "make",
    files: {
      "/root/main": `.thumb
// subtract registers
sub r4, r1, r6     /// 8c 1b
sub r4, r1, #6     /// 8c 1f
// subtract immediate
sub r4, #0         /// 00 3c
sub r4, #200       /// c8 3c
sub r4, #255       /// ff 3c
// subtract sp
sub sp, #400       /// e4 b0
sub sp, #404       /// e5 b0
`,
    },
  });

  def({
    name: "thumb.mov",
    desc: "Move",
    kind: "make",
    files: {
      "/root/main": `.thumb
mov r4, #0       /// 00 24
mov r4, #100     /// 64 24
mov r4, #255     /// ff 24
`,
    },
  });

  def({
    name: "thumb.cmp-immediate",
    desc: "Compare",
    kind: "make",
    files: {
      "/root/main": `.thumb
cmp r4, #0       /// 00 2c
cmp r4, #100     /// 64 2c
cmp r4, #255     /// ff 2c
`,
    },
  });

  for (
    const { op, desc, code } of [
      { op: "and", desc: "Bitwise and", code: 0 },
      { op: "eor", desc: "Bitwise exclusive or", code: 1 },
      { op: "lsl", desc: "Logical shift left", code: 2 },
      { op: "lsr", desc: "Logical shift right", code: 3 },
      { op: "asr", desc: "Arithmetic shift right", code: 4 },
      { op: "adc", desc: "Add with carry", code: 5 },
      { op: "sbc", desc: "Subtract with carry", code: 6 },
      { op: "ror", desc: "Rotate right", code: 7 },
      { op: "tst", desc: "Bit test", code: 8 },
      { op: "neg", desc: "Negate", code: 9 },
      { op: "cmp", desc: "Compare", code: 10 },
      { op: "cmn", desc: "Compare negative", code: 11 },
      { op: "orr", desc: "Bitwise or", code: 12 },
      { op: "mul", desc: "Multiply", code: 13 },
      { op: "bic", desc: "Bit clear", code: 14 },
      { op: "mvn", desc: "Move negative", code: 15 },
    ]
  ) {
    const a = code >> 2;
    const b = (((code & 3) << 2) | 3).toString(16);
    def({
      name: `thumb.${op}`,
      desc,
      kind: "make",
      files: {
        "/root/main": `.thumb
${op} r2, r7  /// ${b}a 4${a}
`,
      },
    });
  }

  def({
    name: "thumb.add-hi",
    desc: "Hi register add",
    kind: "make",
    files: {
      "/root/main": `.thumb
add r4, r13  /// 6c 44
add r13, r4  /// a5 44
add r9, r13  /// e9 44
`,
    },
  });

  def({
    name: "thumb.cmp-hi",
    desc: "Hi register compare",
    kind: "make",
    files: {
      "/root/main": `.thumb
cmp r4, r13  /// 6c 45
cmp r13, r4  /// a5 45
cmp r9, r13  /// e9 45
`,
    },
  });

  def({
    name: "thumb.mov-hi",
    desc: "Hi register move",
    kind: "make",
    files: {
      "/root/main": `.thumb
mov r4, r13  /// 6c 46
mov r13, r4  /// a5 46
mov r9, r13  /// e9 46
`,
    },
  });

  def({
    name: "thumb.bx-hi",
    desc: "Hi register branch and exchange",
    kind: "make",
    files: {
      "/root/main": `.thumb
bx r13  /// 68 47
bx r4   /// 20 47
`,
    },
  });
}
