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

  def({
    name: "script.end-comments",
    desc: "Comments at .end should work",
    kind: "make",
    files: {
      "/root/main": `
.script
  put '.i8 0, 1, 2, 3'
  /// 00 01 02 03
.end // end
.script
  put '.i8 4, 5, 6, 7'
  /// 04 05 06 07
.end /* end
*/
.script
  put '.i8 8, 9, 10, 11'
  /// 08 09 0a 0b
.end /* end */
`,
    },
  });

  def({
    name: "script.store",
    desc: "Store values between scripts",
    kind: "make",
    files: {
      "/root/main": `
.script
  var x = 1
  store.set 'x', {2}
.end
.script
  var x = 3
  put ".i8 \${store.has 'x'}, \${(store.get 'x')[0]}" /// 01 02
.end
`,
    },
  });

  def({
    name: "script.image.load",
    desc: "Load images",
    kind: "make",
    stdout: [
      "{{{0, 0, 0, 255}, {255, 255, 255, 255}, {0, 0, 0, 0}}, " +
      "{{255, 0, 0, 255}, {0, 255, 0, 255}, {0, 0, 255, 255}}, " +
      "{{69, 103, 137, 255}, {76, 59, 42, 127}, {0, 0, 0, 1}}}",
      "{{{0, 0, 0, 255}, {255, 255, 255, 255}, {0, 0, 0, 0}}, " +
      "{{255, 0, 0, 255}, {0, 255, 0, 255}, {0, 0, 255, 255}}, " +
      "{{69, 103, 137, 255}, {76, 59, 42, 127}, {0, 0, 0, 1}}}",
    ],
    files: {
      "/root/main": `
.script
  var png = { // raw png data
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x03, 0x00, 0x00, 0x00, 0x03, 0x08, 0x06, 0x00, 0x00, 0x00, 0x56, 0x28, 0xb5,
    0xbf, 0x00, 0x00, 0x00, 0x2d, 0x49, 0x44, 0x41, 0x54, 0x08, 0x99, 0x05, 0xc1, 0x41, 0x01, 0x40,
    0x00, 0x14, 0x40, 0xb1, 0x7d, 0x0d, 0x64, 0x91, 0x41, 0x03, 0x32, 0x68, 0xe0, 0xea, 0xac, 0x81,
    0xb6, 0xcf, 0x06, 0x55, 0xc1, 0x12, 0xc6, 0xa0, 0xec, 0xd7, 0xdb, 0x77, 0x1f, 0xcf, 0xb9, 0xad,
    0xf3, 0x03, 0xff, 0x1f, 0x0c, 0xac, 0x55, 0x57, 0x90, 0x28, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45,
    0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
  }
  say image.load png // load as array of numbers
  say image.load list.str png // load as byte string
.end
`,
    },
  });

  def({
    name: "script.image.load-fail",
    desc: "Fail to load image",
    kind: "make",
    error: true,
    files: {
      "/root/main": `
.script
  image.load {'one', 'two'}
.end
`,
    },
  });
}
