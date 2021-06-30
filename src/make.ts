//
// gbasm - Assembler and disassembler for Game Boy Advance homebrew
// by Sean Connelly (@velipso), https://sean.cm
// The Unlicense License
// Project Home: https://github.com/velipso/gbasm
//

import { errorString, isIdentStart, ITok, lex, TokEnum } from "./lexer.ts";
import { assertNever } from "./util.ts";
import { Arm, Thumb } from "./ops.ts";
import { Expression } from "./expr.ts";
import { Bytes } from "./bytes.ts";

export interface IMakeArgs {
  input: string;
  output: string;
}

interface IParseState {
  arm: boolean;
  bytes: Bytes;
}

function decodeRegister(id: string): number {
  if (id === "sp") {
    return 13;
  } else if (id === "lr") {
    return 14;
  } else if (id === "pc") {
    return 15;
  } else if (/^r([0-9]|(1[0-5]))$/.test(id)) {
    return parseInt(id.substr(1), 10);
  }
  return -1;
}

function parseNum(line: ITok[]): number {
  const expr = Expression.parse(line);
  if (expr === false) {
    throw "Expecting constant number";
  }
  const v = expr.value();
  if (v === false) {
    throw "Expecting constant number";
  }
  return v;
}

function parseExpr(line: ITok[]): Expression {
  const expr = Expression.parse(line);
  if (expr === false) {
    throw "Expecting constant expression";
  }
  return expr;
}

function parseDotStatement(state: IParseState, cmd: string, line: ITok[]) {
  switch (cmd) {
    case "error":
      if (line.length === 1 && line[0].kind === TokEnum.STR) {
        throw line[0].str;
      } else {
        throw "Invalid .error statement";
      }
    case "base": {
      const amount = parseNum(line);
      if (line.length > 0) {
        throw "Invalid .base statement";
      }
      state.bytes.setBase(amount);
      break;
    }
    case "arm":
      if (line.length > 0) {
        throw "Invalid .arm statement";
      }
      state.bytes.align(4);
      state.arm = true;
      break;
    case "thumb":
      if (line.length > 0) {
        throw "Invalid .thumb statement";
      }
      state.bytes.align(2);
      state.arm = false;
      break;
    case "align": {
      const amount = parseNum(line);
      let fill = 0;
      if (
        line.length > 0 && line[0].kind === TokEnum.ID && line[0].id === ","
      ) {
        line.shift();
        fill = parseNum(line);
      }
      if (line.length > 0 || amount < 2 || amount > 0x02000000) {
        throw "Invalid .align statement";
      }
      state.bytes.align(amount, fill & 0xff);
      break;
    }
    case "i8":
    case "b8":
      while (line.length > 0) {
        const t = line[0];
        if (t.kind === TokEnum.STR) {
          line.shift();
          for (const n of new TextEncoder().encode(t.str)) {
            state.bytes.write8(n);
          }
        } else {
          state.bytes.expr8(
            errorString(t.flp, `Invalid .${cmd} statement`),
            { v: parseExpr(line) },
            ({ v }) => v,
          );
          if (line.length > 0) {
            if (line[0].kind === TokEnum.ID && line[0].id === ",") {
              line.shift();
            } else {
              throw `Invalid .${cmd} statement`;
            }
          }
        }
      }
      break;
    case "i16":
    case "b16":
      while (line.length > 0) {
        state.bytes.expr16(
          errorString(line[0].flp, `Invalid .${cmd} statement`),
          { v: parseExpr(line) },
          ({ v }) => {
            if (cmd === "b16") {
              // reverse byte order
              const b1 = v & 0xff;
              const b2 = (v >> 8) & 0xff;
              return (b1 << 8) | b2;
            }
            return v;
          },
        );
        if (line.length > 0) {
          if (line[0].kind === TokEnum.ID && line[0].id === ",") {
            line.shift();
          } else {
            throw `Invalid .${cmd} statement`;
          }
        }
      }
      break;
    case "i32":
    case "b32":
      while (line.length > 0) {
        state.bytes.expr32(
          errorString(line[0].flp, `Invalid .${cmd} statement`),
          { v: parseExpr(line) },
          ({ v }) => {
            if (cmd === "b32") {
              // reverse byte order
              const b1 = v & 0xff;
              const b2 = (v >> 8) & 0xff;
              const b3 = (v >> 16) & 0xff;
              const b4 = (v >> 24) & 0xff;
              return (b1 << 24) | (b2 << 16) | (b3 << 8) | b4;
            }
            return v;
          },
        );
        if (line.length > 0) {
          if (line[0].kind === TokEnum.ID && line[0].id === ",") {
            line.shift();
          } else {
            throw `Invalid .${cmd} statement`;
          }
        }
      }
      break;
    case "include":
      throw "TODO: include";
    case "embed":
      throw "TODO: embed";
    case "stdlib":
      throw "TODO: stdlib";
    case "extlib":
      throw "TODO: extlib";
    case "logo":
      if (line.length > 0) {
        throw "Invalid .logo statement";
      }
      state.bytes.writeLogo();
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
        state.bytes.write8(i < data.length ? data[i] : 0);
      }
      break;
    }
    case "crc": {
      if (line.length > 0) {
        throw "Invalid .crc statement";
      }
      state.bytes.writeCRC();
      break;
    }
    case "macro":
      throw "TODO: marco";
    case "endm":
      throw "TODO: endm";
    case "end":
      if (line.length > 0) {
        throw "Invalid .end statement";
      }
      state.bytes.removeLocalLabels();
      // TODO: delete local macros
      // TODO: delete local constants
      break;
    case "if":
    case "elseif":
    case "else":
    case "endif":
      throw "TODO: if/elseif/else/endif";
    default:
      throw `Unknown dot statement: .${cmd}`;
  }
}

function parseArmStatement(
  state: IParseState,
  pb: Arm.IParsedBody,
  line: ITok[],
) {
  const flp = line[0].flp;
  const syms: { [sym: string]: Expression | number } = { ...pb.syms };

  for (const part of pb.body) {
    switch (part.kind) {
      case "str": {
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
      }
      case "num":
        try {
          if (parseNum(line) !== part.num) {
            return false;
          }
        } catch (_) {
          return false;
        }
        break;
      case "sym": {
        const codePart = part.codeParts[0];
        switch (codePart.k) {
          case "word":
          case "immediate":
          case "rotimm": {
            try {
              const expr = Expression.parse(line);
              if (expr === false) {
                return false;
              }
              syms[part.sym] = expr;
            } catch (_) {
              return false;
            }
            break;
          }
          case "register": {
            const t = line.shift();
            if (!t || t.kind !== TokEnum.ID) {
              return false;
            }
            const reg = decodeRegister(t.id);
            if (reg >= 0 && reg <= 15) {
              syms[part.sym] = reg;
            } else {
              return false;
            }
            break;
          }
          case "enum": {
            const valid: { [str: string]: number } = {};
            for (let i = 0; i < codePart.enum.length; i++) {
              const en = codePart.enum[i];
              if (en === false) {
                continue;
              }
              for (const es of en.split("/")) {
                valid[es] = i;
              }
            }
            if (
              line.length > 0 && line[0].kind === TokEnum.ID &&
              line[0].id in valid
            ) {
              syms[part.sym] = valid[line[0].id];
              line.shift();
            } else if ("" in valid) {
              syms[part.sym] = valid[""];
            } else {
              return false;
            }
            break;
          }
          case "offset12":
          case "reglist":
          case "offsetsplit":
            console.error(`TODO: don't know how to interpret ${codePart.k}`);
            throw new Error("TODO");
          case "value":
          case "ignored":
            throw new Error("Invalid syntax for parsed body");
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
  state.bytes.expr32(
    errorString(flp, "Invalid statement"),
    syms,
    (syms, address) => {
      let opcode = 0;
      let bpos = 0;
      const push = (size: number, v: number) => {
        opcode |= (v & ((1 << size) - 1)) << bpos;
        bpos += size;
      };
      for (const codePart of pb.op.codeParts) {
        switch (codePart.k) {
          case "immediate":
          case "enum":
          case "register": {
            push(codePart.s, syms[codePart.sym]);
            break;
          }
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
          case "word": {
            const offset = syms[codePart.sym] - address - 8;
            if (offset & 3) {
              throw `Can't branch to misaligned memory address`;
            }
            push(codePart.s, offset >> 2);
            break;
          }
          case "offset12":
          case "reglist":
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
    },
  );
  return true;
}

function parseThumbStatement(
  state: IParseState,
  pb: Thumb.IParsedBody,
  line: ITok[],
) {
  throw "TODO: parseThumbStatement";
}

function parseLabel(line: ITok[]): string | false {
  if (line.length > 0 && line[0].kind === TokEnum.ID && line[0].id === "@") {
    let label = "@";
    line.shift();
    if (line.length > 0 && line[0].kind === TokEnum.ID && line[0].id === "@") {
      label += "@";
      line.shift();
    }
    if (
      line.length > 0 && line[0].kind === TokEnum.ID &&
      isIdentStart(line[0].id.charAt(0))
    ) {
      label += line[0].id;
      line.shift();
      return label;
    }
    throw "Missing label name";
  }
  return false;
}

function parseLine(state: IParseState, line: ITok[]) {
  // TODO: check for constants
  // TODO: check for macros

  // check for labels
  while (true) {
    const label = parseLabel(line);
    if (label !== false) {
      if (
        line.length < 0 || line[0].kind !== TokEnum.ID || line[0].id !== ":"
      ) {
        throw "Missing colon after label";
      }
      line.shift();
      state.bytes.addLabel(label);
    } else {
      break;
    }
  }

  if (line.length <= 0) {
    return;
  }

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
    if (!ops.some((op) => parseArmStatement(state, op, [...line]))) {
      throw "Failed to parse arm statement";
    }
  } else {
    const ops = Thumb.parsedOps[cmd];
    if (!ops) {
      throw `Unknown thumb statement: ${cmd}`;
    }
    if (!ops.some((op) => parseThumbStatement(state, op, [...line]))) {
      throw "Failed to parse thumb statement";
    }
  }
}

export async function makeFromFile(
  filename: string,
  readFile: (filename: string) => Promise<string>,
): Promise<{ result: readonly number[] } | { errors: string[] }> {
  let data;
  try {
    data = await readFile(filename);
  } catch (_) {
    return { errors: [`Failed to read file: ${filename}`] };
  }

  const tokens = lex(filename, data);

  const errors: string[] = [];
  if (
    tokens.filter((t) => {
      if (t.kind === TokEnum.ERROR) {
        errors.push(errorString(t.flp, t.msg));
        return true;
      }
    }).length > 0
  ) {
    return { errors };
  }

  const state: IParseState = {
    arm: true,
    bytes: new Bytes(),
  };

  if (tokens.length > 0) {
    let flp = tokens[0].flp;
    try {
      while (tokens.length > 0) {
        flp = tokens[0].flp;
        const nextLine = tokens.findIndex((t) => t.kind === TokEnum.NEWLINE);
        const line = nextLine < 0
          ? tokens.splice(0)
          : tokens.splice(0, nextLine + 1);
        if (line.length > 0 && line[line.length - 1].kind === TokEnum.NEWLINE) {
          line.pop(); // remove newline
        }
        parseLine(state, line);
      }
    } catch (e) {
      return { errors: [errorString(flp, e.toString())] };
    }
  }

  return { result: state.bytes.get() };
}

export async function make({ input, output }: IMakeArgs): Promise<number> {
  try {
    const result = await makeFromFile(
      input,
      (filename) => Deno.readTextFile(filename),
    );

    if ("errors" in result) {
      for (const e of result.errors) {
        console.error(e);
      }
      throw false;
    }

    await Deno.writeFile(output, new Uint8Array(result.result));

    return 0;
  } catch (e) {
    if (e !== false) {
      console.error(`${e}\nUnknown fatal error`);
    }
    return 1;
  }
}
