//
// gvasm - Assembler and disassembler for Game Boy Advance homebrew
// by Sean Connelly (@velipso), https://sean.cm
// Project Home: https://github.com/velipso/gvasm
// SPDX-License-Identifier: 0BSD
//

import { ITest } from '../itest.ts';
import { generateInit } from '../init.ts';

export function load(def: (test: ITest) => void) {
  def({
    name: 'basic.sanity',
    desc: 'Basic example program',
    kind: 'make',
    stdout: ['Main program at 0x080000c0'],
    files: {
      '/root/main': `
.stdlib
.arm
b main                /// 2e 00 00 ea
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
.title "Game"         /// 47 61 6d 65 00 00 00 00 00 00 00 00
.str "CAAE77"         /// 43 41 41 45 37 37
.i16 150, 0, 0, 0, 0  /// 96 00 00 00 00 00 00 00 00 00
.i8 0                 /// 00
.crc                  /// 5f
.i16 0                /// 00 00

main:

.printf 'Main program at %#08x', _here

ldr r0, =REG_DISPCNT  /// 01 03 a0 e3
mov r1, #0x0          /// 00 10 a0 e3
str r1, [r0]          /// 00 10 80 e5

mov r0, #0x05000000   /// 05 04 a0 e3
mov r1, #0x3e0        /// 3e 1e a0 e3
str r1, [r0]          /// 00 10 80 e5

loop: b loop          /// fe ff ff ea
`,
    },
  });

  def({
    name: 'basic.init',
    desc: 'Make sure init program compiles',
    kind: 'make',
    skipBytes: true,
    files: {
      '/root/main': generateInit({
        output: '',
        title: 'Game',
        initials: 'AA',
        maker: '77',
        version: 25,
        region: 'E',
        code: 'C',
        overwrite: false,
      }),
    },
  });

  def({
    name: 'basic.i8',
    desc: 'Use .i8 command',
    kind: 'make',
    files: {
      '/root/main': `
.i8 0           /// 00
.i8 1, 2, 3     /// 01 02 03
.i8 -1, -2, -3  /// ff fe fd
.i8 0x12345678  /// 78
.i8 0x87654321  /// 21
.str "hello"    /// 68 65 6c 6c 6f
`,
    },
  });

  def({
    name: 'basic.i8fill',
    desc: 'Use .i8fill command',
    kind: 'make',
    files: {
      '/root/main': `
.i8fill 10    /// 00 00 00 00 00 00 00 00 00 00
.i8fill 9, 1  /// 01 01 01 01 01 01 01 01 01
`,
    },
  });

  def({
    name: 'basic.ib8',
    desc: 'Use .ib8 command',
    kind: 'make',
    files: {
      '/root/main': `
.ib8 0           /// 00
.ib8 1, 2, 3     /// 01 02 03
.ib8 -1, -2, -3  /// ff fe fd
.ib8 0x12345678  /// 78
.ib8 0x87654321  /// 21
`,
    },
  });

  def({
    name: 'basic.ib8fill',
    desc: 'Use .ib8fill command',
    kind: 'make',
    files: {
      '/root/main': `
.ib8fill 10    /// 00 00 00 00 00 00 00 00 00 00
.ib8fill 9, 1  /// 01 01 01 01 01 01 01 01 01
`,
    },
  });

  def({
    name: 'basic.i16',
    desc: 'Use .i16 command',
    kind: 'make',
    files: {
      '/root/main': `
.i16 0           /// 00 00
.i16 1, 2, 3     /// 01 00 02 00 03 00
.i16 -1, -2, -3  /// ff ff fe ff fd ff
.i16 0x12345678  /// 78 56
.i16 0x87654321  /// 21 43
`,
    },
  });

  def({
    name: 'basic.i16fill',
    desc: 'Use .i16fill command',
    kind: 'make',
    files: {
      '/root/main': `
.i16fill 5     /// 00 00 00 00 00 00 00 00 00 00
.i16fill 4, 1  /// 01 00 01 00 01 00 01 00
`,
    },
  });

  def({
    name: 'basic.ib16',
    desc: 'Use .ib16 command',
    kind: 'make',
    files: {
      '/root/main': `
.ib16 0           /// 00 00
.ib16 1, 2, 3     /// 00 01 00 02 00 03
.ib16 -1, -2, -3  /// ff ff ff fe ff fd
.ib16 0x12345678  /// 56 78
.ib16 0x87654321  /// 43 21
`,
    },
  });

  def({
    name: 'basic.ib16fill',
    desc: 'Use .ib16fill command',
    kind: 'make',
    files: {
      '/root/main': `
.ib16fill 5     /// 00 00 00 00 00 00 00 00 00 00
.ib16fill 4, 1  /// 00 01 00 01 00 01 00 01
`,
    },
  });

  def({
    name: 'basic.i32',
    desc: 'Use .i32 command',
    kind: 'make',
    files: {
      '/root/main': `
.i32 0           /// 00 00 00 00
.i32 1, 2, 3     /// 01 00 00 00 02 00 00 00 03 00 00 00
.i32 -1, -2, -3  /// ff ff ff ff fe ff ff ff fd ff ff ff
.i32 0x12345678  /// 78 56 34 12
.i32 0x87654321  /// 21 43 65 87
`,
    },
  });

  def({
    name: 'basic.i32fill',
    desc: 'Use .i32fill command',
    kind: 'make',
    files: {
      '/root/main': `
.i32fill 3     /// 00 00 00 00 00 00 00 00 00 00 00 00
.i32fill 2, 1  /// 01 00 00 00 01 00 00 00
`,
    },
  });

  def({
    name: 'basic.ib32',
    desc: 'Use .ib32 command',
    kind: 'make',
    files: {
      '/root/main': `
.ib32 0           /// 00 00 00 00
.ib32 1, 2, 3     /// 00 00 00 01 00 00 00 02 00 00 00 03
.ib32 -1, -2, -3  /// ff ff ff ff ff ff ff fe ff ff ff fd
.ib32 0x12345678  /// 12 34 56 78
.ib32 0x87654321  /// 87 65 43 21
`,
    },
  });

  def({
    name: 'basic.ib32fill',
    desc: 'Use .ib32fill command',
    kind: 'make',
    files: {
      '/root/main': `
.ib32fill 3     /// 00 00 00 00 00 00 00 00 00 00 00 00
.ib32fill 2, 1  /// 00 00 00 01 00 00 00 01
`,
    },
  });

  def({
    name: 'basic.i16-misaligned',
    desc: 'Verify .i16 will error on misaligned data',
    kind: 'make',
    error: true,
    files: {
      '/root/main': `
.i8 0
.i16 0
`,
    },
  });

  def({
    name: 'basic.im16',
    desc: 'Use .im16 to allow misalignment',
    kind: 'make',
    files: {
      '/root/main': `
.i8 0    /// 00
.im16 0  /// 00 00
`,
    },
  });

  def({
    name: 'basic.i32-misaligned',
    desc: 'Verify .i32 will error on misaligned data',
    kind: 'make',
    error: true,
    files: {
      '/root/main': `
.i16 0
.i32 0
`,
    },
  });

  def({
    name: 'basic.im32',
    desc: 'Use .im32 to allow misalignment',
    kind: 'make',
    files: {
      '/root/main': `
.i16 0   /// 00 00
.im32 0  /// 00 00 00 00
`,
    },
  });

  def({
    name: 'basic.hex',
    desc: 'Represent number as hexidecimal',
    kind: 'make',
    files: {
      '/root/main': `
.im8 0x45             /// 45
.im16 0x12_34         /// 34 12
.im32 -0xff_ff_ff_ff  /// 01 00 00 00
`,
    },
  });

  def({
    name: 'basic.dec',
    desc: 'Represent number as decimal',
    kind: 'make',
    files: {
      '/root/main': `
.im8 12__7    /// 7f
.im16 -5_1_2  /// 00 fe
.im32 4_096   /// 00 10 00 00
`,
    },
  });

  def({
    name: 'basic.dec-invalid',
    desc: 'Invalid decimal number',
    kind: 'make',
    error: true,
    files: { '/root/main': `.i32 123abc` },
  });

  def({
    name: 'basic.oct',
    desc: 'Represent number as octal',
    kind: 'make',
    files: {
      '/root/main': `
.im8 0c7_7          /// 3f
.im16 0c55_55       /// 6d 0b
.im32 -0c1234_5670  /// 48 34 d6 ff
`,
    },
  });

  def({
    name: 'basic.oct-invalid',
    desc: 'Invalid octal number',
    kind: 'make',
    error: true,
    files: { '/root/main': `.i32 0c56781` },
  });

  def({
    name: 'basic.bin',
    desc: 'Represent number as binary',
    kind: 'make',
    files: {
      '/root/main': `
.im8  0b1000_1111                                /// 8f
.im16 0b1010_0101_1111_0000                      /// f0 a5
.im32 0b1100_1101_1110_1111_0001_0010_0011_0100  /// 34 12 ef cd
`,
    },
  });

  def({
    name: 'basic.bin-invalid',
    desc: 'Invalid binary number',
    kind: 'make',
    error: true,
    files: { '/root/main': `.i32 0b1011210` },
  });

  def({
    name: 'basic.base-zero',
    desc: 'Use .i32 command with base zero',
    kind: 'make',
    files: {
      '/root/main': `
.base 0
zero: .i32 zero  /// 00 00 00 00
`,
    },
  });

  def({
    name: 'basic.base-default',
    desc: 'Use .i32 command with default base',
    kind: 'make',
    files: {
      '/root/main': `
main: .i32 main  /// 00 00 00 08
`,
    },
  });

  def({
    name: 'basic.base-in-scope',
    desc: 'Use .base inside a scope',
    kind: 'make',
    files: {
      '/root/main': `
.i32 _base          /// 00 00 00 08
.begin
  .base 0x02000000
  .i32 _base        /// 00 00 00 02
.end
.i32 _base          /// 00 00 00 08
`,
    },
  });

  /* TODO: enable after pool works
  def({
    name: 'basic.base-affects-adr',
    desc: 'Using .base affects addresses in code',
    kind: 'make',
    files: {
      '/root/main': `
.thumb
ldr r0, =0x08000004  /// 00 a0
.base 0x02000000
ldr r0, =0x02000004  /// 00 a0
`,
    },
  }); */

  def({
    name: 'basic.base-relative-bug',
    desc: 'Base should be relative to where it was declared',
    kind: 'make',
    files: {
      '/root/main': `
a:
.i32 0  /// 00 00 00 00
.base 0x03000000
.i32 0  /// 00 00 00 00
b:
.i32 0  /// 00 00 00 00
.i32 a  /// 00 00 00 08
.i32 b  /// 04 00 00 03
`,
    },
  });

  def({
    name: 'basic.align',
    desc: 'Use .align command',
    kind: 'make',
    files: {
      '/root/main': `
.i8 7     /// 07
.align 4  /// 00 00 00
.i8 9     /// 09
`,
    },
  });

  def({
    name: 'basic.align-base',
    desc: 'Make sure .align takes .base into account',
    kind: 'make',
    files: {
      '/root/main': `
.base 1
.align 4        /// 00 00 00
.i8 9           /// 09
.align 9, 0xcc  /// cc cc cc cc
.i8 5           /// 05
`,
    },
  });

  def({
    name: 'basic.align-nop',
    desc: 'Align using nop statements',
    kind: 'make',
    files: {
      '/root/main': `
.base 0
.arm
.i8 0, 0, 0     /// 00 00 00
.align 12, nop  /// e1 00 00 a0 e1 00 00 a0 e1
.thumb
.i8 0, 0, 0     /// 00 00 00
.align 12, nop  /// 46 c0 46 c0 46 c0 46 c0 46
`,
    },
  });

  def({
    name: 'basic.align-nop-mode',
    desc: 'Aligning with nop without mode is an error',
    kind: 'make',
    error: true,
    files: {
      '/root/main': `
.align 2, nop
`,
    },
  });

  def({
    name: 'basic.title',
    desc: 'Use .title command',
    kind: 'make',
    files: {
      '/root/main': `
.title ""              /// 00 00 00 00 00 00 00 00 00 00 00 00
.title "A"             /// 41 00 00 00 00 00 00 00 00 00 00 00
.title "AAAAAAAAAAAA"  /// 41 41 41 41 41 41 41 41 41 41 41 41
`,
    },
  });

  def({
    name: 'basic.title-overflow',
    desc: 'Error when a .title is too long',
    kind: 'make',
    error: true,
    files: {
      '/root/main': `
.title "AAAAAAAAAAAAZ"
`,
    },
  });

  def({
    name: 'basic.error',
    desc: 'Use .error command',
    kind: 'make',
    error: true,
    files: {
      '/root/main': `.error "This is an error %d", 5`,
    },
  });

  def({
    name: 'basic.continue-line',
    desc: 'Use backslash to continue a line',
    kind: 'make',
    files: {
      '/root/main': `
.i8   \\
 1    \\  // comment here
 ,    \\  /* comment here */
 2    \\
 , 3  /// 01 02 03
`,
    },
  });
}
