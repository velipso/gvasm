//
// gvasm - Assembler and disassembler for Game Boy Advance homebrew
// by Sean Connelly (@velipso), https://sean.cm
// The Unlicense License
// Project Home: https://github.com/velipso/gvasm
//

import { ITest } from "../itest.ts";

export function load(def: (test: ITest) => void) {
  def({
    name: "files.include-basic",
    desc: "Include another file",
    kind: "make",
    files: {
      "/root/main": `
.i32 0            /// 00 00 00 00
.include "hello"  /// 01 00 00 00
.i32 -1           /// ff ff ff ff
`,
      "/root/hello": `.i32 1`,
    },
  });

  def({
    name: "files.include-multiple",
    desc: "Include another file multiple times",
    kind: "make",
    files: {
      "/root/main": `
.i32 0            /// 00 00 00 00
.include "hello"  /// 01 00 00 00
.include "hello"  /// 01 00 00 00
.include "hello"  /// 01 00 00 00
.i32 -1           /// ff ff ff ff
`,
      "/root/hello": `.i32 1`,
    },
  });

  def({
    name: "files.include-relative",
    desc: "Include files relative to included file",
    kind: "make",
    files: {
      "/root/main": `
.i32 0           /// 00 00 00 00
.include "../test/hello"
/// 01 00 00 00
/// 03 00 00 00
/// 02 00 00 00
.i32 -1          /// ff ff ff ff
`,
      "/test/hello": `
.i32 1
.include "world"
.i32 2
`,
      "/test/world": `.i32 3`,
      "/root/world": `.error "Wrong"`,
    },
  });

  def({
    name: "files.include-subdir",
    desc: "Include files in subdirectory",
    kind: "make",
    files: {
      "/root/main": `
.i32 0           /// 00 00 00 00
.include "one/hello"
/// 01 00 00 00
/// 02 00 00 00
/// 03 00 00 00
.i32 -1          /// ff ff ff ff
`,
      "/root/one/hello": `
.i32 1
.include "./two/another"
`,
      "/root/one/two/another": `
.i32 2
.include "../../onemore"
`,
      "/root/onemore": `.i32 3`,
    },
  });

  def({
    name: "files.include-error",
    desc: "Include a missing file",
    kind: "make",
    error: true,
    files: {
      "/root/main": `
.i32 0
.include "hello"
.i32 -1
`,
    },
  });

  def({
    name: "files.include-circular",
    desc: "Include circular files",
    kind: "make",
    error: true,
    files: {
      "/root/main": `.include "cir0"`,
      "/root/cir0": `.include "cir1"`,
      "/root/cir1": `.include "cir2"`,
      "/root/cir2": `.include "cir3"`,
      "/root/cir3": `.include "cir4"`,
      "/root/cir4": `.include "cir5"`,
      "/root/cir5": `.include "cir6"`,
      "/root/cir6": `.include "cir7"`,
      "/root/cir7": `.include "cir0"`,
    },
  });

  def({
    name: "files.include-self",
    desc: "Include main file from main file",
    kind: "make",
    error: true,
    files: {
      "/root/main": `.include "main"`,
    },
  });

  def({
    name: "files.embed-basic",
    desc: "Embed another file",
    kind: "make",
    files: {
      "/root/main": `
.i32 0          /// 00 00 00 00
.embed "hello"  /// 12 34 56 78
.i32 -1         /// ff ff ff ff
`,
      "/root/hello": `/// 12 34 56 78`,
    },
  });

  def({
    name: "files.embed-multiple",
    desc: "Embed another file multiple times",
    kind: "make",
    files: {
      "/root/main": `
.i32 0          /// 00 00 00 00
.embed "hello"  /// 12 34 56 78
.embed "hello"  /// 12 34 56 78
.embed "hello"  /// 12 34 56 78
.i32 -1         /// ff ff ff ff
`,
      "/root/hello": `/// 12 34 56 78`,
    },
  });

  def({
    name: "files.embed-relative",
    desc: "Embed files relative to included file",
    kind: "make",
    files: {
      "/root/main": `
.i32 0           /// 00 00 00 00
.include "../test/hello"
/// 01 00 00 00
/// 12 34 56 78
/// 02 00 00 00
.i32 -1          /// ff ff ff ff
`,
      "/test/hello": `
.i32 1
.embed "world"
.i32 2
`,
      "/test/world": `/// 12 34 56 78`,
      "/root/world": `/// 00 00 00 00`,
    },
  });

  def({
    name: "files.embed-subdir",
    desc: "Embed files in subdirectory",
    kind: "make",
    files: {
      "/root/main": `
.i32 0           /// 00 00 00 00
.include "one/hello"
/// 01 00 00 00
/// 02 00 00 00
/// 12 34 56 78
.i32 -1          /// ff ff ff ff
`,
      "/root/one/hello": `
.i32 1
.include "./two/another"
`,
      "/root/one/two/another": `
.i32 2
.embed "../../onemore"
`,
      "/root/onemore": `/// 12 34 56 78`,
    },
  });

  def({
    name: "files.embed-error",
    desc: "Embed a missing file",
    kind: "make",
    error: true,
    files: {
      "/root/main": `
.i32 0
.embed "hello"
.i32 -1
`,
    },
  });
}
