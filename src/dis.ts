//
// gbasm - Assembler and disassembler for Game Boy Advance homebrew
// by Sean Connelly (@velipso), https://sean.cm
// The Unlicense License
// Project Home: https://github.com/velipso/gbasm
//

import * as ops from "./ops.ts";

export interface IDisArgs {
  input: string;
  output?: string;
  format?: "gba" | "bin";
}

export async function dis(
  { input, output, format }: IDisArgs,
): Promise<number> {
  try {
    const data = await Deno.readFile(input).catch((e) => {
      console.error(`${e}\nFailed to read input file: ${input}`);
      throw e;
    });
    console.log(data);
    return 0;
  } catch (e) {
    return 1;
  }
}
