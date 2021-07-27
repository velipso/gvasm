//
// gvasm - Assembler and disassembler for Game Boy Advance homebrew
// by Sean Connelly (@velipso), https://sean.cm
// The Unlicense License
// Project Home: https://github.com/velipso/gvasm
//

import { fileExists } from "./deps.ts";

export interface IInitArgs {
  output: string;
  title: string;
  initials: string;
  maker: string;
  version: number;
  region: string;
  code: string;
  overwrite: boolean;
}

export function generateInit(args: IInitArgs): string {
  const { title, initials, maker, version, region, code } = args;

  return `// ${title} v${version}

// include standard library for useful constants
.stdlib

// GBA header
b @main
.logo
.title "${title}"
.i8 "${code}${initials}${region}${maker}"
.i16 150, 0, 0, 0, 0
.i8 ${version} // version
.crc
.i16 0

@main:

// Your game here!

// For example, this will set the display to blueish green:

// set REG_DISPCNT to 0
ldr r0, =$REG_DISPCNT
ldrh r1, =0
strh r1, [r0]

// set color 0 to blueish green
ldr r0, =0x05000000
ldrh r1, =rgb(0, 31, 15)
strh r1, [r0]

// infinite loop
@loop: b @loop

.pool
`;
}

export async function init(args: IInitArgs): Promise<number> {
  const { output, title, initials, maker, version, region, code, overwrite } =
    args;
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

    if (!overwrite && await fileExists(output)) {
      console.error(`Output file already exists, cannot overwrite: ${output}
Pass --overwrite to stomp the file anyways`);
      throw false;
    }

    await Deno.writeTextFile(
      output,
      generateInit(args),
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
