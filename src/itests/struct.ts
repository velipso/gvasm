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
}
