//
// gvasm - Assembler and disassembler for Game Boy Advance homebrew
// by Sean Connelly (@velipso), https://sean.cm
// The Unlicense License
// Project Home: https://github.com/velipso/gvasm
//

import { ITest } from "../itest.ts";

export function load(def: (test: ITest) => void) {
  def({
    name: "thumb.lsl",
    desc: "Logical left shift",
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
    desc: "Logical left shift with overflow",
    kind: "make",
    error: true,
    files: {
      "/root/main": `.thumb\nlsl r3, r5, #32`,
    },
  });

  def({
    name: "thumb.lsr",
    desc: "Logical right shift",
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
    name: "thumb.asr",
    desc: "Arithmetic right shift",
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
}
