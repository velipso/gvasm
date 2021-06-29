//
// gbasm - Assembler and disassembler for Game Boy Advance homebrew
// by Sean Connelly (@velipso), https://sean.cm
// The Unlicense License
// Project Home: https://github.com/velipso/gbasm
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
.logo
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
.u8 "CAAE77"           /// 43 41 41 45 37 37
.u16 150, 0, 0, 0, 0   /// 96 00 00 00 00 00 00 00 00 00
.u8 0                  /// 00
.crc                   /// 5f
.u16 0                 /// 00 00

@main:

mov r0, #0x04000000    /// 01 03 a0 e3
mov r1, #0x0           /// 00 10 a0 e3
str r1, [r0]           /// 00 10 00 e5

mov r0, #0x05000000    /// 05 04 a0 e3
mov r1, #0x3e0         /// 3e 1e a0 e3
str r1, [r0]           /// 00 10 00 e5

@loop: b @loop         /// fe ff ff ea
`,
    },
  });

  def({
    name: "basic.u8",
    desc: "Use .u8 command",
    kind: "make",
    files: {
      "/root/main": `
.u8 0           /// 00
.u8 1, 2, 3     /// 01 02 03
.u8 -1, -2, -3  /// ff fe fd
.u8 0x12345678  /// 78
.u8 0x87654321  /// 21
`,
    },
  });

  def({
    name: "basic.u16",
    desc: "Use .u16 command",
    kind: "make",
    files: {
      "/root/main": `
.u16 0           /// 00 00
.u16 1, 2, 3     /// 01 00 02 00 03 00
.u16 -1, -2, -3  /// ff ff fe ff fd ff
.u16 0x12345678  /// 78 56
.u16 0x87654321  /// 21 43
`,
    },
  });

  def({
    name: "basic.u32",
    desc: "Use .u32 command",
    kind: "make",
    files: {
      "/root/main": `
.u32 0           /// 00 00 00 00
.u32 1, 2, 3     /// 01 00 00 00 02 00 00 00 03 00 00 00
.u32 -1, -2, -3  /// ff ff ff ff fe ff ff ff fd ff ff ff
.u32 0x12345678  /// 78 56 34 12
.u32 0x87654321  /// 21 43 65 87
`,
    },
  });

  def({
    name: "basic.base-zero",
    desc: "Use .u32 command with base zero",
    kind: "make",
    files: {
      "/root/main": `
.base 0
@zero: .u32 @zero /// 00 00 00 00
`,
    },
  });

  def({
    name: "basic.base-default",
    desc: "Use .u32 command with default base",
    kind: "make",
    files: {
      "/root/main": `
@main: .u32 @main /// 00 00 00 08
`,
    },
  });

  def({
    name: "basic.align",
    desc: "Use .align command",
    kind: "make",
    files: {
      "/root/main": `
.u8 7     /// 07
.align 4  /// 00 00 00
.u8 9     /// 09
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
.u8 9           /// 09
.align 9, 0xcc  /// cc cc cc cc
.u8 5           /// 05
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
}
