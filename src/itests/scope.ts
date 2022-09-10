//
// gvasm - Assembler and disassembler for Game Boy Advance homebrew
// by Sean Connelly (@velipso), https://sean.cm
// Project Home: https://github.com/velipso/gvasm
// SPDX-License-Identifier: 0BSD
//

import { ITest } from '../itest.ts';

export function load(def: (test: ITest) => void) {
  def({
    name: 'scope.const',
    desc: 'Scope usage with constants',
    kind: 'make',
    files: {
      '/root/main': `
.def one = 1
.i8 one           /// 01
.def two = 2
.i8 two           /// 02
.begin
  .i8 one         /// 01
  .def two = 3
  .i8 two         /// 03
  .begin
    .i8 one       /// 01
    .def two = 4
    .i8 two       /// 04
  .end
  .i8 two         /// 03
.end
.i8 two           /// 02
`,
    },
  });

  def({
    name: 'scope.const-lookup',
    desc: 'Constants are searched up the scope',
    kind: 'make',
    files: {
      '/root/main': `
.def one = 1
.i8 one         /// 01
.def two = 2
.i8 two         /// 02
.begin
  .i8 one       /// 01
  .def two = 3
  .i8 two       /// 03
  .begin
    .i8 one     /// 01
    .i8 two     /// 03
  .end
  .i8 two       /// 03
.end
.i8 two         /// 02
`,
    },
  });

  def({
    name: 'scope.missing-begin',
    desc: 'Error if too many .end statements',
    kind: 'make',
    error: true,
    files: {
      '/root/main': `
.begin
  .begin
  .end
  .begin
    .begin
    .end
  .end
.end
.end
`,
    },
  });

  def({
    name: 'scope.missing-end',
    desc: 'Error if too many .begin statements',
    kind: 'make',
    error: true,
    files: {
      '/root/main': `
.begin
  .begin
  .end
  .begin
    .begin
    .end
  .end
`,
    },
  });

  def({
    name: 'scope.late-label',
    desc: 'Late local labels should override higher scope labels',
    kind: 'make',
    files: {
      '/root/main': `
L:
.i32 L      /// 00 00 00 08
.begin
  .i32 L    /// 00 00 00 08
  .begin
    .i32 L  /// 0c 00 00 08
    L:
  .end
.end
`,
    },
  });

  def({
    name: 'scope.label',
    desc: 'Labels are strictly local to scope',
    kind: 'make',
    files: {
      '/root/main': `
L:
.i32 L      /// 00 00 00 08
.begin
  .i32 L    /// 14 00 00 08
  .begin
    .i32 L  /// 10 00 00 08
    .i32 1  /// 01 00 00 00
    L:
    .i32 2  /// 02 00 00 00
  .end
  L:
  .i32 3    /// 03 00 00 00
.end
.i32 L      /// 00 00 00 08
`,
    },
  });

  def({
    name: 'scope.arm-thumb',
    desc: '.arm and .thumb should be scoped',
    kind: 'make',
    files: {
      '/root/main': `.arm
.if _arm
  .i8 1      /// 01
.end

.begin
  .thumb
  .if _thumb
    .i8 2    /// 02
  .end

  .begin
    .if _thumb
      .i8 3  /// 03
    .end
    .arm
    .if _arm
      .i8 4  /// 04
    .end
  .end

  .if _thumb
    .i8 5    /// 05
  .end
.end

.if _arm
  .i8 6      /// 06
.end
`,
    },
  });

  def({
    name: 'scope.relative-minus',
    desc: 'Using - for anonymous backward labels',
    kind: 'make',
    files: {
      '/root/main': `.arm
    mov   r0, #0   /// 00 00 a0 e3
a:  add   r0, #1   /// 01 00 80 e2
    cmp   r0, #50  /// 32 00 50 e3
    blt   a        /// fc ff ff ba

    mov   r0, #0   /// 00 00 a0 e3
-   add   r0, #1   /// 01 00 80 e2
    cmp   r0, #50  /// 32 00 50 e3
    blt   -        /// fc ff ff ba

    mov   r0, #0   /// 00 00 a0 e3
--- add   r0, #1   /// 01 00 80 e2
    cmp   r0, #50  /// 32 00 50 e3
    blt   ---      /// fc ff ff ba

    mov   r0, #0   /// 00 00 a0 e3
-   add   r0, #1   /// 01 00 80 e2
    cmp   r0, #50  /// 32 00 50 e3
    blt   -        /// fc ff ff ba

    mov   r0, #0   /// 00 00 a0 e3
-   add   r0, #1   /// 01 00 80 e2
    cmp   r0, #50  /// 32 00 50 e3
    blt   -        /// fc ff ff ba

    mov   r0, #0   /// 00 00 a0 e3
-
    add   r0, #1   /// 01 00 80 e2
    cmp   r0, #50  /// 32 00 50 e3
    blt   -        /// fc ff ff ba
`,
    },
  });

  def({
    name: 'scope.relative-plus',
    desc: 'Using + for anonymous forward labels',
    kind: 'make',
    files: {
      '/root/main': `.arm
    cmp   r0, #50  /// 32 00 50 e3
    blt   a        /// 00 00 00 ba
    mov   r0, #0   /// 00 00 a0 e3
a:  add   r0, #1   /// 01 00 80 e2

    cmp   r0, #50  /// 32 00 50 e3
    blt   +        /// 00 00 00 ba
    mov   r0, #0   /// 00 00 a0 e3
+   add   r0, #1   /// 01 00 80 e2

    cmp   r0, #50  /// 32 00 50 e3
    blt   +++      /// 00 00 00 ba
    mov   r0, #0   /// 00 00 a0 e3
+++ add   r0, #1   /// 01 00 80 e2

    cmp   r0, #50  /// 32 00 50 e3
    blt   +        /// 00 00 00 ba
    mov   r0, #0   /// 00 00 a0 e3
+   add   r0, #1   /// 01 00 80 e2

    cmp   r0, #50  /// 32 00 50 e3
    blt   +        /// 00 00 00 ba
    mov   r0, #0   /// 00 00 a0 e3
+   add   r0, #1   /// 01 00 80 e2

    cmp   r0, #50  /// 32 00 50 e3
    blt   +        /// 00 00 00 ba
    mov   r0, #0   /// 00 00 a0 e3
+
    add   r0, #1   /// 01 00 80 e2
`,
    },
  });
}
