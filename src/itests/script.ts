//
// gvasm - Assembler and disassembler for Game Boy Advance homebrew
// by Sean Connelly (@velipso), https://sean.cm
// The Unlicense License
// Project Home: https://github.com/velipso/gvasm
//

import { ITest } from "../itest.ts";

export function load(def: (test: ITest) => void) {
  def({
    name: "script.i8",
    desc: "Use .i8 command inside .script",
    kind: "make",
    files: {
      "/root/main": `
.script
  for: range 5
    put '.i8 0, 1, 2, 3'
  end
  /// 00 01 02 03
  /// 00 01 02 03
  /// 00 01 02 03
  /// 00 01 02 03
  /// 00 01 02 03
.end
`,
    },
  });

  def({
    name: "script.if",
    desc: "Wrap .script in .if",
    kind: "make",
    files: {
      "/root/main": `
.if 0
  .script
    for: range 5
      put '.i8 0, 1, 2, 3'
    end
  .end
.else
  .i8 5 /// 05
.end
`,
    },
  });

  def({
    name: "script.missing-end",
    desc: "Forget to close .script with .end",
    kind: "make",
    error: true,
    files: {
      "/root/main": `
.script
put '.i8 0'
`,
    },
  });

  def({
    name: "script.bad-comment",
    desc: "Forget to close block comment in .script",
    kind: "make",
    error: true,
    files: {
      "/root/main": `
.script
/*
.end
.i8 5
// */
.end
`,
    },
  });

  def({
    name: "script.include",
    desc: "Use include inside .script",
    kind: "make",
    rawInclude: true,
    files: {
      "/root/main": `
.script
include "common.sink" /// 05 06
include "common.sink" /// 05 06
include "../one.sink" /// 01 02
.end
`,
      "/root/common.sink": `put '.i8 5, 6'`,
      "/one.sink": `put '.i8 1, 2'`,
    },
  });
}
