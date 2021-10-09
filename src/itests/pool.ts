//
// gvasm - Assembler and disassembler for Game Boy Advance homebrew
// by Sean Connelly (@velipso), https://sean.cm
// The Unlicense License
// Project Home: https://github.com/velipso/gvasm
//

import { ITest } from "../itest.ts";

export function load(def: (test: ITest) => void) {
  def({
    name: "pool.missing",
    desc: "Error if .pool is required but missing",
    kind: "make",
    error: true,
    files: {
      "/root/main": `ldr r0, =0x12345678`,
    },
  });

  def({
    name: "pool.arm.ldr-mov",
    desc: "ARM pool ldr converted to mov",
    kind: "make",
    files: {
      "/root/main": `
mov r2, #0x03000000  /// 03 24 a0 e3
ldr r2, =0x03000000  /// 03 24 a0 e3
ldr r3, =0x34000000  /// 0d 33 a0 e3
ldr r3, =0x560000    /// 56 38 a0 e3
ldrmi r3, =0x7800    /// 1e 3b a0 43
ldrmi r3, =0x91      /// 91 30 a0 43
ldr.mi r3, =0x91     /// 91 30 a0 43
ldrmi r3, =0x50      /// 05 3e a0 43
`,
    },
  });

  def({
    name: "pool.arm.ldr-mvn",
    desc: "ARM pool ldr converted to mvn",
    kind: "make",
    files: {
      "/root/main": `
mvn r0, #0x03000000     /// 03 04 e0 e3
ldr r0, =0xfcffffff     /// 03 04 e0 e3
ldr r3, =0xcbffffff     /// 0d 33 e0 e3
ldr r3, =0xffa9ffff     /// 56 38 e0 e3
ldrmi r3, =0xffff87ff   /// 1e 3b e0 43
ldrmi r3, =0xffffff6e   /// 91 30 e0 43
ldr.mi r3, =0xffffff6e  /// 91 30 e0 43
ldrmi r3, =0xfffffffaf  /// 05 3e e0 43
`,
    },
  });

  def({
    name: "pool.arm.ldr-pool",
    desc: "ARM pool ldr stored in literal pool",
    kind: "make",
    files: {
      "/root/main": `
ldr r2, [#@L.0]        /// 04 20 1f e5
@L.0: .i32 0x12345678  /// 78 56 34 12
ldr r2, =0x12345678    /// 04 20 1f e5
.pool                  /// 78 56 34 12

// verify nothing is written
.pool

ldrmi r8, [#@L.1]       /// 0c 80 9f 45
.i32fill 2              /// 00 00 00 00 00 00 00 00
.i32fill 2              /// 00 00 00 00 00 00 00 00
@L.1: .i32 0x12345678   /// 78 56 34 12
ldr.mi r8, =0x12345678  /// 0c 80 9f 45
.i32fill 2              /// 00 00 00 00 00 00 00 00
.i32fill 2              /// 00 00 00 00 00 00 00 00
.pool                   /// 78 56 34 12
`,
    },
  });

  def({
    name: "pool.arm.ldrh",
    desc: "ARM pool ldrh",
    kind: "make",
    files: {
      "/root/main": `
ldrh r2, [#@L.0]     /// b4 20 5f e1
@L.0: .i32 0x1234    /// 34 12 00 00
ldrh r2, =0x1234     /// b4 20 5f e1
.pool                /// 34 12 00 00

ldrhmi r0, [#@L.1]   /// bc 00 df 41
.i32fill 2           /// 00 00 00 00 00 00 00 00
.i32fill 2           /// 00 00 00 00 00 00 00 00
@L.1: .i32 0x1234    /// 34 12 00 00
ldrh.mi r0, =0x1234  /// bc 00 df 41
.i32fill 2           /// 00 00 00 00 00 00 00 00
.i32fill 2           /// 00 00 00 00 00 00 00 00
.pool                /// 34 12 00 00
`,
    },
  });

  def({
    name: "pool.arm.ldrsh",
    desc: "ARM pool ldrsh",
    kind: "make",
    files: {
      "/root/main": `
ldrsh r2, [#@L.0]     /// f4 20 5f e1
@L.0: .i32 0x1234     /// 34 12 00 00
ldrsh r2, =0x1234     /// f4 20 5f e1
.pool                 /// 34 12 00 00

ldrshmi r0, [#@L.1]   /// fc 00 df 41
.i32fill 2            /// 00 00 00 00 00 00 00 00
.i32fill 2            /// 00 00 00 00 00 00 00 00
@L.1: .i32 0x1234     /// 34 12 00 00
ldrsh.mi r0, =0x1234  /// fc 00 df 41
.i32fill 2            /// 00 00 00 00 00 00 00 00
.i32fill 2            /// 00 00 00 00 00 00 00 00
.pool                 /// 34 12 00 00
`,
    },
  });

  def({
    name: "pool.arm.ldrsb",
    desc: "ARM pool ldrsb",
    kind: "make",
    files: {
      "/root/main": `
ldrsb r2, [#@L.0]    /// d4 20 5f e1
@L.0: .i32 0x12      /// 12 00 00 00
ldrsb r2, =0x12      /// d4 20 5f e1
.pool                /// 12 00 00 00

ldrsbmi r0, [#@L.1]  /// dc 00 df 41
.i32fill 2           /// 00 00 00 00 00 00 00 00
.i32fill 2           /// 00 00 00 00 00 00 00 00
@L.1: .i32 0x12      /// 12 00 00 00
ldrsb.mi r0, =0x12   /// dc 00 df 41
.i32fill 2           /// 00 00 00 00 00 00 00 00
.i32fill 2           /// 00 00 00 00 00 00 00 00
.pool                /// 12 00 00 00
`,
    },
  });

  def({
    name: "pool.thumb.ldr-mov",
    desc: "Thumb pool ldr converted to mov",
    kind: "make",
    files: {
      "/root/main": `.thumb
movs r2, #100  /// 64 22
ldr r2, =100   /// 01 4a
ldr r3, =100   /// 00 4b
ldr r3, =200   /// 01 4b
.pool          /// 64 00 00 00 c8 00 00 00
`,
    },
  });

  def({
    name: "pool.thumb.ldr-pool",
    desc: "Thumb pool ldr stored in literal pool",
    kind: "make",
    files: {
      "/root/main": `.thumb
ldr r4, [#@L]        /// 01 4c
ldr r4, [#@L]        /// 01 4c
ldr r4, [#@L]        /// 00 4c
ldr r4, [#@L]        /// 00 4c
@L: .i32 0x12345678  /// 78 56 34 12

ldr r4, =0x12345678  /// 01 4c
ldr r4, =0x12345678  /// 01 4c
ldr r4, =0x12345678  /// 00 4c
ldr r4, =0x12345678  /// 00 4c
.pool                /// 78 56 34 12
`,
    },
  });

  def({
    name: "pool.thumb.ldr-misaligned",
    desc: "Thumb pool ldr of misaligned pool",
    kind: "make",
    files: {
      "/root/main": `.thumb
ldr r4, [#@L]        /// 01 4c
ldr r4, [#@L]        /// 01 4c
ldr r4, [#@L]        /// 00 4c
.i16 0               /// 00 00
@L: .i32 0x12345678  /// 78 56 34 12

ldr r4, =0x12345678  /// 01 4c
ldr r4, =0x12345678  /// 01 4c
ldr r4, =0x12345678  /// 00 4c
.i8 0                /// 00
.pool                /// 00 78 56 34 12
`,
    },
  });

  def({
    name: "pool.early-rewrite",
    desc: "Use a label to generate a mov statement",
    kind: "make",
    files: {
      "/root/main": `
@here:
ldr r2, =@here  /// 02 23 a0 e3
`,
    },
  });

  def({
    name: "pool.late-rewrite-pool",
    desc: "Use a label after .pool to force a ldr",
    kind: "make",
    files: {
      "/root/main": `
ldr r0, =@here + 1  /// 04 00 1f e5
.pool               /// 09 00 00 08
@here:
`,
    },
  });

  def({
    name: "pool.late-rewrite-mov",
    desc: "Use a label after .pool but backtrack to mov",
    kind: "make",
    files: {
      "/root/main": `
ldr r2, =@here - 8  /// 02 23 a0 e3
.pool               /// 00 00 00 00
@here:
`,
    },
  });

  def({
    name: "pool.too-far-away",
    desc: "Use .pool too far away from ldr",
    kind: "make",
    error: true,
    files: {
      "/root/main": `
ldr r2, =12345
.align 0x1000
.i32 0
.i8 0
.pool
`,
    },
  });
}
