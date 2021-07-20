//
// gvasm - Assembler and disassembler for Game Boy Advance homebrew
// by Sean Connelly (@velipso), https://sean.cm
// The Unlicense License
// Project Home: https://github.com/velipso/gvasm
//

import { ITest } from "../itest.ts";

export function load(def: (test: ITest) => void) {
  def({
    name: "if.basic",
    desc: "Basic usage of .if",
    kind: "make",
    stdout: ["hi"],
    files: {
      "/root/main": `
.if 1
  .printf "hi"
.end
.if 0
  .printf "hello"
.end
`,
    },
  });

  def({
    name: "if.nested",
    desc: "Nested .if statements",
    kind: "make",
    stdout: ["pass"],
    files: {
      "/root/main": `
.if 0
  .if 0
    .printf "fail"
  .else
    .printf "fail"
  .end
.elseif 0
  .if 0
    .printf "fail"
  .elseif 1
    .if 1
      .printf "fail"
    .end
  .end
.else
  .if 0
    .printf "fail"
  .elseif 0
    .if 1
      .printf "fail"
    .else
      .printf "fail"
    .end
  .elseif 1
    .if 1
      .if 1
        .if 0
          .printf "fail"
        .else
          .printf "pass"
        .end
      .else
        .printf "fail"
      .end
    .elseif 1
      .printf "fail"
    .else
      .printf "fail"
    .end
  .elseif 1
    .printf "fail"
  .end
.end
`,
    },
  });

  def({
    name: "if.label",
    desc: "Labeled .if statements",
    kind: "make",
    stdout: ["pass"],
    files: {
      "/root/main": `
@L0: .if 0
@L0:   .if 0
@L0:     .printf "fail"
@L0:   .else
@L0:     .printf "fail"
@L0:   .end
@L0: .elseif 0
@L0:   .if 0
@L0:     .printf "fail"
@L0:   .elseif 1
@L0:     .if 1
@L0:       .printf "fail"
@L0:     .end
@L0:   .end
@L0: .else
@L1:   .if 0
@L0:     .printf "fail"
@L0:   .elseif 0
@L0:     .if 1
@L0:       .printf "fail"
@L0:     .else
@L0:       .printf "fail"
@L0:     .end
@L0:   .elseif 1
@L2:     .if 1
@L3:       .if 1
@L4:         .if 0
@L0:           .printf "fail"
@L0:         .else
@L5:           .printf "pass"
@L6:         .end
@L7:       .else
@L0:         .printf "fail"
@L0:       .end
@L8:     .elseif 1
@L0:       .printf "fail"
@L0:     .else
@L0:       .printf "fail"
@L0:     .end
@L9:   .elseif 1
@L0:     .printf "fail"
@L0:   .end
@La: .end
`,
    },
  });

  def({
    name: "if.include",
    desc: "Use .include inside .if statements",
    kind: "make",
    stdout: ["pass", "pass", "pass", "pass"],
    files: {
      "/root/main": `
.if 0
  .include "fail"
.elseif 0
  .include "fail"
.elseif 0
  .include "fail"
.else
  .include "pass"
.end

.if 0
  .include "fail"
.elseif 0
  .include "fail"
.elseif 1
  .include "pass"
.else
  .include "fail"
.end

.if 0
  .include "fail"
.elseif 1
  .include "pass"
.elseif 0
  .include "fail"
.else
  .include "fail"
.end

.if 1
  .include "pass"
.elseif 0
  .include "fail"
.elseif 0
  .include "fail"
.else
  .include "fail"
.end
`,
      "/root/pass": `.printf "pass"`,
    },
  });

  def({
    name: "if.ignore-errors",
    desc: "Ignore errors inside .if 0",
    kind: "make",
    files: {
      "/root/main": `
.if 0
asdf
hello world
"what's up"
@asdf
@@@@asdf:
.asdf
$$$$
.end
`,
    },
  });
}
