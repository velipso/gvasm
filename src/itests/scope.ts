//
// gvasm - Assembler and disassembler for Game Boy Advance homebrew
// by Sean Connelly (@velipso), https://sean.cm
// The Unlicense License
// Project Home: https://github.com/velipso/gvasm
//

import { ITest } from '../itest.ts';

export function load(def: (test: ITest) => void) {
  def({
    name: 'scope.const',
    desc: 'Scope usage with constants',
    kind: 'make',
    files: {
      '/root/main': `
.def $one = 1
.i8 $one             /// 01
.def $$two = 2
.i8 $$two            /// 02
.begin
  .i8 $one           /// 01
  .def $$two = 3
  .i8 $$two          /// 03
  .begin
    .i8 $one         /// 01
    .def $$two = 4
    .i8 $$two        /// 04
  .end
  .i8 $$two          /// 03
.end
.i8 $$two            /// 02
`,
    },
  });

  def({
    name: 'scope.missing-const',
    desc: 'Constants are strictly local to scope',
    kind: 'make',
    error: true,
    files: {
      '/root/main': `
.def $one = 1
.i8 $one
.def $$two = 2
.i8 $$two
.begin
  .i8 $one
  .def $$two = 3
  .i8 $$two
  .begin
    .i8 $one
    .i8 $$two
  .end
  .i8 $$two
.end
.i8 $$two
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
    name: 'scope.missing-label',
    desc: 'Local labels must exist at scope level',
    kind: 'make',
    error: true,
    files: {
      '/root/main': `
@@L:
.i32 @@L
.begin
  .i32 @@L
  .begin
    .i32 @@L
    @@L:
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
@@L:
.i32 @@L      /// 00 00 00 08
.begin
  .i32 @@L    /// 14 00 00 08
  .begin
    .i32 @@L  /// 10 00 00 08
    .i32 1    /// 01 00 00 00
    @@L:
    .i32 2    /// 02 00 00 00
  .end
  @@L:
  .i32 3      /// 03 00 00 00
.end
.i32 @@L      /// 00 00 00 08
`,
    },
  });

  def({
    name: 'scope.arm-thumb',
    desc: '.arm and .thumb should be scoped',
    kind: 'make',
    files: {
      '/root/main': `
.if $_arm
  .i32 1 /// 01 00 00 00
.end

.begin
  .thumb
  .if $_thumb
    .i32 2 /// 02 00 00 00
  .end

  .begin
    .if $_thumb
      .i32 3 /// 03 00 00 00
    .end
    .arm
    .if $_arm
      .i32 4 /// 04 00 00 00
    .end
  .end

  .if $_thumb
    .i16 5 /// 05 00
  .end
.end /// 00 00

.if $_arm
  .i32 6 /// 06 00 00 00
.end
`,
    },
  });

  def({
    name: 'scope.once',
    desc: 'Use .once to skip previously included code',
    kind: 'make',
    stdout: [
      'inside test',
      'first',
      'inside test',
      'not first',
      'inside test',
      'not first',
    ],
    files: {
      '/root/main': `
.include "test"
.include "test"
.include "test"
`,
      '/root/test': `
.printf "inside test"
.once
  .printf "first"
.else
  .printf "not first"
.end
`,
    },
  });

  def({
    name: 'scope.relative-minus',
    desc: 'Using - for anonymous backward labels',
    kind: 'make',
    files: {
      '/root/main': `
    mov   r0, #0   /// 00 00 a0 e3
@a: add   r0, #1   /// 01 00 80 e2
    cmp   r0, #50  /// 32 00 50 e3
    blt   @a       /// fc ff ff ba

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
      '/root/main': `
    cmp   r0, #50  /// 32 00 50 e3
    blt   @a       /// 00 00 00 ba
    mov   r0, #0   /// 00 00 a0 e3
@a: add   r0, #1   /// 01 00 80 e2

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
