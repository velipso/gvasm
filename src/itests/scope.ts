//
// gvasm - Assembler and disassembler for Game Boy Advance homebrew
// by Sean Connelly (@velipso), https://sean.cm
// The Unlicense License
// Project Home: https://github.com/velipso/gvasm
//

import { ITest } from "../itest.ts";

export function load(def: (test: ITest) => void) {
  def({
    name: "scope.const",
    desc: "Scope usage with constants",
    kind: "make",
    files: {
      "/root/main": `
.defx $one = 1
.i8 $one             /// 01
.defx $$two = 2
.i8 $$two            /// 02
.begin
  .i8 $one           /// 01
  .defx $$two = 3
  .i8 $$two          /// 03
  .begin
    .i8 $one         /// 01
    .defx $$two = 4
    .i8 $$two        /// 04
  .end
  .i8 $$two          /// 03
.end
.i8 $$two            /// 02
`,
    },
  });

  def({
    name: "scope.missing-const",
    desc: "Constants are strictly local to scope",
    kind: "make",
    error: true,
    files: {
      "/root/main": `
.defx $one = 1
.i8 $one
.defx $$two = 2
.i8 $$two
.begin
  .i8 $one
  .defx $$two = 3
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
    name: "scope.missing-begin",
    desc: "Error if too many .end statements",
    kind: "make",
    error: true,
    files: {
      "/root/main": `
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
    name: "scope.missing-end",
    desc: "Error if too many .begin statements",
    kind: "make",
    error: true,
    files: {
      "/root/main": `
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
    name: "scope.missing-label",
    desc: "Local labels must exist at scope level",
    kind: "make",
    error: true,
    files: {
      "/root/main": `
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
    name: "scope.label",
    desc: "Labels are strictly local to scope",
    kind: "make",
    files: {
      "/root/main": `
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
}
