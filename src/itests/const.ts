//
// gvasm - Assembler and disassembler for Game Boy Advance homebrew
// by Sean Connelly (@velipso), https://sean.cm
// The Unlicense License
// Project Home: https://github.com/velipso/gvasm
//

import { ITest } from "../itest.ts";

export function load(def: (test: ITest) => void) {
  def({
    name: "const.basic",
    desc: "Basic constant usage",
    kind: "make",
    files: {
      "/root/main": `
.defx $FOO = 1
.defx $BAR = 2
.i8 $foo         /// 01
.i8 $foo + $bar  /// 03
`,
    },
  });

  def({
    name: "const.parameters",
    desc: "Constant with parameters",
    kind: "make",
    files: {
      "/root/main": `
.defx $one         = 1
.defx $five        = 5
.defx $neg($a)     = -$a
.defx $add($a, $b) = $a + $b
.i8 $neg(-5)                                    /// 05
.i8 $add(1, 2)                                  /// 03
.i8 $neg($one)                                  /// ff
.i8 $add($one, 2)                               /// 03
.i8 $add(1, $five)                              /// 06
.i8 $add($five, $neg($one))                     /// 04
.i8 $add($neg($neg($five)), $neg($neg($five)))  /// 0a
`,
    },
  });

  def({
    name: "const.no-parameters",
    desc: "Constant with no parameters",
    kind: "make",
    error: true,
    files: {
      "/root/main": `
.defx $add($a, $b) = $a + $b
.i8 $add
`,
    },
  });

  def({
    name: "const.missing-parameters",
    desc: "Constant with missing parameters",
    kind: "make",
    error: true,
    files: {
      "/root/main": `
.defx $add($a, $b) = $a + $b
.i8 $add(1)
`,
    },
  });

  def({
    name: "const.extra-parameters",
    desc: "Constant with extra parameters",
    kind: "make",
    error: true,
    files: {
      "/root/main": `
.defx $add($a, $b) = $a + $b
.i8 $add(1, 2, 3)
`,
    },
  });

  def({
    name: "const.label",
    desc: "Constant dependent on label rewrites",
    kind: "make",
    files: {
      "/root/main": `
.base 0
@zero:
.i8 1                    /// 01
@one:
.i16 1                   /// 01 00
@three:

.defx $add($a, $b) = $a + $b
.i8 $add(@one, @three)   /// 04
.i8 $add(@one, @six)     /// 07
.i8 1                    /// 01
@six:

.defx $a10($a) = $a + @ten
.i8 $a10(1)              /// 0b
.i8 $a10($a10(5))        /// 19
.i8 $add($a10(2), 1)     /// 0d
.i8                 \\
  $a10(             \\
    $add(           \\
      $a10(         \\
        $add(       \\
          $a10(-4), \\
          $a10(4)   \\
        )           \\
      ),            \\
      $a10(-8)      \\
    )               \\
  )                      /// 2a

@ten:

.defx $b10($a) = $a + @ten
.i8 $b10(1)              /// 0b
.i8 $b10($b10(5))        /// 19
.i8 $add($b10(2), 1)     /// 0d
.i8                 \\
  $b10(             \\
    $add(           \\
      $b10(         \\
        $add(       \\
          $b10(-4), \\
          $b10(4)   \\
        )           \\
      ),            \\
      $b10(-8)      \\
    )               \\
  )                      /// 2a
`,
    },
  });
}
