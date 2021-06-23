//
// gbasm - Assembler and disassembler for Game Boy Advance homebrew
// by Sean Connelly (@velipso), https://sean.cm
// The Unlicense License
// Project Home: https://github.com/velipso/gbasm
//

import { init } from "./init.ts";
import { IMakeArgs, make } from "./make.ts";
import { dis, IDisArgs } from "./dis.ts";
import * as path from "https://deno.land/std@0.99.0/path/mod.ts";

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

function printMakeHelp() {
  console.log(`gbasm make <input> [-o <output>]

<input>      The input .gbasm file
-o <output>  The output file (default: input with .gba extension)`);
}

function parseMakeArgs(args: string[]): number | IMakeArgs {
  if (args.length <= 0 || args[0] === "-h" || args[0] === "--help") {
    printMakeHelp();
    return 0;
  }

  let input: string | undefined;
  let output: string | undefined;
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

  return {
    input,
    output: output ??
      path.format({ ...path.parse(input), base: undefined, ext: ".gba" }),
  };
}

function printDisHelp() {
  console.log(`gbasm dis <input> [-o <output>] [-f <format>]

<input>      The input .gba or .bin file
-o <output>  The output file (default: input with .gbasm extension)
-f <format>  The input format (default: gba)

Formats:
-f gba       Input is a .gba file
-f bin       Input is a .bin file (typically for BIOS)`);
}

function parseDisArgs(args: string[]): number | IDisArgs {
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

  return {
    input,
    format: format ?? "gba",
    output: output ??
      path.format({ ...path.parse(input), base: undefined, ext: ".gbasm" }),
  };
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
    const makeArgs = parseMakeArgs(args.slice(1));
    if (typeof makeArgs === "number") {
      return makeArgs;
    }
    return await make(makeArgs);
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
