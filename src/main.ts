//
// gbasm - Assembler and disassembler for Game Boy Advance homebrew
// by Sean Connelly (@velipso), https://sean.cm
// The Unlicense License
// Project Home: https://github.com/velipso/gbasm
//

import { IInitArgs, init } from "./init.ts";
import { IMakeArgs, make } from "./make.ts";
import { dis, IDisArgs } from "./dis.ts";
import { IItestArgs, itest } from "./itest.ts";
import * as path from "https://deno.land/std@0.99.0/path/mod.ts";
import { parse as argParse } from "https://deno.land/std@0.99.0/flags/mod.ts";

function printVersion() {
  console.log(`gbasm - Assembler and disassembler for Game Boy Advance homebrew
by Sean Connelly (@velipso), https://sean.cm
The Unlicense License
Project Home: https://github.com/velipso/gbasm
Version: 0.3`);
}

function printHelp() {
  console.log(`gbasm <command> [...args]

Command Summary:
  init      Create a skeleton project
  make      Compile a project into a .gba file
  dis       Disassemble a .gba file into a source
  itest     Run internal tests to verify correct behavior

For more help, try:
  gbasm <command> --help`);
}

function printInitHelp() {
  console.log(
    `gbasm init <output> [-t title] [-i initials] [-m maker] [-v version]
                     [-r region] [-c code]

<output>     The output .gbasm file
-t title     Game title (max of 12 characters, default "Game")
-i initials  Game initials (must be 2 characters, default "AA")
-m maker     Game maker (must be 2 characters, default "77")
-v version   Game version (must be number from 0..255, default 0)
-r region    Game region (must be 1 character, default "E"):
               D  German       E  English       F  French
               I  Italian      J  Japanese      P  European
               S  Spanish
-c code      Game code (must be 1 character, default "C"):
               A  Normal game (titles released pre-2003)
               B  Normal game (titles released 2003+)
               C  Normal game (newer titles)
               F  Famicom/Classic NES
               K  Yoshi and Koro Koro Puzzle (acceleration sensor)
               P  e-Reader (dot-code scanner)
               R  Warioware Twisted (rumble and z-axis gyro sensor)
               U  Baktai 1 and 2 (real-time clock and solar sensor)
               V  Drill Dozer (rumble)`,
  );
}

function parseInitArgs(args: string[]): number | IInitArgs {
  let badArgs = false;
  const a = argParse(args, {
    string: ["title", "initials", "maker", "version", "region", "code"],
    boolean: ["help"],
    alias: {
      h: "help",
      t: "title",
      i: "initials",
      m: "maker",
      v: "version",
      r: "region",
      c: "code",
    },
    unknown: (_arg: string, key?: string) => {
      if (key) {
        console.error(`Unknown argument: -${key}`);
        badArgs = true;
        return false;
      }
      return true;
    },
  });
  if (badArgs) {
    return 1;
  }
  if (a.help) {
    printInitHelp();
    return 0;
  }
  if (a._.length <= 0) {
    console.error("Missing output file");
    return 1;
  }
  if (a._.length > 1) {
    console.error("Can only have one output file");
    return 1;
  }
  const output = a._[0] as string;
  const title = a.title ?? "Game";
  if (title.length > 12) {
    console.error(
      `Invalid title, must be at most 12 characters, but got: "${title}"`,
    );
    return 1;
  }
  const initials = a.initials ?? "AA";
  if (initials.length !== 2) {
    console.error(
      `Invalid initials, must be 2 characters, but got: "${initials}"`,
    );
    return 1;
  }
  const maker = a.maker ?? "77";
  if (maker.length !== 2) {
    console.error(`Invalid maker, must be 2 characters, but got: "${maker}"`);
    return 1;
  }
  const version = parseInt(a.version ?? "0", 10);
  if (
    isNaN(version) || Math.floor(version) !== version || version < 0 ||
    version > 255
  ) {
    console.error(`Invalid version, must be 0..255, but got: ${version}`);
    return 1;
  }
  const region = a.region ?? "E";
  if (region.length !== 1) {
    console.error(`Invalid region, must be 1 character, but got: "${region}"`);
    return 1;
  }
  const code = a.code ?? "C";
  if (code.length !== 1) {
    console.error(`Invalid code, must be 1 character, but got: "${code}"`);
    return 1;
  }
  return {
    output,
    title,
    initials,
    maker,
    version,
    region,
    code,
  };
}

function printMakeHelp() {
  console.log(`gbasm make <input> [-o <output>]

<input>      The input .gbasm file
-o <output>  The output file (default: input with .gba extension)`);
}

function parseMakeArgs(args: string[]): number | IMakeArgs {
  let badArgs = false;
  const a = argParse(args, {
    string: ["output"],
    boolean: ["help"],
    alias: { h: "help", o: "output" },
    unknown: (_arg: string, key?: string) => {
      if (key) {
        console.error(`Unknown argument: -${key}`);
        badArgs = true;
        return false;
      }
      return true;
    },
  });
  if (badArgs) {
    return 1;
  }
  if (a.help) {
    printMakeHelp();
    return 0;
  }
  if (a._.length <= 0) {
    console.error("Missing input file");
    return 1;
  }
  if (a._.length > 1) {
    console.error("Can only have one input file");
    return 1;
  }
  const input = a._[0] as string;
  const output = a.output;
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
               gba  Input is a .gba file
               bin  Input is a .bin file (typically for BIOS)`);
}

function parseDisArgs(args: string[]): number | IDisArgs {
  let badArgs = false;
  const a = argParse(args, {
    string: ["output", "format"],
    boolean: ["help"],
    alias: { h: "help", o: "output", f: "format" },
    unknown: (_arg: string, key?: string) => {
      if (key) {
        console.error(`Unknown argument: -${key}`);
        badArgs = true;
        return false;
      }
      return true;
    },
  });
  if (badArgs) {
    return 1;
  }
  if (a.help) {
    printDisHelp();
    return 0;
  }
  if (a._.length <= 0) {
    console.error("Missing input file");
    return 1;
  }
  if (a._.length > 1) {
    console.error("Can only have one input file");
    return 1;
  }
  const input = a._[0] as string;
  const format = a.format ?? "gba";
  if (format !== "gba" && format !== "bin") {
    console.error(`Invalid format, must be 'gba' or 'bin', but got: ${format}`);
    return 1;
  }
  const output = a.output;
  return {
    input,
    format,
    output: output ??
      path.format({ ...path.parse(input), base: undefined, ext: ".gbasm" }),
  };
}

function printItestHelp() {
  console.log(`gbasm itest [<filters...>]

<filters>  Only run internal tests that match the filters (glob)`);
}

function parseItestArgs(args: string[]): number | IItestArgs {
  let badArgs = false;
  const a = argParse(args, {
    stopEarly: true,
    boolean: ["help"],
    alias: { h: "help" },
    unknown: (_arg: string, key?: string) => {
      if (key) {
        console.error(`Unknown argument: -${key}`);
        badArgs = true;
        return false;
      }
      return true;
    },
  });
  if (badArgs) {
    return 1;
  }
  if (a.help) {
    printMakeHelp();
    return 0;
  }
  return { filters: a._.map((a) => a.toString()) };
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
    const initArgs = parseInitArgs(args.slice(1));
    if (typeof initArgs === "number") {
      return initArgs;
    }
    return await init(initArgs);
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
  } else if (args[0] === "itest") {
    const itestArgs = parseItestArgs(args.slice(1));
    if (typeof itestArgs === "number") {
      return itestArgs;
    }
    return await itest(itestArgs);
  }
  console.error(`Unknown command: ${args[0]}`);
  return 1;
}
