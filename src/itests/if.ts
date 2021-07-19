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
.endif
.if 0
  .printf "hello"
.endif
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
  .endif
.elseif 0
  .if 0
    .printf "fail"
  .elseif 1
    .if 1
      .printf "fail"
    .endif
  .endif
.else
  .if 0
    .printf "fail"
  .elseif 0
    .if 1
      .printf "fail"
    .else
      .printf "fail"
    .endif
  .elseif 1
    .if 1
      .if 1
        .if 0
          .printf "fail"
        .else
          .printf "pass"
        .endif
      .else
        .printf "fail"
      .endif
    .elseif 1
      .printf "fail"
    .else
      .printf "fail"
    .endif
  .elseif 1
    .printf "fail"
  .endif
.endif
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
@L0:   .endif
@L0: .elseif 0
@L0:   .if 0
@L0:     .printf "fail"
@L0:   .elseif 1
@L0:     .if 1
@L0:       .printf "fail"
@L0:     .endif
@L0:   .endif
@L0: .else
@L1:   .if 0
@L0:     .printf "fail"
@L0:   .elseif 0
@L0:     .if 1
@L0:       .printf "fail"
@L0:     .else
@L0:       .printf "fail"
@L0:     .endif
@L0:   .elseif 1
@L2:     .if 1
@L3:       .if 1
@L4:         .if 0
@L0:           .printf "fail"
@L0:         .else
@L5:           .printf "pass"
@L6:         .endif
@L7:       .else
@L0:         .printf "fail"
@L0:       .endif
@L8:     .elseif 1
@L0:       .printf "fail"
@L0:     .else
@L0:       .printf "fail"
@L0:     .endif
@L9:   .elseif 1
@L0:     .printf "fail"
@L0:   .endif
@La: .endif
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
.endif

.if 0
  .include "fail"
.elseif 0
  .include "fail"
.elseif 1
  .include "pass"
.else
  .include "fail"
.endif

.if 0
  .include "fail"
.elseif 1
  .include "pass"
.elseif 0
  .include "fail"
.else
  .include "fail"
.endif

.if 1
  .include "pass"
.elseif 0
  .include "fail"
.elseif 0
  .include "fail"
.else
  .include "fail"
.endif
`,
      "/root/pass": `.printf "pass"`,
    },
  });
}
