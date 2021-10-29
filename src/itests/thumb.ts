//
// gvasm - Assembler and disassembler for Game Boy Advance homebrew
// by Sean Connelly (@velipso), https://sean.cm
// The Unlicense License
// Project Home: https://github.com/velipso/gvasm
//

import { ITest } from '../itest.ts';

export function load(def: (test: ITest) => void) {
  def({
    name: 'thumb.lsl',
    desc: 'Logical shift left',
    kind: 'make',
    files: {
      '/root/main': `.thumb
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
    name: 'thumb.lsl-overflow',
    desc: 'Logical shift left with overflow',
    kind: 'make',
    error: true,
    files: {
      '/root/main': `.thumb\nlsl r3, r5, #32`,
    },
  });

  def({
    name: 'thumb.lsr',
    desc: 'Logical shift right',
    kind: 'make',
    files: {
      '/root/main': `.thumb
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
    name: 'thumb.asr',
    desc: 'Arithmetic shift right',
    kind: 'make',
    files: {
      '/root/main': `.thumb
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
    name: 'thumb.add',
    desc: 'Add',
    kind: 'make',
    files: {
      '/root/main': `.thumb
// add registers
add r4, r1, r6     /// 8c 19
add r4, r1, #6     /// 8c 1d
add r4, r1, #0     /// 0c 1c
movs r4, r1        /// 0c 1c
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
sub sp, #-400      /// 64 b0
sub sp, #-404      /// 65 b0
// add hi register
add r4, r4, r2     /// a4 18
add r4, r2         /// a4 18
add r4, r13        /// 6c 44
add r13, r4        /// a5 44
add r9, r13        /// e9 44
`,
    },
  });

  def({
    name: 'thumb.sub',
    desc: 'Subtract',
    kind: 'make',
    files: {
      '/root/main': `.thumb
// subtract registers
sub r4, r4, r2     /// a4 1a
sub r4, r2         /// a4 1a
sub r4, r1, r6     /// 8c 1b
sub r4, r1, #6     /// 8c 1f
// subtract immediate
sub r4, #0         /// 00 3c
sub r4, #200       /// c8 3c
sub r4, #255       /// ff 3c
// subtract sp
sub sp, #400       /// e4 b0
sub sp, #404       /// e5 b0
add sp, #-400      /// e4 b0
add sp, #-404      /// e5 b0
`,
    },
  });

  def({
    name: 'thumb.nop',
    desc: 'Nop',
    kind: 'make',
    files: {
      '/root/main': `.thumb
mov r8, r8    /// c0 46
nop           /// c0 46
`,
    },
  });

  def({
    name: 'thumb.mov',
    desc: 'Move',
    kind: 'make',
    files: {
      '/root/main': `.thumb
// mov immediate
mov r4, #0    /// 00 24
mov r4, #100  /// 64 24
mov r4, #255  /// ff 24
// mov high register
mov r4, r13   /// 6c 46
mov r13, r4   /// a5 46
mov r9, r13   /// e9 46
`,
    },
  });

  def({
    name: 'thumb.cmp',
    desc: 'Compare',
    kind: 'make',
    files: {
      '/root/main': `.thumb
// cmp immediate
cmp r4, #0    /// 00 2c
cmp r4, #100  /// 64 2c
cmp r4, #255  /// ff 2c
// cmp register
cmp r2, r7    /// ba 42
cmp r0, r1    /// 88 42
// cmp high register
cmp r4, r13   /// 6c 45
cmp r13, r4   /// a5 45
cmp r9, r13   /// e9 45
`,
    },
  });

  for (
    const { op, desc, code } of [
      { op: 'ands', desc: 'Bitwise and', code: 0 },
      { op: 'and', desc: 'Bitwise and', code: 0 },
      { op: 'eors', desc: 'Bitwise exclusive or', code: 1 },
      { op: 'eor', desc: 'Bitwise exclusive or', code: 1 },
      { op: 'adcs', desc: 'Add with carry', code: 5 },
      { op: 'adc', desc: 'Add with carry', code: 5 },
      { op: 'sbcs', desc: 'Subtract with carry', code: 6 },
      { op: 'sbc', desc: 'Subtract with carry', code: 6 },
      { op: 'rors', desc: 'Rotate right', code: 7 },
      { op: 'ror', desc: 'Rotate right', code: 7 },
      { op: 'tst', desc: 'Bit test', code: 8 },
      { op: 'negs', desc: 'Negate', code: 9 },
      { op: 'neg', desc: 'Negate', code: 9 },
      { op: 'cmn', desc: 'Compare negative', code: 11 },
      { op: 'orrs', desc: 'Bitwise or', code: 12 },
      { op: 'orr', desc: 'Bitwise or', code: 12 },
      { op: 'muls', desc: 'Multiply', code: 13 },
      { op: 'mul', desc: 'Multiply', code: 13 },
      { op: 'bics', desc: 'Bit clear', code: 14 },
      { op: 'bic', desc: 'Bit clear', code: 14 },
      { op: 'mvns', desc: 'Move not', code: 15 },
      { op: 'mvn', desc: 'Move not', code: 15 },
      { op: 'nots', desc: 'Move not', code: 15 },
      { op: 'not', desc: 'Move not', code: 15 },
    ]
  ) {
    const a = code >> 2;
    const b = (((code & 3) << 2) | 3).toString(16);
    def({
      name: `thumb.${op}`,
      desc,
      kind: 'make',
      files: {
        '/root/main': `.thumb
${op} r2, r7  /// ${b}a 4${a}
${op} r0, r6  /// ${b}0 4${a}
`,
      },
    });
  }

  def({
    name: 'thumb.bx',
    desc: 'Branch and exchange',
    kind: 'make',
    files: {
      '/root/main': `.thumb
bx r4   /// 20 47
bx r13  /// 68 47
`,
    },
  });

  def({
    name: 'thumb.ldr',
    desc: 'Load',
    kind: 'make',
    files: {
      '/root/main': `.thumb
// relative to PC
ldr r4, [pc, #0]     /// 00 4c
ldr r4, [pc]         /// 00 4c
ldr r4, [pc, #844]   /// d3 4c
ldr r4, [#@L]        /// 01 4c
ldr r4, [#@L]        /// 00 4c
ldr r4, [#@L]        /// 00 4c
@L: .i32 0x12345678  /// 78 56 34 12
// word
ldr r7, [r5, r3]     /// ef 58
ldr r3, [r6, #116]   /// 73 6f
ldr r3, [r6, #0]     /// 33 68
ldr r3, [r6]         /// 33 68
ldr r2, [sp, #492]   /// 7b 9a
ldr r2, [sp, #0]     /// 00 9a
ldr r2, [sp]         /// 00 9a
// half word
ldrh r7, [r5, r3]    /// ef 5a
ldrsh r7, [r5, r3]   /// ef 5e
ldrh r3, [r6, #58]   /// 73 8f
ldrh r3, [r6, #0]    /// 33 88
ldrh r3, [r6]        /// 33 88
// byte
ldrb r7, [r5, r3]    /// ef 5c
ldsb r7, [r5, r3]    /// ef 56
ldrsb r7, [r5, r3]   /// ef 56
ldrb r3, [r6, #29]   /// 73 7f
ldrb r3, [r6, #0]    /// 33 78
ldrb r3, [r6]        /// 33 78
`,
    },
  });

  def({
    name: 'thumb.str',
    desc: 'Store',
    kind: 'make',
    files: {
      '/root/main': `.thumb
// word
str r7, [r5, r3]     /// ef 50
str r3, [r6, #116]   /// 73 67
str r3, [r6, #0]     /// 33 60
str r3, [r6]         /// 33 60
str r2, [sp, #492]   /// 7b 92
str r2, [sp, #0]     /// 00 92
str r2, [sp]         /// 00 92
// half word
strh r7, [r5, r3]    /// ef 52
strh r3, [r6, #58]   /// 73 87
strh r3, [r6, #0]    /// 33 80
strh r3, [r6]        /// 33 80
// byte
strb r7, [r5, r3]    /// ef 54
strb r3, [r6, #29]   /// 73 77
strb r3, [r6, #0]    /// 33 70
strb r3, [r6]        /// 33 70
`,
    },
  });

  def({
    name: 'thumb.strsh-missing',
    desc: 'Verify strsh is missing',
    kind: 'make',
    error: true,
    files: { '/root/main': `.thumb\nstrsh r7, [r5, r3]` },
  });

  def({
    name: 'thumb.stsh-missing',
    desc: 'Verify strh is missing',
    kind: 'make',
    error: true,
    files: { '/root/main': `.thumb\nstsh r7, [r5, r3]` },
  });

  def({
    name: 'thumb.strsb-missing',
    desc: 'Verify strsb is missing',
    kind: 'make',
    error: true,
    files: { '/root/main': `.thumb\nstrsb r7, [r5, r3]` },
  });

  def({
    name: 'thumb.stsb-missing',
    desc: 'Verify stsb is missing',
    kind: 'make',
    error: true,
    files: { '/root/main': `.thumb\nstsb r7, [r5, r3]` },
  });

  def({
    name: 'thumb.push',
    desc: 'Push registers to stack',
    kind: 'make',
    files: {
      '/root/main': `.thumb
push {r0, r1, r5-r7}             /// e3 b4
stmdb sp!, {r0, r1, r5-r7}       /// e3 b4
stmfd sp!, {r0, r1, r5-r7}       /// e3 b4
push {r0, r1, r5-r7, r14}        /// e3 b5
stmdb sp!, {r0, r1, r5-r7, r14}  /// e3 b5
stmfd sp!, {r0, r1, r5-r7, r14}  /// e3 b5
push {r0, lr, r1, r5-r7}         /// e3 b5
stmdb sp!, {r0, lr, r1, r5-r7}   /// e3 b5
stmfd sp!, {r0, lr, r1, r5-r7}   /// e3 b5
`,
    },
  });

  def({
    name: 'thumb.push-overflow',
    desc: 'Verify push doesn\'t allow high registers',
    kind: 'make',
    error: true,
    files: { '/root/main': `.thumb\npush {r0-r8}` },
  });

  def({
    name: 'thumb.pop',
    desc: 'Pop registers from stack',
    kind: 'make',
    files: {
      '/root/main': `.thumb
pop {r0, r1, r5-r7}              /// e3 bc
ldmia sp!, {r0, r1, r5-r7}       /// e3 bc
ldmfd sp!, {r0, r1, r5-r7}       /// e3 bc
pop {r0, r1, r5-r7, r15}         /// e3 bd
ldmia sp!, {r0, r1, r5-r7, r15}  /// e3 bd
ldmfd sp!, {r0, r1, r5-r7, r15}  /// e3 bd
pop {r0, pc, r1, r5-r7}          /// e3 bd
ldmia sp!, {r0, pc, r1, r5-r7}   /// e3 bd
ldmfd sp!, {r0, pc, r1, r5-r7}   /// e3 bd
`,
    },
  });

  def({
    name: 'thumb.stmia',
    desc: 'Store multiple',
    kind: 'make',
    files: {
      '/root/main': `.thumb
stmia r3!, {r0-r3}  /// 0f c3
stmea r3!, {r0-r3}  /// 0f c3
`,
    },
  });

  def({
    name: 'thumb.ldmia',
    desc: 'Load multiple',
    kind: 'make',
    files: {
      '/root/main': `.thumb
ldmia r3!, {r0-r3}  /// 0f cb
ldmfd r3!, {r0-r3}  /// 0f cb
`,
    },
  });

  def({
    name: 'thumb.b',
    desc: 'Branch',
    kind: 'make',
    files: {
      '/root/main': `.thumb
@top:
beq @top    /// fe d0
beq @bot    /// 1d d0
bne @top    /// fc d1
bne @bot    /// 1b d1
bcs @top    /// fa d2
bcs @bot    /// 19 d2
bhs @top    /// f8 d2
bhs @bot    /// 17 d2
bcc @top    /// f6 d3
bcc @bot    /// 15 d3
blo @top    /// f4 d3
blo @bot    /// 13 d3
bmi @top    /// f2 d4
bmi @bot    /// 11 d4
bpl @top    /// f0 d5
bpl @bot    /// 0f d5
bvs @top    /// ee d6
bvs @bot    /// 0d d6
bvc @top    /// ec d7
bvc @bot    /// 0b d7
bhi @top    /// ea d8
bhi @bot    /// 09 d8
bls @top    /// e8 d9
bls @bot    /// 07 d9
bge @top    /// e6 da
bge @bot    /// 05 da
blt @top    /// e4 db
blt @bot    /// 03 db
bgt @top    /// e2 dc
bgt @bot    /// 01 dc
ble @top    /// e0 dd
ble @bot    /// ff dd
@bot:
b @bot      /// fe e7
b @top      /// dd e7
b @next     /// 05 e0
.i16fill 6  /// 00 00 00 00 00 00 00 00 00 00 00 00
@next:
bal @next2  /// 05 e0
.i16fill 6  /// 00 00 00 00 00 00 00 00 00 00 00 00
@next2:
`,
    },
  });

  def({
    name: 'thumb.swi',
    desc: 'Software interrupt',
    kind: 'make',
    files: {
      '/root/main': `.thumb
swi 0    /// 00 df
swi 100  /// 64 df
swi 255  /// ff df
`,
    },
  });

  def({
    name: 'thumb.bl',
    desc: 'Branch and link',
    kind: 'make',
    files: {
      '/root/main': `.thumb
@top:
bl @top     /// ff f7 fe ff
bl @bot     /// 00 f0 06 f8
.i16fill 6  /// 00 00 00 00 00 00 00 00 00 00 00 00
@bot:
bl lr       /// 00 f8
`,
    },
  });
}
