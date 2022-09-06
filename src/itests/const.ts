//
// gvasm - Assembler and disassembler for Game Boy Advance homebrew
// by Sean Connelly (@velipso), https://sean.cm
// Project Home: https://github.com/velipso/gvasm
// SPDX-License-Identifier: 0BSD
//

import { ITest } from '../itest.ts';
import { version } from '../main.ts';

export function load(def: (test: ITest) => void) {
  def({
    name: 'const.basic',
    desc: 'Basic constant usage',
    kind: 'make',
    files: {
      '/root/main': `
.def FOO = 1
.def BAR = 2
.i8 FOO        /// 01
.i8 FOO + BAR  /// 03
`,
    },
  });

  def({
    name: 'const.case-sensitive',
    desc: 'Case-sensitive identifiers',
    kind: 'make',
    files: {
      '/root/main': `
.def f(a, b) = a + b
.def F(a, b) = a - b
.i8 f(5, 3)  /// 08
.i8 F(5, 3)  /// 02
`,
    },
  });

  def({
    name: 'const.parameters',
    desc: 'Constant with parameters',
    kind: 'make',
    files: {
      '/root/main': `
.def one       = 1
.def five      = 5
.def neg(a)    = -a
.def add(a, b) = a + b
.i8 neg(-5)                              /// 05
.i8 add(1, 2)                            /// 03
.i8 neg(one)                             /// ff
.i8 add(one, 2)                          /// 03
.i8 add(1, five)                         /// 06
.i8 add(five, neg(one))                  /// 04
.i8 add(neg(neg(five)), neg(neg(five)))  /// 0a
`,
    },
  });

  def({
    name: 'const.no-parameters',
    desc: 'Constant with no parameters',
    kind: 'make',
    error: true,
    files: {
      '/root/main': `
.def add(a, b) = a + b
.i8 add
`,
    },
  });

  def({
    name: 'const.missing-parameters',
    desc: 'Constant with missing parameters',
    kind: 'make',
    error: true,
    files: {
      '/root/main': `
.def add(a, b) = a + b
.i8 add(1)
`,
    },
  });

  def({
    name: 'const.extra-parameters',
    desc: 'Constant with extra parameters',
    kind: 'make',
    error: true,
    files: {
      '/root/main': `
.def add(a, b) = a + b
.i8 add(1, 2, 3)
`,
    },
  });

  def({
    name: 'const.label',
    desc: 'Constant dependent on label rewrites',
    kind: 'make',
    files: {
      '/root/main': `
.base 0
zero:
.i8 1                   /// 01
one:
.im16 1                 /// 01 00
three:

.def add(a, b) = a + b
.i8 add(one, three)     /// 04
.i8 add(one, six)       /// 07
.i8 1                   /// 01
six:

.def a10(a) = a + ten
.i8 a10(1)              /// 0b
.i8 a10(a10(5))         /// 19
.i8 add(a10(2), 1)      /// 0d
.i8                 \\
  a10(              \\
    add(            \\
      a10(          \\
        add(        \\
          a10(-4),  \\
          a10(4)    \\
        )           \\
      ),            \\
      a10(-8)       \\
    )               \\
  )                     /// 2a

ten:

.def b10(a) = a + ten
.i8 b10(1)              /// 0b
.i8 b10(b10(5))         /// 19
.i8 add(b10(2), 1)      /// 0d
.i8                 \\
  b10(              \\
    add(            \\
      b10(          \\
        add(        \\
          b10(-4),  \\
          b10(4)    \\
        )           \\
      ),            \\
      b10(-8)       \\
    )               \\
  )                     /// 2a
`,
    },
  });

  def({
    name: 'const.version',
    desc: 'Constant _version is defined',
    kind: 'make',
    files: {
      '/root/main': `
/// ${(version & 0xff).toString(16)}
/// ${((version >> 8) & 0xff).toString(16)}
/// ${((version >> 16) & 0xff).toString(16)}
/// ${((version >> 24) & 0xff).toString(16)}
.i32 _version
`,
    },
  });

  def({
    name: 'const.arm-thumb',
    desc: 'Constants _arm and _thumb are defined',
    kind: 'make',
    files: {
      '/root/main': `
.arm
.i8 _arm, _thumb  /// 01 00
.thumb
.i8 _arm, _thumb  /// 00 01
.arm
.i8 _arm, _thumb  /// 01 00
.thumb
.i8 _arm, _thumb  /// 00 01
.def thumb = _thumb
.arm
.i8 thumb         /// 01
`,
    },
  });

  /* TODO: if
  def({
    name: 'const.main',
    desc: 'Constant _main is defined',
    kind: 'make',
    files: {
      '/root/main': `
.if $_main
  .i8 1          /// 01
  .script
    put '.i8 2'  /// 02
  .end
  .include "one" /// 03 04
.else
  .script
    put '.i8 5'  /// 05
  .end
  .include "two" /// 06 07
.end
`,
      '/root/one': `
.if $_main
  .i8 99
.else
  .i8 3
  .script
    put '.i8 4'
  .end
  .include "main"
.end
`,
      '/root/two': `
.if $_main
  .i8 99
.else
  .i8 6
  .script
    put '.i8 7'
  .end
.end
`,
    },
  }); */

  def({
    name: 'const.here',
    desc: 'Constant _here is defined',
    kind: 'make',
    files: {
      '/root/main': `
.im32 _here  /// 00 00 00 08
.im32 _here  /// 04 00 00 08
.im32 _here  /// 08 00 00 08
.im8 0       /// 00
.im32 _here  /// 0d 00 00 08
`,
    },
  });

  def({
    name: 'const.pc',
    desc: 'Constant _pc is defined',
    kind: 'make',
    files: {
      '/root/main': `.arm
.i32 _pc  /// 08 00 00 08
.i32 _pc  /// 0c 00 00 08
.thumb
.i32 _pc  /// 0c 00 00 08
.i32 _pc  /// 10 00 00 08
`,
    },
  });

  def({
    name: 'const.base',
    desc: 'Constant _base is defined',
    kind: 'make',
    files: {
      '/root/main': `
.base 0x04000000
.i32 _base  /// 00 00 00 04
`,
    },
  });

  def({
    name: 'const.bytes',
    desc: 'Constant _bytes is defined',
    kind: 'make',
    files: {
      '/root/main': `
.base 0x04000000
.i32 _base   /// 00 00 00 04
.i32 _bytes  /// 04 00 00 00
`,
    },
  });

  def({
    name: 'const.reserved-name',
    desc: 'Prevent users from defining names starting with _',
    kind: 'make',
    error: true,
    files: {
      '/root/main': `.def _add(a, b) = a + b`,
    },
  });

  def({
    name: 'const.reserved-param',
    desc: 'Prevent users from defining parameters starting with _',
    kind: 'make',
    error: true,
    files: {
      '/root/main': `.def add(_a, b) = _a + b`,
    },
  });
}
