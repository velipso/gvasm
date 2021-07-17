//
// gvasm - Assembler and disassembler for Game Boy Advance homebrew
// by Sean Connelly (@velipso), https://sean.cm
// The Unlicense License
// Project Home: https://github.com/velipso/gvasm
//

import { ITest } from "../itest.ts";
import { version } from "../main.ts";

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

  def({
    name: "const.version",
    desc: "Constant $_version is defined",
    kind: "make",
    files: {
      "/root/main": `
/// ${(version & 0xff).toString(16)}
/// ${((version >> 8) & 0xff).toString(16)}
/// ${((version >> 16) & 0xff).toString(16)}
/// ${((version >> 24) & 0xff).toString(16)}
.i32 $_version
`,
    },
  });

  def({
    name: "const.arm-thumb",
    desc: "Constants $_arm and $_thumb are defined",
    kind: "make",
    files: {
      "/root/main": `
.arm
.i8 $_arm, $_thumb   /// 01 00
.thumb
.i8 $_arm, $_thumb   /// 00 01
.arm
.i8 $_arm, $_thumb   /// 01 00
.thumb
.i8 $_arm, $_thumb   /// 00 01
`,
    },
  });

  def({
    name: "const.here",
    desc: "Constant $_here is defined",
    kind: "make",
    files: {
      "/root/main": `
.i32 $_here  /// 00 00 00 08
.i32 $_here  /// 04 00 00 08
.i32 $_here  /// 08 00 00 08
.i8 0        /// 00
.i32 $_here  /// 0d 00 00 08
`,
    },
  });

  def({
    name: "const.pc",
    desc: "Constant $_pc is defined",
    kind: "make",
    files: {
      "/root/main": `
.i32 $_pc  /// 08 00 00 08
.i32 $_pc  /// 0c 00 00 08
.thumb
.i32 $_pc  /// 0c 00 00 08
.i32 $_pc  /// 10 00 00 08
`,
    },
  });

  def({
    name: "const.reserved-name",
    desc: "Prevent users from defining names starting with $_",
    kind: "make",
    error: true,
    files: {
      "/root/main": `.defx $_add($a, $b) = $a + $b`,
    },
  });

  def({
    name: "const.reserved-param",
    desc: "Prevent users from defining parameters starting with $_",
    kind: "make",
    error: true,
    files: {
      "/root/main": `.defx $add($_a, $b) = $_a + $b`,
    },
  });
}
