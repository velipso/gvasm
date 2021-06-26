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
        const t = line[0];
        if (t.kind === TokEnum.STR) {
          line.shift();
          new TextEncoder().encode(t.str).forEach((n) => {
            state.output.push(n);
          });
        } else {
          const n = parseNum(line);
          state.output.push(n & 0xff);
        }
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
    case "logo":
      if (line.length > 0) {
        throw "Invalid .logo statement";
      }
      // deno-fmt-ignore
      state.output.push(
        0x24, 0xff, 0xae, 0x51, 0x69, 0x9a, 0xa2, 0x21, 0x3d, 0x84, 0x82, 0x0a, 0x84, 0xe4, 0x09,
        0xad, 0x11, 0x24, 0x8b, 0x98, 0xc0, 0x81, 0x7f, 0x21, 0xa3, 0x52, 0xbe, 0x19, 0x93, 0x09,
        0xce, 0x20, 0x10, 0x46, 0x4a, 0x4a, 0xf8, 0x27, 0x31, 0xec, 0x58, 0xc7, 0xe8, 0x33, 0x82,
        0xe3, 0xce, 0xbf, 0x85, 0xf4, 0xdf, 0x94, 0xce, 0x4b, 0x09, 0xc1, 0x94, 0x56, 0x8a, 0xc0,
        0x13, 0x72, 0xa7, 0xfc, 0x9f, 0x84, 0x4d, 0x73, 0xa3, 0xca, 0x9a, 0x61, 0x58, 0x97, 0xa3,
        0x27, 0xfc, 0x03, 0x98, 0x76, 0x23, 0x1d, 0xc7, 0x61, 0x03, 0x04, 0xae, 0x56, 0xbf, 0x38,
        0x84, 0x00, 0x40, 0xa7, 0x0e, 0xfd, 0xff, 0x52, 0xfe, 0x03, 0x6f, 0x95, 0x30, 0xf1, 0x97,
        0xfb, 0xc0, 0x85, 0x60, 0xd6, 0x80, 0x25, 0xa9, 0x63, 0xbe, 0x03, 0x01, 0x4e, 0x38, 0xe2,
        0xf9, 0xa2, 0x34, 0xff, 0xbb, 0x3e, 0x03, 0x44, 0x78, 0x00, 0x90, 0xcb, 0x88, 0x11, 0x3a,
        0x94, 0x65, 0xc0, 0x7c, 0x63, 0x87, 0xf0, 0x3c, 0xaf, 0xd6, 0x25, 0xe4, 0x8b, 0x38, 0x0a,
        0xac, 0x72, 0x21, 0xd4, 0xf8, 0x07,
      );
      break;
    case "title": {
      const t = line.shift();
      if (!t || t.kind !== TokEnum.STR || line.length > 0) {
        throw "Invalid .title statement";
      }
      const data = new TextEncoder().encode(t.str);
      if (data.length > 12) {
        throw "Invalid .title statement: title can't exceed 12 bytes";
      }
      for (let i = 0; i < 12; i++) {
        state.output.push(i < data.length ? data[i] : 0);
      }
      break;
    }
    case "crc": {
      if (line.length > 0) {
        throw "Invalid .crc statement";
      }
      if (state.output.length < 0xbd) {
        throw "Invalid .crc statement: header too small";
      }
      let crc = -0x19;
      for (let i = 0xa0; i < 0xbd; i++) {
        crc = crc - state.output[i];
      }
      state.output.push(crc & 0xff);
      break;
    }
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
  const syms: { [sym: string]: number } = { ...pb.syms };

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

function parseThumbStatement(
  pb: Thumb.IParsedBody,
  line: ITok[],
): number | false {
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
    if (
      !ops.some((op) => {
        const v = parseArmStatement(op, [...line]);
        if (v !== false) {
          state.output.push(v & 0xff);
          state.output.push((v >> 8) & 0xff);
          state.output.push((v >> 16) & 0xff);
          state.output.push((v >> 24) & 0xff);
          return true;
        }
        return false;
      })
    ) {
      throw "Failed to parse arm statement";
    }
  } else {
    const ops = Thumb.parsedOps[cmd];
    if (!ops) {
      throw `Unknown thumb statement: ${cmd}`;
    }
    if (
      !ops.some((op) => {
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
      })
    ) {
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
          const nextLine = state.tks.findIndex((tk) =>
            tk.kind === TokEnum.NEWLINE
          );
          const line = nextLine < 0
            ? state.tks.splice(0)
            : state.tks.splice(0, nextLine + 1);
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
