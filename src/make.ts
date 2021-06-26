//
// gbasm - Assembler and disassembler for Game Boy Advance homebrew
// by Sean Connelly (@velipso), https://sean.cm
// The Unlicense License
// Project Home: https://github.com/velipso/gbasm
//

import { ITok, lex, logError, TokEnum } from "./lexer.ts";
import { assertNever } from "./util.ts";
import { Arm, Thumb } from "./ops.ts";

export interface IMakeArgs {
  input: string;
  output: string;
}

interface IParseState {
  arm: boolean;
  tks: ITok[];
  output: number[];
}

function parseNum(line: ITok[]): number {
  // TODO: const expression parsing
  const n = line.shift();
  if (!n || n.kind !== TokEnum.NUM) {
    throw "Expecting number";
  }
  return n.num;
}

function align(state: IParseState, amount: number) {
  while ((state.output.length % amount) !== 0) {
    state.output.push(0);
  }
}

function parseDotStatement(state: IParseState, cmd: string, line: ITok[]) {
  switch (cmd) {
    case "arm":
      if (line.length > 0) {
        throw "Invalid .arm statement";
      }
      align(state, 4);
      state.arm = true;
      return;
    case "thumb":
      if (line.length > 0) {
        throw "Invalid .thumb statement";
      }
      align(state, 2);
      state.arm = false;
      return;
    case "align":
      const amount = parseNum(line);
      if (line.length > 0 || amount < 2 || amount > 256) {
        throw "Invalid .align statement";
      }
      align(state, amount);
      return;
    case "u8":
      while (line.length > 0) {
        const n = parseNum(line);
        state.output.push(n & 0xff);
      }
      return;
    case "u16":
      while (line.length > 0) {
        const n = parseNum(line);
        state.output.push(n & 0xff);
        state.output.push((n >> 8) & 0xff);
      }
      return;
    case "u32":
      while (line.length > 0) {
        const n = parseNum(line);
        state.output.push(n & 0xff);
        state.output.push((n >> 8) & 0xff);
        state.output.push((n >> 16) & 0xff);
        state.output.push((n >> 24) & 0xff);
      }
      return;
    case "include":
      throw "TODO: include";
    case "embed":
      throw "TODO: embed";
    case "stdlib":
      throw "TODO: stdlib";
    case "gbalogo":
      throw "TODO: gbalogo";
    case "gbacrc":
      throw "TODO: gbacrc";
    case "macro":
      throw "TODO: marco";
    case "endm":
      throw "TODO: endm";
    case "end":
      throw "TODO: end";
    default:
      throw `Unknown dot statement: .${cmd}`;
  }
}

function parseArmStatement(pb: Arm.IParsedBody, line: ITok[]): number | false {
  const syms: { [sym: string]: number } = {...pb.syms};

  for (const part of pb.body) {
    switch (part.kind) {
      case "str":
        if (part.str === "") {
          continue;
        }
        if (line.length <= 0) {
          return false;
        }
        const t = line.shift();
        if (!t || t.kind !== TokEnum.ID || t.id !== part.str) {
          return false;
        }
        break;
      case "num":
        try {
          if (parseNum(line) !== part.num) {
            return false;
          }
        } catch (e) {
          return false;
        }
        break;
      case "sym": {
        const codePart = part.codeParts[0];
        switch (codePart.k) {
          case "immediate":
          case "rotimm":
            try {
              syms[part.sym] = parseNum(line);
            } catch (e) {
              return false;
            }
            break;
          case "register": {
            const t = line.shift();
            if (!t || t.kind !== TokEnum.ID) {
              return false;
            }
            const id = t.id.toLowerCase();
            let reg = -1;
            if (id === "sp") {
              reg = 13;
            } else if (id === "lr") {
              reg = 14;
            } else if (id === "pc") {
              reg = 15;
            } else if (/^r([0-9]|(1[0-5]))$/.test(id)) {
              reg = parseInt(id.substr(1), 10);
            }
            if (reg >= 0 && reg <= 15) {
              syms[part.sym] = reg;
            } else {
              return false;
            }
            break;
          }
          case "enum":
          case "value":
          case "ignored":
          case "offset12":
          case "reglist":
          case "word":
          case "offsetsplit":
            throw new Error("TODO: don't know how to interpret ${codePart}");

          default:
            assertNever(codePart);
        }
        break;
      }
      default:
        assertNever(part);
    }
  }

  // did we consume the entire line?
  if (line.length > 0) {
    return false;
  }

  // great! now constitute the opcode using the symbols
  let opcode = 0;
  let bpos = 0;
  const push = (size: number, v: number) => {
    opcode |= v << bpos;
    bpos += size;
  };
  for (const codePart of pb.op.codeParts) {
    switch (codePart.k) {
      case "immediate":
      case "enum":
      case "register":
        push(codePart.s, syms[codePart.sym]);
        break;
      case "value":
      case "ignored":
        push(codePart.s, codePart.v);
        break;
      case "rotimm": {
        // calculate rotate immediate form of v
        let v = syms[codePart.sym];
        let r = 0;
        while (v > 0 && (v & 3) === 0) {
          v >>= 2;
          r++;
        }
        if (v > 255) {
          throw `Can't generate rotimm from ${syms[codePart.sym]}`;
        }
        push(12, (((16 - r) & 0xf) << 8) | (v & 0xff));
        break;
      }
      case "offset12":
      case "reglist":
      case "word":
      case "offsetsplit":
        throw new Error(`TODO: push with ${codePart.k}`);
      default:
        assertNever(codePart);
    }
  }
  if (bpos !== 32) {
    throw new Error("Opcode length isn't 32 bits");
  }
  return opcode;
}

function parseThumbStatement(pb: Thumb.IParsedBody, line: ITok[]): number | false {
  throw "TODO: parseThumbStatement";
}

function parseLine(state: IParseState, line: [ITok, ...ITok[]]) {
  // check for dot commands
  let dot = false;
  if (line[0].kind === TokEnum.ID && line[0].id === ".") {
    line.shift(); // remove "."
    dot = true;
  }

  const cmdTok = line.shift();
  if (!cmdTok || cmdTok.kind !== TokEnum.ID) {
    throw "Invalid command";
  }
  const cmd = cmdTok.id;

  if (dot) {
    parseDotStatement(state, cmd, line);
  } else if (state.arm) {
    const ops = Arm.parsedOps[cmd];
    if (!ops) {
      throw `Unknown arm statement: ${cmd}`;
    }
    if (!ops.some((op) => {
      const v = parseArmStatement(op, [...line]);
      if (v !== false) {
        state.output.push(v & 0xff);
        state.output.push((v >> 8) & 0xff);
        state.output.push((v >> 16) & 0xff);
        state.output.push((v >> 24) & 0xff);
        return true;
      }
      return false;
    })) {
      throw "Failed to parse arm statement";
    }
  } else {
    const ops = Thumb.parsedOps[cmd];
    if (!ops) {
      throw `Unknown thumb statement: ${cmd}`;
    }
    if (!ops.some((op) => {
      const v = parseThumbStatement(op, [...line]);
      if (v !== false) {
        state.output.push(v & 0xff);
        state.output.push((v >> 8) & 0xff);
        if (v < 0 || v > 0xffff) { // some thumb instructions are 32 bits wide
          state.output.push((v >> 16) & 0xff);
          state.output.push((v >> 24) & 0xff);
        }
        return true;
      }
      return false;
    })) {
      throw "Failed to parse thumb statement";
    }
  }
}

export async function make({ input, output }: IMakeArgs): Promise<number> {
  try {
    const data = await Deno.readTextFile(input).catch((e) => {
      console.error(`${e}\nFailed to read input file: ${input}`);
      throw false;
    });

    const tokens = lex(input, data);

    if (
      tokens.filter((t) => {
        if (t.kind === TokEnum.ERROR) {
          logError(t.flp, t.msg);
          return true;
        }
      }).length > 0
    ) {
      throw false;
    }

    const state: IParseState = {
      arm: true,
      tks: tokens,
      output: [],
    };

    if (state.tks.length > 0) {
      let flp = state.tks[0].flp;
      try {
        while (state.tks.length > 0) {
          flp = state.tks[0].flp;
          const nextLine = state.tks.findIndex((tk) => tk.kind === TokEnum.NEWLINE);
          const line = nextLine < 0 ? state.tks.splice(0) : state.tks.splice(0, nextLine + 1);
          line.pop(); // remove newline
          if (line.length > 0) {
            parseLine(state, line as [ITok, ...ITok[]]);
          }
        }
      } catch (e) {
        logError(flp, e.toString());
        throw false;
      }
    }

    await Deno.writeFile(output, new Uint8Array(state.output));

    return 0;
  } catch (e) {
    if (e !== false) {
      console.error(`${e}\nUnknown fatal error`);
    }
    return 1;
  }
}
