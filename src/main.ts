//
// gbasm - Assembler and disassembler for Game Boy Advance homebrew
// by Sean Connelly (@velipso), https://sean.cm
// The Unlicense License
// Project Home: https://github.com/velipso/gbasm
//

import { init } from "./init.ts";
import { make } from "./make.ts";
import { dis, IDisArgs } from "./dis.ts";

function printVersion() {
  console.log(`gbasm - Assembler and disassembler for Game Boy Advance homebrew
by Sean Connelly (@velipso), https://sean.cm
The Unlicense License
Project Home: https://github.com/velipso/gbasm
Version: 0.1`);
}

function printHelp() {
  console.log(`gbasm <command> [...args]

Command Summary:
  init      Create a skeleton project
  make      Compile a project into a .gba file
  dis       Disassemble a .gba file into a source

For more help, try:
  gbasm <command> --help`);
}

function printDisHelp() {
  console.log(`gbasm dis <input> [-o <output>] [-f <format>]

<input>      The input .gba or .bin file
-o <output>  The output file (default: input with .gbasm extension)
-f <format>  The input format (default: autodetect from extension)

Formats:
-f gba       Input is a .gba file
-f bin       Input is a .bin file (typically for BIOS)`);
}

export function parseDisArgs(args: string[]): number | IDisArgs {
  if (args.length <= 0 || args[0] === "-h" || args[0] === "--help") {
    printDisHelp();
    return 0;
  }

  let input: string | undefined;
  let output: string | undefined;
  let format: "gba" | "bin" | undefined;
  for (let i = 0; i < args.length; i++) {
    let arg = args[i];
    if (arg === "-o" || arg === "--output") {
      if (i + 1 >= args.length) {
        console.error("Missing output file");
        return 1;
      }
      if (output !== undefined) {
        console.error("Cannot specify output file more than once");
        return 1;
      }
      i++;
      output = args[i];
    } else if (arg === "-f" || arg === "--format") {
      if (i + 1 >= args.length) {
        console.error("Missing file format");
        return 1;
      }
      if (format !== undefined) {
        console.error("Cannot specify file format more than once");
        return 1;
      }
      i++;
      const arg2 = args[i];
      if (arg2 === "gba" || arg2 === "bin") {
        format = arg2;
      } else {
        console.error(
          `Invalid file format. Expecting 'gba' or 'bin', but got: ${arg2}`,
        );
        return 1;
      }
    } else {
      if (arg === "--" && i + 1 < args.length) {
        i++;
        arg = args[i];
      }
      if (input !== undefined) {
        console.error("Cannot specify input file more than once");
        return 1;
      }
      input = arg;
    }
  }

  if (input === undefined) {
    console.error("Missing input file");
    return 1;
  }

  return { input, output, format };
}

export async function main(args: string[]): Promise<number> {
  if (args.length <= 0 || args[0] === "-h" || args[0] === "--help") {
    printVersion();
    console.log("");
    printHelp();
    return 0;
  } else if (args[0] === "-v" || args[0] === "--version") {
    printVersion();
    return 0;
  } else if (args[0] === "init") {
    return await init(args.slice(1));
  } else if (args[0] === "make") {
    return await make(args.slice(1));
  } else if (args[0] === "dis") {
    const disArgs = parseDisArgs(args.slice(1));
    if (typeof disArgs === "number") {
      return disArgs;
    }
    return await dis(disArgs);
  }
  console.error(`Unknown command: ${args[0]}`);
  return 1;
}