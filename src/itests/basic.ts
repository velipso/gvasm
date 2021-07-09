//
// gvasm - Assembler and disassembler for Game Boy Advance homebrew
// by Sean Connelly (@velipso), https://sean.cm
// The Unlicense License
// Project Home: https://github.com/velipso/gvasm
//

import { ITest } from "../itest.ts";

export function load(def: (test: ITest) => void) {
  def({
    name: "basic.sanity",
    desc: "Basic example program",
    kind: "make",
    files: {
      "/root/main": `
b @main /// 2e 00 00 ea
.Logo
/// 24 ff ae 51 69 9a a2 21 3d 84 82 0a
/// 84 e4 09 ad 11 24 8b 98 c0 81 7f 21 a3 52 be 19
/// 93 09 ce 20 10 46 4a 4a f8 27 31 ec 58 c7 e8 33
/// 82 e3 ce bf 85 f4 df 94 ce 4b 09 c1 94 56 8a c0
/// 13 72 a7 fc 9f 84 4d 73 a3 ca 9a 61 58 97 a3 27
/// fc 03 98 76 23 1d c7 61 03 04 ae 56 bf 38 84 00
/// 40 a7 0e fd ff 52 fe 03 6f 95 30 f1 97 fb c0 85
/// 60 d6 80 25 a9 63 be 03 01 4e 38 e2 f9 a2 34 ff
/// bb 3e 03 44 78 00 90 cb 88 11 3a 94 65 c0 7c 63
/// 87 f0 3c af d6 25 e4 8b 38 0a ac 72 21 d4 f8 07
.title "Game"          /// 47 61 6d 65 00 00 00 00 00 00 00 00
.i8 "CAAE77"           /// 43 41 41 45 37 37
.i16 150, 0, 0, 0, 0   /// 96 00 00 00 00 00 00 00 00 00
.I8 0                  /// 00
.crc                   /// 5f
.i16 0                 /// 00 00

@main:

MOV r0, #0x04000000    /// 01 03 a0 e3
mov r1, #0x0           /// 00 10 a0 e3
str r1, [r0]           /// 00 10 80 e5

mov r0, #0x05000000    /// 05 04 a0 e3
mov r1, #0x3e0         /// 3e 1e a0 e3
str r1, [r0]           /// 00 10 80 e5

@LOOP: b @loop         /// fe ff ff ea
`,
    },
  });

  def({
    name: "basic.i8",
    desc: "Use .i8 command",
    kind: "make",
    files: {
      "/root/main": `
.i8 0           /// 00
.i8 1, 2, 3     /// 01 02 03
.i8 -1, -2, -3  /// ff fe fd
.i8 0x12345678  /// 78
.i8 0x87654321  /// 21
.i8 "hello"     /// 68 65 6c 6c 6f
`,
    },
  });

  def({
    name: "basic.b8",
    desc: "Use .b8 command",
    kind: "make",
    files: {
      "/root/main": `
.b8 0           /// 00
.b8 1, 2, 3     /// 01 02 03
.b8 -1, -2, -3  /// ff fe fd
.b8 0x12345678  /// 78
.b8 0x87654321  /// 21
.b8 "hello"     /// 68 65 6c 6c 6f
`,
    },
  });

  def({
    name: "basic.i16",
    desc: "Use .i16 command",
    kind: "make",
    files: {
      "/root/main": `
.i16 0           /// 00 00
.i16 1, 2, 3     /// 01 00 02 00 03 00
.i16 -1, -2, -3  /// ff ff fe ff fd ff
.i16 0x12345678  /// 78 56
.i16 0x87654321  /// 21 43
`,
    },
  });

  def({
    name: "basic.b16",
    desc: "Use .b16 command",
    kind: "make",
    files: {
      "/root/main": `
.b16 0           /// 00 00
.b16 1, 2, 3     /// 00 01 00 02 00 03
.b16 -1, -2, -3  /// ff ff ff fe ff fd
.b16 0x12345678  /// 56 78
.b16 0x87654321  /// 43 21
`,
    },
  });

  def({
    name: "basic.i32",
    desc: "Use .i32 command",
    kind: "make",
    files: {
      "/root/main": `
.i32 0           /// 00 00 00 00
.i32 1, 2, 3     /// 01 00 00 00 02 00 00 00 03 00 00 00
.i32 -1, -2, -3  /// ff ff ff ff fe ff ff ff fd ff ff ff
.i32 0x12345678  /// 78 56 34 12
.i32 0x87654321  /// 21 43 65 87
`,
    },
  });

  def({
    name: "basic.b32",
    desc: "Use .b32 command",
    kind: "make",
    files: {
      "/root/main": `
.b32 0           /// 00 00 00 00
.b32 1, 2, 3     /// 00 00 00 01 00 00 00 02 00 00 00 03
.b32 -1, -2, -3  /// ff ff ff ff ff ff ff fe ff ff ff fd
.b32 0x12345678  /// 12 34 56 78
.b32 0x87654321  /// 87 65 43 21
`,
    },
  });

  def({
    name: "basic.hex",
    desc: "Represent number as hexidecimal",
    kind: "make",
    files: {
      "/root/main": `
.i8 0x45             /// 45
.i16 0x12_34         /// 34 12
.i32 -0xff_ff_ff_ff  /// 01 00 00 00
`,
    },
  });

  def({
    name: "basic.dec",
    desc: "Represent number as decimal",
    kind: "make",
    files: {
      "/root/main": `
.i8 12__7    /// 7f
.i16 -5_1_2  /// 00 fe
.i32 4_096   /// 00 10 00 00
`,
    },
  });

  def({
    name: "basic.dec-invalid",
    desc: "Invalid decimal number",
    kind: "make",
    error: true,
    files: { "/root/main": `.i32 123abc` },
  });

  def({
    name: "basic.oct",
    desc: "Represent number as octal",
    kind: "make",
    files: {
      "/root/main": `
.i8 0c7_7          /// 3f
.i16 0c55_55       /// 6d 0b
.i32 -0c1234_5670  /// 48 34 d6 ff
`,
    },
  });

  def({
    name: "basic.oct-invalid",
    desc: "Invalid octal number",
    kind: "make",
    error: true,
    files: { "/root/main": `.i32 0c56781` },
  });

  def({
    name: "basic.bin",
    desc: "Represent number as binary",
    kind: "make",
    files: {
      "/root/main": `
.i8  0b1000_1111                                /// 8f
.i16 0b1010_0101_1111_0000                      /// f0 a5
.i32 0b1100_1101_1110_1111_0001_0010_0011_0100  /// 34 12 ef cd
`,
    },
  });

  def({
    name: "basic.bin-invalid",
    desc: "Invalid binary number",
    kind: "make",
    error: true,
    files: { "/root/main": `.i32 0b1011210` },
  });

  def({
    name: "basic.base-zero",
    desc: "Use .i32 command with base zero",
    kind: "make",
    files: {
      "/root/main": `
.base 0
@zero: .i32 @zero /// 00 00 00 00
`,
    },
  });

  def({
    name: "basic.base-default",
    desc: "Use .i32 command with default base",
    kind: "make",
    files: {
      "/root/main": `
@main: .i32 @main /// 00 00 00 08
`,
    },
  });

  def({
    name: "basic.align",
    desc: "Use .align command",
    kind: "make",
    files: {
      "/root/main": `
.i8 7     /// 07
.align 4  /// 00 00 00
.i8 9     /// 09
`,
    },
  });

  def({
    name: "basic.align-base",
    desc: "Make sure .align takes .base into account",
    kind: "make",
    files: {
      "/root/main": `
.base 1
.align 4        /// 00 00 00
.i8 9           /// 09
.align 9, 0xcc  /// cc cc cc cc
.i8 5           /// 05
`,
    },
  });

  def({
    name: "basic.title",
    desc: "Use .title command",
    kind: "make",
    files: {
      "/root/main": `
.title ""              /// 00 00 00 00 00 00 00 00 00 00 00 00
.title "A"             /// 41 00 00 00 00 00 00 00 00 00 00 00
.title "AAAAAAAAAAAA"  /// 41 41 41 41 41 41 41 41 41 41 41 41
`,
    },
  });

  def({
    name: "basic.title-overflow",
    desc: "Error when a .title is too long",
    kind: "make",
    error: true,
    files: {
      "/root/main": `
.title "AAAAAAAAAAAAZ"
`,
    },
  });

  def({
    name: "basic.error",
    desc: "Use .error command",
    kind: "make",
    error: true,
    files: {
      "/root/main": `.error "This is an error"`,
    },
  });
}
