//
// gbasm - Assembler and disassembler for Game Boy Advance homebrew
// by Sean Connelly (@velipso), https://sean.cm
// The Unlicense License
// Project Home: https://github.com/velipso/gbasm
//

export interface IInitArgs {
  output: string;
  title: string;
  initials: string;
  maker: string;
  version: number;
  region: string;
  code: string;
}

export async function init(
  { output, title, initials, maker, version, region, code }: IInitArgs,
): Promise<number> {
  try {
    const checkSize = (
      hint: string,
      str: string,
      low: number,
      high: number,
    ) => {
      const size = new TextEncoder().encode(str).length;
      if (size < low || size > high) {
        const ch = `character${high === 1 ? "" : "s"}`;
        if (low === high) {
          console.error(
            `Invalid ${hint}, must be ${high} ${ch}, but got: "${str}"`,
          );
        } else if (low === 0) {
          console.error(
            `Invalid ${hint}, must be at most ${high} ${ch}, but got: "${str}"`,
          );
        } else {
          console.error(
            `Invalid ${hint}, must be ${low}-${high} ${ch}, but got: "${str}"`,
          );
        }
        throw false;
      }
    };
    checkSize("title", title, 0, 12);
    checkSize("initials", initials, 2, 2);
    checkSize("maker", maker, 2, 2);
    if (
      isNaN(version) || Math.floor(version) !== version || version < 0 ||
      version > 255
    ) {
      console.error(`Invalid version, must be 0..255, but got: ${version}`);
      throw false;
    }
    checkSize("region", region, 1, 1);
    checkSize("code", code, 1, 1);

    // TODO: use .stdlib and then use REG_DISPCNT instead of 0x04000000, etc
    await Deno.writeTextFile(
      output,
      `// ${title} v${version}

// GBA header
b @main
.logo
.title "${title}"
.u8 "${code}${initials}${region}${maker}"
.u16 150, 0, 0, 0, 0
.u8 ${version} // version
.crc
.u16 0

@main:

// Your game here!

// For example, this will set the display red:

// set REG_DISPCNT to 0
mov r0, #0x04000000
mov r1, #0x0
str r1, [r0]

// set color 0 to green
mov r0, #0x05000000
mov r1, #0x3e0
str r1, [r0]

// infinite loop
@loop: b @loop
`,
    ).catch((e) => {
      console.error(`${e}\nFailed to write output file: ${output}`);
      throw false;
    });
    return 0;
  } catch (e) {
    if (e !== false) {
      console.error(`${e}\nUnknown fatal error`);
    }
    return 1;
  }
}
