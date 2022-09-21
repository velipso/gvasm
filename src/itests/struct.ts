//
// gvasm - Assembler and disassembler for Game Boy Advance homebrew
// by Sean Connelly (@velipso), https://sean.cm
// Project Home: https://github.com/velipso/gvasm
// SPDX-License-Identifier: 0BSD
//

import { ITest } from '../itest.ts';

export function load(def: (test: ITest) => void) {
  def({
    name: 'struct.basic',
    desc: 'Basic usage of .struct',
    kind: 'make',
    files: {
      '/root/main': `
.struct s
  .i8 one, two
  .i16 three
  .i32 four
five:
  .i32 six
.end

.i8 s.one    /// 00
.i8 s.two    /// 01
.i8 s.three  /// 02
.i8 s.four   /// 04
.i8 s.five   /// 08
.i8 s.six    /// 08
`,
    },
  });

  def({
    name: 'struct.align',
    desc: 'Struct members should align correctly',
    kind: 'make',
    files: {
      '/root/main': `
.struct s
  .i8 one
  .align 4
  .i32 two
  .i8 three
  .align 2
  .i16 four
  .i8 five
  .align 4
  .i32 six
.end

.i8 s.one    /// 00
.i8 s.two    /// 04
.i8 s.three  /// 08
.i8 s.four   /// 0a
.i8 s.five   /// 0c
.i8 s.six    /// 10
`,
    },
  });

  def({
    name: 'struct.misalign',
    desc: 'Struct should error if members are misaligned',
    kind: 'make',
    error: true,
    files: {
      '/root/main': `
.struct s
  .i8 one
  .i32 two
.end
`,
    },
  });

  def({
    name: 'struct.misalign-array',
    desc: 'Struct should become misaligned due to array',
    kind: 'make',
    error: true,
    files: {
      '/root/main': `
.struct s[2]
  .i16 one
  .i8 two
.end
`,
    },
  });

  def({
    name: 'struct.nested',
    desc: 'Structs can contain structs',
    kind: 'make',
    files: {
      '/root/main': `
.struct s
  .i8 one
  .align 2
  .struct two
    .i16 one
    .i8 two
    .align 4
    .i32 three
  .end
  .i8 three
  .align 2
  .i16 four
.end

.i8 s.one        /// 00
.i8 s.two.one    /// 02
.i8 s.two.two    /// 04
.i8 s.two.three  /// 08
.i8 s.three      /// 0c
.i8 s.four       /// 0e
`,
    },
  });

  def({
    name: 'struct.if',
    desc: 'Structs can have conditional fields',
    kind: 'make',
    files: {
      '/root/main': `
.struct s
  .i8 one, two
  .if 0
    .align 4
    .i32 three
  .else
    .i16 three
  .end
  .align 4
  .i32 four
.end

.i8 s.one    /// 00
.i8 s.two    /// 01
.i8 s.three  /// 02
.i8 s.four   /// 04
`,
    },
  });

  def({
    name: 'struct.reject-regular',
    desc: 'Reject regular statements inside .struct',
    kind: 'make',
    error: true,
    files: {
      '/root/main': `
.struct a
mov r0, r1
.end
`,
    },
  });

  def({
    name: 'struct.reject-reserved-names',
    desc: 'Reject _name',
    kind: 'make',
    error: true,
    files: {
      '/root/main': `
.struct a
  .i8 _someName
.end
`,
    },
  });

  def({
    name: 'struct.reject-duplicate-names',
    desc: 'Reject duplicate member names',
    kind: 'make',
    error: true,
    files: {
      '/root/main': `
.struct a
  .i8 foo
  .i8 bar
  .i16 foo[2]
.end
`,
    },
  });

  def({
    name: 'struct.array',
    desc: 'Arrays inside structs',
    kind: 'make',
    files: {
      '/root/main': `
.struct s
  .i16 one[5]
  .align 4
  .i32 two
.end
.struct s2
.end

.i8 s.one          /// 00
.i8 s.one._length  /// 05
.i8 s.one._bytes   /// 0a
.i8 s.two          /// 0c
.i8 s.two._length  /// 01
.i8 s.two._bytes   /// 04
.i8 s2._bytes      /// 00
`,
    },
  });

  def({
    name: 'struct.array-multiple',
    desc: 'Multiple arrays inside structs',
    kind: 'make',
    files: {
      '/root/main': `
.struct s
  .i8 one[5]
  .struct two[3]
    .i8 three[5]
  .end
  .struct four[2]
    .struct five[3]
      .i8 six[9]
    .end
    .i8 seven
  .end
  .i8 eight[1]
  .i8 nine
.end

.i8 s.four[1].five[2].six[4]  /// 46
.i8 s.nine                    /// 4d
.i8 s._bytes                  /// 4e
`,
    },
  });

  def({
    name: 'struct.start-address',
    desc: 'Start address with struct',
    kind: 'make',
    files: {
      '/root/main': `
.struct s = 0x03000000
  .i8 one
  .i8 two
.end

.i32 s.one      /// 00 00 00 03
.i32 s.two      /// 01 00 00 03
`,
    },
  });

  def({
    name: 'struct.align-misaligned-start',
    desc: 'Aligning a struct that starts misaligned',
    kind: 'make',
    files: {
      '/root/main': `
.struct s = 0x03000001
  .i8 one
  .align 4
  .i8 two
.end

.i32 s.one      /// 01 00 00 03
.i32 s.two      /// 04 00 00 03
`,
    },
  });

  def({
    name: 'struct.reject-misaligned-start',
    desc: 'Alignment should be based on final location',
    kind: 'make',
    error: true,
    files: {
      '/root/main': `
.struct s = 0x03000001
  .i8 one, two
  .i16 three
.end
`,
    },
  });

  def({
    name: 'struct.typed-mem.arm.32',
    desc: 'Typed ARM ldrx/strx converts to ldr/str',
    kind: 'make',
    files: {
      '/root/main': `
.struct S
  .i32 one
  .i32 two
  .u32 three
.end
.arm
ldr  r0, [r1, #S.two]        /// 04 00 91 e5
ldrx r0, [r1, #S.two]        /// 04 00 91 e5
ldr  r0, [r1, r2]            /// 02 00 91 e7
ldrx r0, [r1, r2] (S.two)    /// 02 00 91 e7
ldr  r0, [r1]                /// 00 00 91 e5
ldrx r0, [r1] (S.two)        /// 00 00 91 e5
ldr  r0, [r1, #S.three]      /// 08 00 91 e5
ldrx r0, [r1, #S.three]      /// 08 00 91 e5
ldr  r0, [r1, r2]            /// 02 00 91 e7
ldrx r0, [r1, r2] (S.three)  /// 02 00 91 e7
ldr  r0, [r1]                /// 00 00 91 e5
ldrx r0, [r1] (S.three)      /// 00 00 91 e5

str  r0, [r1, #S.two]        /// 04 00 81 e5
strx r0, [r1, #S.two]        /// 04 00 81 e5
str  r0, [r1, r2]            /// 02 00 81 e7
strx r0, [r1, r2] (S.two)    /// 02 00 81 e7
str  r0, [r1]                /// 00 00 81 e5
strx r0, [r1] (S.two)        /// 00 00 81 e5
str  r0, [r1, #S.three]      /// 08 00 81 e5
strx r0, [r1, #S.three]      /// 08 00 81 e5
str  r0, [r1, r2]            /// 02 00 81 e7
strx r0, [r1, r2] (S.three)  /// 02 00 81 e7
str  r0, [r1]                /// 00 00 81 e5
strx r0, [r1] (S.three)      /// 00 00 81 e5
`,
    },
  });

  def({
    name: 'struct.typed-mem.arm.16',
    desc: 'Typed ARM ldrx/strx converts to ldrh/ldrsh/strh',
    kind: 'make',
    files: {
      '/root/main': `
.struct S
  .i16 one
  .i16 two
  .u16 three
.end
.arm
ldrsh r0, [r1, #S.two]        /// f2 00 d1 e1
ldrx  r0, [r1, #S.two]        /// f2 00 d1 e1
ldrsh r0, [r1, r2]            /// f2 00 91 e1
ldrx  r0, [r1, r2] (S.two)    /// f2 00 91 e1
ldrsh r0, [r1]                /// f0 00 d1 e1
ldrx  r0, [r1] (S.two)        /// f0 00 d1 e1
ldrh  r0, [r1, #S.three]      /// b4 00 d1 e1
ldrx  r0, [r1, #S.three]      /// b4 00 d1 e1
ldrh  r0, [r1, r2]            /// b2 00 91 e1
ldrx  r0, [r1, r2] (S.three)  /// b2 00 91 e1
ldrh  r0, [r1]                /// b0 00 d1 e1
ldrx  r0, [r1] (S.three)      /// b0 00 d1 e1

strh  r0, [r1, #S.two]        /// b2 00 c1 e1
strx  r0, [r1, #S.two]        /// b2 00 c1 e1
strh  r0, [r1, r2]            /// b2 00 81 e1
strx  r0, [r1, r2] (S.two)    /// b2 00 81 e1
strh  r0, [r1]                /// b0 00 c1 e1
strx  r0, [r1] (S.two)        /// b0 00 c1 e1
strh  r0, [r1, #S.three]      /// b4 00 c1 e1
strx  r0, [r1, #S.three]      /// b4 00 c1 e1
strh  r0, [r1, r2]            /// b2 00 81 e1
strx  r0, [r1, r2] (S.three)  /// b2 00 81 e1
strh  r0, [r1]                /// b0 00 c1 e1
strx  r0, [r1] (S.three)      /// b0 00 c1 e1
`,
    },
  });

  def({
    name: 'struct.typed-mem.arm.8',
    desc: 'Typed ARM ldrx/strx converts to ldrb/ldrsb/strb',
    kind: 'make',
    files: {
      '/root/main': `
.struct S
  .i8 one
  .i8 two
  .u8 three
.end
.arm
ldrsb r0, [r1, #S.two]        /// d1 00 d1 e1
ldrx  r0, [r1, #S.two]        /// d1 00 d1 e1
ldrsb r0, [r1, r2]            /// d2 00 91 e1
ldrx  r0, [r1, r2] (S.two)    /// d2 00 91 e1
ldrsb r0, [r1]                /// d0 00 d1 e1
ldrx  r0, [r1] (S.two)        /// d0 00 d1 e1
ldrb  r0, [r1, #S.three]      /// 02 00 d1 e5
ldrx  r0, [r1, #S.three]      /// 02 00 d1 e5
ldrb  r0, [r1, r2]            /// 02 00 d1 e7
ldrx  r0, [r1, r2] (S.three)  /// 02 00 d1 e7
ldrb  r0, [r1]                /// 00 00 d1 e5
ldrx  r0, [r1] (S.three)      /// 00 00 d1 e5

strb  r0, [r1, #S.two]        /// 01 00 c1 e5
strx  r0, [r1, #S.two]        /// 01 00 c1 e5
strb  r0, [r1, r2]            /// 02 00 c1 e7
strx  r0, [r1, r2] (S.two)    /// 02 00 c1 e7
strb  r0, [r1]                /// 00 00 c1 e5
strx  r0, [r1] (S.two)        /// 00 00 c1 e5
strb  r0, [r1, #S.three]      /// 02 00 c1 e5
strx  r0, [r1, #S.three]      /// 02 00 c1 e5
strb  r0, [r1, r2]            /// 02 00 c1 e7
strx  r0, [r1, r2] (S.three)  /// 02 00 c1 e7
strb  r0, [r1]                /// 00 00 c1 e5
strx  r0, [r1] (S.three)      /// 00 00 c1 e5
`,
    },
  });

  def({
    name: 'struct.typed-mem.thumb.32',
    desc: 'Typed Thumb ldrx/strx converts to ldr/str',
    kind: 'make',
    files: {
      '/root/main': `
.struct S
  .i32 one
  .i32 two
  .u32 three
.end
.thumb
ldr  r0, [r1, #S.two]        /// 48 68
ldrx r0, [r1, #S.two]        /// 48 68
ldr  r0, [r1, r2]            /// 88 58
ldrx r0, [r1, r2] (S.two)    /// 88 58
ldr  r0, [r1]                /// 08 68
ldrx r0, [r1] (S.two)        /// 08 68
ldr  r0, [r1, #S.three]      /// 88 68
ldrx r0, [r1, #S.three]      /// 88 68
ldr  r0, [r1, r2]            /// 88 58
ldrx r0, [r1, r2] (S.three)  /// 88 58
ldr  r0, [r1]                /// 08 68
ldrx r0, [r1] (S.three)      /// 08 68

str  r0, [r1, #S.two]        /// 48 60
strx r0, [r1, #S.two]        /// 48 60
str  r0, [r1, r2]            /// 88 50
strx r0, [r1, r2] (S.two)    /// 88 50
str  r0, [r1]                /// 08 60
strx r0, [r1] (S.two)        /// 08 60
str  r0, [r1, #S.three]      /// 88 60
strx r0, [r1, #S.three]      /// 88 60
str  r0, [r1, r2]            /// 88 50
strx r0, [r1, r2] (S.three)  /// 88 50
str  r0, [r1]                /// 08 60
strx r0, [r1] (S.three)      /// 08 60
`,
    },
  });

  def({
    name: 'struct.typed-mem.thumb.ldsh-imm',
    desc: 'Cannot convert ldrx into ldsh when using immediate',
    kind: 'make',
    error: true,
    files: {
      '/root/main': `
.struct S
  .i16 one
  .i16 two
  .u16 three
.end
.thumb
ldrx r0, [r1, #S.two]
`,
    },
  });

  def({
    name: 'struct.typed-mem.thumb.ldsh-zero',
    desc: 'Cannot convert ldrx into ldsh when using zero',
    kind: 'make',
    error: true,
    files: {
      '/root/main': `
.struct S
  .i16 one
  .i16 two
  .u16 three
.end
.thumb
ldrx r0, [r1] (S.two)
`,
    },
  });

  def({
    name: 'struct.typed-mem.thumb.16',
    desc: 'Typed Thumb ldrx/strx converts to ldrh/ldsh/strh',
    kind: 'make',
    files: {
      '/root/main': `
.struct S
  .i16 one
  .i16 two
  .u16 three
.end
.thumb
// ldsh r0, [r1, #S.two] is an invalid opcode
// ldrx r0, [r1, #S.two] cannot be converted
ldsh r0, [r1, r2]            /// 88 5e
ldrx r0, [r1, r2] (S.two)    /// 88 5e
// ldsh r0, [r1] is an invalid opcode
// ldrx r0, [r1] (S.two) cannot be converted
ldrh r0, [r1, #S.three]      /// 88 88
ldrx r0, [r1, #S.three]      /// 88 88
ldrh r0, [r1, r2]            /// 88 5a
ldrx r0, [r1, r2] (S.three)  /// 88 5a
ldrh r0, [r1]                /// 08 88
ldrx r0, [r1] (S.three)      /// 08 88

strh r0, [r1, #S.two]        /// 48 80
strx r0, [r1, #S.two]        /// 48 80
strh r0, [r1, r2]            /// 88 52
strx r0, [r1, r2] (S.two)    /// 88 52
strh r0, [r1]                /// 08 80
strx r0, [r1] (S.two)        /// 08 80
strh r0, [r1, #S.three]      /// 88 80
strx r0, [r1, #S.three]      /// 88 80
strh r0, [r1, r2]            /// 88 52
strx r0, [r1, r2] (S.three)  /// 88 52
strh r0, [r1]                /// 08 80
strx r0, [r1] (S.three)      /// 08 80
`,
    },
  });

  def({
    name: 'struct.typed-mem.thumb.ldsb-imm',
    desc: 'Cannot convert ldrx into ldsb when using immediate',
    kind: 'make',
    error: true,
    files: {
      '/root/main': `
.struct S
  .i8 one
  .i8 two
  .u8 three
.end
.thumb
ldrx r0, [r1, #S.two]
`,
    },
  });

  def({
    name: 'struct.typed-mem.thumb.ldsb-zero',
    desc: 'Cannot convert ldrx into ldsb when using zero',
    kind: 'make',
    error: true,
    files: {
      '/root/main': `
.struct S
  .i8 one
  .i8 two
  .u8 three
.end
.thumb
ldrx r0, [r1] (S.two)
`,
    },
  });

  def({
    name: 'struct.typed-mem.thumb.8',
    desc: 'Typed ARM ldrx/strx converts to ldrb/ldsb/strb',
    kind: 'make',
    files: {
      '/root/main': `
.struct S
  .i8 one
  .i8 two
  .u8 three
.end
.thumb
// ldsb r0, [r1, #S.two] is an invalid opcode
// ldrx r0, [r1, #S.two] cannot be converted
ldsb r0, [r1, r2]            /// 88 56
ldrx r0, [r1, r2] (S.two)    /// 88 56
// ldsb r0, [r1] is an invalid opcode
// ldrx r0, [r1] (S.two) cannot be converted
ldrb r0, [r1, #S.three]      /// 88 78
ldrx r0, [r1, #S.three]      /// 88 78
ldrb r0, [r1, r2]            /// 88 5c
ldrx r0, [r1, r2] (S.three)  /// 88 5c
ldrb r0, [r1]                /// 08 78
ldrx r0, [r1] (S.three)      /// 08 78

strb r0, [r1, #S.two]        /// 48 70
strx r0, [r1, #S.two]        /// 48 70
strb r0, [r1, r2]            /// 88 54
strx r0, [r1, r2] (S.two)    /// 88 54
strb r0, [r1]                /// 08 70
strx r0, [r1] (S.two)        /// 08 70
strb r0, [r1, #S.three]      /// 88 70
strx r0, [r1, #S.three]      /// 88 70
strb r0, [r1, r2]            /// 88 54
strx r0, [r1, r2] (S.three)  /// 88 54
strb r0, [r1]                /// 08 70
strx r0, [r1] (S.three)      /// 08 70
`,
    },
  });
}
