//
// gvasm - Assembler and disassembler for Game Boy Advance homebrew
// by Sean Connelly (@velipso), https://sean.cm
// The Unlicense License
// Project Home: https://github.com/velipso/gvasm
//

import {
  errorString,
  flpString,
  IFilePos,
  isIdentStart,
  ITok,
  lex,
  TokEnum,
} from "./lexer.ts";
import { assertNever, b16, b32 } from "./util.ts";
import { Arm, Thumb } from "./ops.ts";
import { Expression } from "./expr.ts";
import { Bytes } from "./bytes.ts";
import { path } from "./external.ts";

export interface IMakeArgs {
  input: string;
  output: string;
}

interface IParseState {
  arm: boolean;
  bytes: Bytes;
}

type ISyms = { [sym: string]: Expression | number };

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

function parseComma(line: ITok[], error: string) {
  if (line[0].kind === TokEnum.ID && line[0].id === ",") {
    line.shift();
  } else {
    throw error;
  }
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

function parseReglist(
  line: ITok[],
  width: 8 | 16,
  extra?: number,
): number | false {
  let state = 0;
  let result = 0;
  let lastRegister = -1;
  for (let i = 0; i < line.length; i++) {
    const t = line[i];
    switch (state) {
      case 0: // read open brace
        if (t.kind === TokEnum.ID && t.id === "{") {
          state = 1;
        } else {
          return false;
        }
        break;
      case 1: // read register
        if (t.kind === TokEnum.ID && t.id === "}") {
          line.splice(0, i + 1); // remove tokens
          return result;
        } else if (t.kind === TokEnum.ID && decodeRegister(t.id) >= 0) {
          lastRegister = decodeRegister(t.id);
          if (lastRegister >= width && lastRegister !== extra) {
            return false;
          }
          if (result & (1 << lastRegister)) {
            return false;
          }
          state = 2;
        } else {
          return false;
        }
        break;
      case 2: // after register
        if (t.kind === TokEnum.ID && t.id === "}") {
          if (lastRegister !== extra) {
            result |= 1 << lastRegister;
          }
          line.splice(0, i + 1); // remove tokens
          return result;
        } else if (t.kind === TokEnum.ID && t.id === ",") {
          if (lastRegister !== extra) {
            result |= 1 << lastRegister;
          }
          state = 1;
        } else if (
          t.kind === TokEnum.ID && t.id === "-" && lastRegister !== extra
        ) {
          state = 3;
        } else {
          return false;
        }
        break;
      case 3: // reading end of range
        if (t.kind === TokEnum.ID && decodeRegister(t.id) >= 0) {
          const end = decodeRegister(t.id);
          if (end >= width) {
            return false;
          }
          for (let b = lastRegister; b <= end; b++) {
            result |= 1 << b;
          }
          state = 4;
        } else {
          return false;
        }
        break;
      case 4: // after range
        if (t.kind === TokEnum.ID && t.id === "}") {
          line.splice(0, i + 1); // remove tokens
          return result;
        } else if (t.kind === TokEnum.ID && t.id === ",") {
          state = 1;
        } else {
          return false;
        }
        break;
    }
  }
  return false;
}

function parseNumCommas(
  line: ITok[],
  defaults: (number | false)[],
  error: string,
): number[] {
  const result: number[] = [];
  for (const def of defaults) {
    if (def === false || line.length > 0) {
      result.push(parseNum(line));
      if (
        line.length > 0 && line[0].kind === TokEnum.ID && line[0].id === ","
      ) {
        line.shift();
      }
    } else {
      result.push(def);
    }
  }
  if (line.length > 0) {
    throw error;
  }
  return result;
}

function parseDotStatement(
  state: IParseState,
  cmd: string,
  line: ITok[],
): { include: string } | { embed: string } | undefined {
  switch (cmd) {
    case ".error":
      if (line.length === 1 && line[0].kind === TokEnum.STR) {
        throw line[0].str;
      } else {
        throw "Invalid .error statement";
      }
    case ".base": {
      const amount = parseNum(line);
      if (line.length > 0) {
        throw "Invalid .base statement";
      }
      state.bytes.setBase(amount);
      break;
    }
    case ".arm":
      if (line.length > 0) {
        throw "Invalid .arm statement";
      }
      state.bytes.align(4);
      state.arm = true;
      break;
    case ".thumb":
      if (line.length > 0) {
        throw "Invalid .thumb statement";
      }
      state.bytes.align(2);
      state.arm = false;
      break;
    case ".align": {
      const [amount, fill] = parseNumCommas(
        line,
        [false, 0],
        "Invalid .align statement",
      );
      if (amount < 2 || amount > 0x02000000) {
        throw "Invalid .align statement";
      }
      state.bytes.align(amount, fill & 0xff);
      break;
    }
    case ".i8":
    case ".b8":
      while (line.length > 0) {
        const t = line[0];
        if (t.kind === TokEnum.STR) {
          line.shift();
          for (const n of new TextEncoder().encode(t.str)) {
            state.bytes.write8(n);
          }
        } else {
          state.bytes.expr8(
            errorString(t.flp, `Invalid ${cmd} statement`),
            { v: parseExpr(line) },
            ({ v }) => v,
          );
          if (line.length > 0) {
            parseComma(line, `Invalid ${cmd} statement`);
          }
        }
      }
      break;
    case ".i8fill":
    case ".b8fill": {
      const [amount, fill] = parseNumCommas(
        line,
        [false, 0],
        `Invalid ${cmd} statement`,
      );
      if (amount < 0) {
        throw `Invalid ${cmd} statement`;
      }
      for (let i = 0; i < amount; i++) {
        state.bytes.write8(fill);
      }
      break;
    }
    case ".i16":
    case ".b16":
      while (line.length > 0) {
        state.bytes.expr16(
          errorString(line[0].flp, `Invalid ${cmd} statement`),
          { v: parseExpr(line) },
          ({ v }) => {
            if (cmd === ".b16") {
              return b16(v);
            }
            return v;
          },
        );
        if (line.length > 0) {
          parseComma(line, `Invalid ${cmd} statement`);
        }
      }
      break;
    case ".i16fill":
    case ".b16fill": {
      const [amount, fill] = parseNumCommas(
        line,
        [false, 0],
        `Invalid ${cmd} statement`,
      );
      if (amount < 0) {
        throw `Invalid ${cmd} statement`;
      }
      for (let i = 0; i < amount; i++) {
        state.bytes.write16(cmd === ".b16fill" ? b16(fill) : fill);
      }
      break;
    }
    case ".i32":
    case ".b32":
      while (line.length > 0) {
        state.bytes.expr32(
          errorString(line[0].flp, `Invalid ${cmd} statement`),
          { v: parseExpr(line) },
          ({ v }) => {
            if (cmd === ".b32") {
              return b32(v);
            }
            return v;
          },
        );
        if (line.length > 0) {
          parseComma(line, `Invalid ${cmd} statement`);
        }
      }
      break;
    case ".i32fill":
    case ".b32fill": {
      const [amount, fill] = parseNumCommas(
        line,
        [false, 0],
        `Invalid ${cmd} statement`,
      );
      if (amount < 0) {
        throw `Invalid ${cmd} statement`;
      }
      for (let i = 0; i < amount; i++) {
        state.bytes.write32(cmd === ".b32fill" ? b32(fill) : fill);
      }
      break;
    }
    case ".include": {
      const t = line.shift();
      if (!t || t.kind !== TokEnum.STR || line.length > 0) {
        throw "Invalid .include statement";
      }
      return { include: t.str };
    }
    case ".embed": {
      const t = line.shift();
      if (!t || t.kind !== TokEnum.STR || line.length > 0) {
        throw "Invalid .include statement";
      }
      return { embed: t.str };
    }
    case ".stdlib":
      throw "TODO: .stdlib";
    case ".extlib":
      throw "TODO: .extlib";
    case ".logo":
      if (line.length > 0) {
        throw "Invalid .logo statement";
      }
      state.bytes.writeLogo();
      break;
    case ".title": {
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
    case ".crc": {
      if (line.length > 0) {
        throw "Invalid .crc statement";
      }
      state.bytes.writeCRC();
      break;
    }
    case ".macro":
      throw "TODO: marco";
    case ".endm":
      throw "TODO: endm";
    case ".end":
      if (line.length > 0) {
        throw "Invalid .end statement";
      }
      state.bytes.removeLocalLabels();
      // TODO: delete local macros
      // TODO: delete local constants
      break;
    case ".if":
    case ".elseif":
    case ".else":
    case ".endif":
      throw "TODO: .if/.elseif/.else/.endif";
    case ".printf":
      throw "TODO: .printf";
    case ".rgb": {
      const r = parseNum(line);
      parseComma(line, "Invalid .rgb statement");
      const g = parseNum(line);
      parseComma(line, "Invalid .rgb statement");
      const b = parseNum(line);
      if (line.length > 0) {
        throw "Invalid .rgb statement";
      }
      state.bytes.write16(
        ((b & 0x1f) << 10) |
          ((g & 0x1f) << 5) |
          (r & 0x1f),
      );
      break;
    }
    default:
      throw `Unknown dot statement: ${cmd}`;
  }
}

function validateStr(partStr: string, line: ITok[]): boolean {
  if (partStr === "") {
    return true;
  }
  const t = line.shift();
  if (!t || t.kind !== TokEnum.ID || t.id !== partStr) {
    return false;
  }
  return true;
}

function validateNum(partNum: number, line: ITok[]): boolean {
  try {
    if (parseNum(line) !== partNum) {
      return false;
    }
    return true;
  } catch (_) {
    return false;
  }
}

function validateSymExpr(syms: ISyms, partSym: string, line: ITok[]): boolean {
  try {
    const expr = Expression.parse(line);
    if (expr === false) {
      return false;
    }
    syms[partSym] = expr;
    return true;
  } catch (_) {
    return false;
  }
}

function validateSymRegister(
  syms: ISyms,
  partSym: string,
  line: ITok[],
  low: number,
  high: number,
): boolean {
  const t = line.shift();
  if (!t || t.kind !== TokEnum.ID) {
    return false;
  }
  const reg = decodeRegister(t.id);
  if (reg >= low && reg <= high) {
    syms[partSym] = reg;
    return true;
  } else {
    return false;
  }
}

function validateSymEnum(
  syms: ISyms,
  partSym: string,
  line: ITok[],
  enums: (string | false)[],
): boolean {
  const valid: { [str: string]: number } = {};
  for (let i = 0; i < enums.length; i++) {
    const en = enums[i];
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
    syms[partSym] = valid[line[0].id];
    line.shift();
    return true;
  } else if ("" in valid) {
    syms[partSym] = valid[""];
    return true;
  }
  return false;
}

class BitNumber {
  private maxSize: number;
  private bpos = 0;
  private value = 0;

  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  public push(size: number, v: number) {
    this.value |= (v & ((1 << size) - 1)) << this.bpos;
    this.bpos += size;
  }

  public get() {
    if (this.bpos !== this.maxSize) {
      throw new Error(`Opcode length isn't ${this.maxSize} bits`);
    }
    return this.value;
  }
}

function parseArmStatement(
  state: IParseState,
  flp: IFilePos,
  pb: Arm.IParsedBody,
  line: ITok[],
) {
  const syms: ISyms = { ...pb.syms };

  for (const part of pb.body) {
    switch (part.kind) {
      case "str":
        if (!validateStr(part.str, line)) {
          return false;
        }
        break;
      case "num":
        if (!validateNum(part.num, line)) {
          return false;
        }
        break;
      case "sym": {
        const codePart = part.codeParts[0];
        switch (codePart.k) {
          case "word":
          case "immediate":
          case "rotimm":
          case "offset12":
          case "pcoffset12":
          case "offsetsplit":
          case "pcoffsetsplit":
            if (!validateSymExpr(syms, part.sym, line)) {
              return false;
            }
            break;
          case "register":
            if (!validateSymRegister(syms, part.sym, line, 0, 15)) {
              return false;
            }
            break;
          case "enum":
            if (!validateSymEnum(syms, part.sym, line, codePart.enum)) {
              return false;
            }
            break;
          case "reglist": {
            const v = parseReglist(line, 16);
            if (v === false) {
              return false;
            }
            syms[part.sym] = v;
            break;
          }
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
      const opcode = new BitNumber(32);
      for (const codePart of pb.op.codeParts) {
        switch (codePart.k) {
          case "immediate": {
            const v = syms[codePart.sym];
            if (v < 0 || v >= (1 << codePart.s)) {
              throw `Immediate value out of range 0..${(1 << codePart.s) -
                1}: ${v}`;
            }
            opcode.push(codePart.s, v);
            break;
          }
          case "enum":
          case "register":
          case "reglist":
            opcode.push(codePart.s, syms[codePart.sym]);
            break;
          case "value":
          case "ignored":
            opcode.push(codePart.s, codePart.v);
            break;
          case "rotimm": {
            // calculate rotate immediate form of v
            let v = syms[codePart.sym];
            let r = 0;
            while (v !== 0 && (v & 3) === 0) {
              v >>>= 2;
              r++;
            }
            if (v > 255) {
              throw `Can't generate rotated immediate from ${
                syms[codePart.sym]
              }`;
            }
            opcode.push(12, (((16 - r) & 0xf) << 8) | (v & 0xff));
            break;
          }
          case "word": {
            const offset = syms[codePart.sym] - address - 8;
            if (offset & 3) {
              throw "Can't branch to misaligned memory address";
            }
            opcode.push(codePart.s, offset >> 2);
            break;
          }
          case "offset12":
          case "pcoffset12": {
            const offset = codePart.k === "offset12"
              ? syms[codePart.sym]
              : syms[codePart.sym] - address - 8;
            if (codePart.sign) {
              opcode.push(codePart.s, offset < 0 ? 0 : 1);
            } else {
              const v = Math.abs(offset);
              if (v >= (1 << codePart.s)) {
                throw `Offset too large: ${v}`;
              }
              opcode.push(codePart.s, v);
            }
            break;
          }
          case "offsetsplit":
          case "pcoffsetsplit": {
            const offset = codePart.k === "offsetsplit"
              ? syms[codePart.sym]
              : syms[codePart.sym] - address - 8;
            if (codePart.sign) {
              opcode.push(codePart.s, offset < 0 ? 0 : 1);
            } else {
              const v = Math.abs(offset);
              if (v >= 256) {
                throw `Offset too large: ${v}`;
              }
              opcode.push(
                codePart.s,
                codePart.low ? v & 0xF : ((v >> 4) & 0xF),
              );
            }
            break;
          }
          default:
            assertNever(codePart);
        }
      }
      return opcode.get();
    },
  );
  return true;
}

function parseThumbStatement(
  state: IParseState,
  flp: IFilePos,
  pb: Thumb.IParsedBody,
  line: ITok[],
) {
  const syms: ISyms = { ...pb.syms };

  for (const part of pb.body) {
    switch (part.kind) {
      case "str":
        if (!validateStr(part.str, line)) {
          return false;
        }
        break;
      case "num":
        if (!validateNum(part.num, line)) {
          return false;
        }
        break;
      case "sym": {
        const codePart = part.codeParts[0];
        switch (codePart.k) {
          case "word":
          case "halfword":
          case "shalfword":
          case "immediate":
          case "pcoffset":
          case "offsetsplit":
            if (!validateSymExpr(syms, part.sym, line)) {
              return false;
            }
            break;
          case "register":
            if (!validateSymRegister(syms, part.sym, line, 0, 7)) {
              return false;
            }
            break;
          case "registerhigh":
            if (!validateSymRegister(syms, part.sym, line, 8, 15)) {
              return false;
            }
            break;
          case "enum":
            if (!validateSymEnum(syms, part.sym, line, codePart.enum)) {
              return false;
            }
            break;
          case "reglist": {
            const v = parseReglist(line, 8, codePart.extra);
            if (v === false) {
              return false;
            }
            syms[part.sym] = v;
            break;
          }
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
  const writer = (maxSize: number) => (
    (syms: { [name: string]: number }, address: number) => {
      const opcode = new BitNumber(maxSize);
      const pushAlign = (size: number, v: number, shift: number) => {
        if (v < 0 || v >= (1 << (size + shift))) {
          throw `Immediate value out of range 0..${((1 << size) - 1) <<
            shift}: ${v}`;
        }
        if (v & ((1 << shift) - 1)) {
          throw `Immediate value is not ${
            shift === 2 ? "word" : "halfword"
          } aligned: ${v}`;
        }
        opcode.push(size, v >> shift);
      };
      for (const codePart of pb.op.codeParts) {
        switch (codePart.k) {
          case "immediate":
            pushAlign(codePart.s, syms[codePart.sym], 0);
            break;
          case "enum":
          case "register":
          case "reglist":
            opcode.push(codePart.s, syms[codePart.sym]);
            break;
          case "registerhigh":
            opcode.push(codePart.s, syms[codePart.sym] - 8);
            break;
          case "value":
          case "ignored":
            opcode.push(codePart.s, codePart.v);
            break;
          case "word":
            pushAlign(codePart.s, syms[codePart.sym], 2);
            break;
          case "halfword":
            pushAlign(codePart.s, syms[codePart.sym], 1);
            break;
          case "shalfword": {
            const offset = syms[codePart.sym] - address - 4;
            if (offset < -(1 << codePart.s) || offset >= (1 << codePart.s)) {
              throw `Offset too large: ${offset}`;
            }
            if (offset & 1) {
              throw "Can't branch to misaligned memory address";
            }
            opcode.push(codePart.s, offset >> 1);
            break;
          }
          case "pcoffset": {
            const offset = syms[codePart.sym] - (address & 0xfffffffd) - 4;
            if (offset < 0) {
              throw "Can't load from address before PC in thumb mode";
            }
            if (offset & 3) {
              throw "Can't load from misaligned address";
            }
            pushAlign(codePart.s, offset, 2);
            break;
          }
          case "offsetsplit": {
            const offset = syms[codePart.sym] - address - 4;
            if (offset < -4194304 || offset >= 4194304) {
              throw `Offset too large: ${offset}`;
            }
            if (offset & 1) {
              throw "Can't branch to misaligned memory address";
            }
            opcode.push(
              codePart.s,
              codePart.low ? (offset >> 1) & 0x7ff : (offset >> 12) & 0x7ff,
            );
            break;
          }
          default:
            assertNever(codePart);
        }
      }
      return opcode.get();
    }
  );

  const es = errorString(flp, "Invalid statement");
  if ("doubleInstruction" in pb.op) {
    // double instructions are 32-bits instead of 16-bits
    state.bytes.expr32(es, syms, writer(32));
  } else {
    state.bytes.expr16(es, syms, writer(16));
  }
  return true;
}

export function parseName(line: ITok[]): string | false {
  if (
    line.length > 0 && line[0].kind === TokEnum.ID &&
    isIdentStart(line[0].id.charAt(0))
  ) {
    const t = line.shift();
    if (!t || t.kind !== TokEnum.ID) {
      return false;
    }
    return t.id;
  }
  return false;
}

function parseLabel(line: ITok[]): string | false {
  if (line.length > 0 && line[0].kind === TokEnum.ID && line[0].id === "@") {
    let prefix = "@";
    line.shift();
    if (line.length > 0 && line[0].kind === TokEnum.ID && line[0].id === "@") {
      prefix += "@";
      line.shift();
    }
    const name = parseName(line);
    if (name === false) {
      throw "Missing label name";
    }
    return prefix + name;
  }
  return false;
}

function parseLine(
  state: IParseState,
  line: ITok[],
): { include: string } | { embed: string } | undefined {
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

  const cmdTok = line.shift();
  if (!cmdTok || cmdTok.kind !== TokEnum.ID) {
    throw "Invalid command";
  }
  const cmd = cmdTok.id;

  if (cmd.startsWith(".")) {
    return parseDotStatement(state, cmd, line);
  } else if (state.arm) {
    const ops = Arm.parsedOps[cmd];
    if (!ops) {
      throw `Unknown arm statement: ${cmd}`;
    }
    if (
      !ops.some((op) => parseArmStatement(state, cmdTok.flp, op, [...line]))
    ) {
      throw "Failed to parse arm statement";
    }
  } else {
    const ops = Thumb.parsedOps[cmd];
    if (!ops) {
      throw `Unknown thumb statement: ${cmd}`;
    }
    if (
      !ops.some((op) => parseThumbStatement(state, cmdTok.flp, op, [...line]))
    ) {
      throw "Failed to parse thumb statement";
    }
  }
}

export async function makeFromFile(
  filename: string,
  isAbsolute: (filename: string) => boolean,
  readTextFile: (filename: string) => Promise<string>,
  readBinaryFile: (filename: string) => Promise<number[] | Uint8Array>,
): Promise<{ result: readonly number[] } | { errors: string[] }> {
  let data;
  try {
    data = await readTextFile(filename);
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
    const alreadyIncluded = new Set<string>();
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

        const includeEmbed = parseLine(state, line);

        if (includeEmbed && "include" in includeEmbed) {
          const { include } = includeEmbed;
          const full = isAbsolute(include)
            ? include
            : path.join(path.dirname(flp.filename), include);

          const includeKey = `${flpString(flp)}:${full}`;
          if (alreadyIncluded.has(includeKey)) {
            return {
              errors: [errorString(flp, `Circular include of: ${full}`)],
            };
          }
          alreadyIncluded.add(includeKey);

          let data2;
          try {
            data2 = await readTextFile(full);
          } catch (_) {
            return {
              errors: [errorString(flp, `Failed to include file: ${full}`)],
            };
          }

          const tokens2 = lex(full, data2);
          const errors2: string[] = [];
          if (
            tokens2.filter((t) => {
              if (t.kind === TokEnum.ERROR) {
                errors2.push(errorString(t.flp, t.msg));
                return true;
              }
            }).length > 0
          ) {
            return { errors: errors2 };
          }

          tokens.splice(0, 0, ...tokens2);
        } else if (includeEmbed && "embed" in includeEmbed) {
          const { embed } = includeEmbed;
          const full = isAbsolute(embed)
            ? embed
            : path.join(path.dirname(flp.filename), embed);

          let data2;
          try {
            data2 = await readBinaryFile(full);
          } catch (_) {
            return {
              errors: [errorString(flp, `Failed to embed file: ${full}`)],
            };
          }

          state.bytes.writeArray(data2);
        }
      }
    } catch (e) {
      return { errors: [errorString(flp, e.toString())] };
    }
  }

  let result;
  try {
    result = state.bytes.get();
  } catch (e) {
    return { errors: [e] };
  }
  return { result };
}

export async function make({ input, output }: IMakeArgs): Promise<number> {
  try {
    const result = await makeFromFile(
      input,
      path.isAbsolute,
      Deno.readTextFile,
      Deno.readFile,
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
