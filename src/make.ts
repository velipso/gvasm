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
  lexAddLine,
  lexNew,
  TokEnum,
} from "./lexer.ts";
import { assertNever, b16, b32, ILineStr, printf, splitLines } from "./util.ts";
import { Arm, Thumb } from "./ops.ts";
import { Expression, ExpressionBuilder } from "./expr.ts";
import { Bytes } from "./bytes.ts";
import { path } from "./deps.ts";
import { ConstTable } from "./const.ts";
import { version } from "./main.ts";
import { stdlib } from "./stdlib.ts";
import { extlib } from "./extlib.ts";
import { loadLibIntoContext, loadLibIntoScript } from "./sinklib.ts";
import * as sink from "./sink.ts";

export interface IMakeArgs {
  input: string;
  output: string;
}

interface IDotStackBegin {
  kind: "begin";
  arm: boolean;
  flp: IFilePos;
}

interface IDotStackIf {
  kind: "if";
  flp: IFilePos;
  isTrue: boolean;
  gotTrue: boolean;
  gotElse: boolean;
}

interface IDotStackStruct {
  kind: "struct";
  flp: IFilePos;
}

interface IDotStackScript {
  kind: "script";
  flp: IFilePos;
}

interface IDotStackMacro {
  kind: "macro";
  flp: IFilePos;
}

type IDotStack =
  | IDotStackBegin
  | IDotStackIf
  | IDotStackStruct
  | IDotStackScript
  | IDotStackMacro;

interface IParseState {
  arm: boolean;
  main: boolean;
  bytes: Bytes;
  ctable: ConstTable;
  blockBase: boolean;
  active: boolean;
  struct: false | {
    nextByte: number;
    prefix: string[];
    defines: { name: string; value: number }[];
  };
  dotStack: IDotStack[];
  script: boolean | {
    scr: sink.scr;
    body: ILineStr[];
    startFile: string;
  };
  store: { [key: string]: string };
  onceFound: Set<string>;
  posix: boolean;
  fileType(filename: string): Promise<sink.fstype>;
  readBinaryFile(filename: string): Promise<number[] | Uint8Array>;
  log(str: string): void;
}

type ISyms = { [sym: string]: Expression | number };

function decodeRegister(id: string): number {
  if (id === "ip") {
    return 12;
  } else if (id === "sp") {
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

export function isNextId(line: ITok[], id: string): boolean {
  return line.length > 0 && line[0].kind === TokEnum.ID && line[0].id === id;
}

function parseComma(line: ITok[], error: string) {
  if (isNextId(line, ",")) {
    line.shift();
  } else {
    throw error;
  }
}

function parseNum(state: IParseState, line: ITok[], quiet = false): number {
  const expr = ExpressionBuilder.parse(line, [], state.ctable);
  if (expr === false) {
    if (quiet) {
      return 0;
    }
    throw "Expecting constant number";
  }
  const e = expr.build([]);
  state.bytes.addLabelsToExpression(e);
  const v = e.value();
  if (v === false) {
    if (quiet) {
      return 0;
    }
    e.validateNoLabelsNeeded("Expecting constant number");
    throw "Expecting constant number";
  }
  return v;
}

function parseExpr(line: ITok[], ctable: ConstTable): Expression {
  const expr = ExpressionBuilder.parse(line, [], ctable);
  if (expr === false) {
    throw "Expecting constant expression";
  }
  return expr.build([]);
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
  state: IParseState,
  line: ITok[],
  defaults: (number | false)[],
  error: string,
): number[] {
  const result: number[] = [];
  for (const def of defaults) {
    if (def === false || line.length > 0) {
      result.push(parseNum(state, line));
      if (isNextId(line, ",")) {
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
):
  | { include: string }
  | { embed: string }
  | { stdlib: true }
  | { extlib: true }
  | undefined {
  switch (cmd) {
    case ".error": {
      const format = line.shift();
      if (!format || format.kind !== TokEnum.STR) {
        throw "Invalid .error statement";
      }
      const args: number[] = [];
      while (isNextId(line, ",")) {
        line.shift();
        args.push(parseNum(state, line));
      }
      if (line.length > 0) {
        throw "Invalid .error statement";
      }
      throw printf(format.str, ...args);
    }
    case ".base": {
      const amount = parseNum(state, line);
      if (line.length > 0) {
        throw "Invalid .base statement";
      }
      if (state.blockBase) {
        throw "Cannot use .base after other statements";
      }
      state.bytes.setBase(amount);
      break;
    }
    case ".arm":
      if (line.length > 0) {
        throw "Invalid .arm statement";
      }
      state.bytes.align(4);
      setARM(state, true);
      break;
    case ".thumb":
      if (line.length > 0) {
        throw "Invalid .thumb statement";
      }
      state.bytes.align(2);
      setARM(state, false);
      break;
    case ".align": {
      const [amount, fill] = parseNumCommas(
        state,
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
            { v: parseExpr(line, state.ctable) },
            false,
            ({ v }) => v,
          );
        }
        if (line.length > 0) {
          parseComma(line, `Invalid ${cmd} statement`);
        }
      }
      break;
    case ".i8fill":
    case ".b8fill": {
      const [amount, fill] = parseNumCommas(
        state,
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
          { v: parseExpr(line, state.ctable) },
          false,
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
        state,
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
          { v: parseExpr(line, state.ctable) },
          false,
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
        state,
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
      return { stdlib: true };
    case ".extlib":
      return { extlib: true };
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
    case ".crc":
      if (line.length > 0) {
        throw "Invalid .crc statement";
      }
      state.bytes.writeCRC();
      break;
    case ".printf": {
      const format = line.shift();
      if (!format || format.kind !== TokEnum.STR) {
        throw "Invalid .printf statement";
      }
      const args: number[] = [];
      while (isNextId(line, ",")) {
        line.shift();
        args.push(parseNum(state, line));
      }
      if (line.length > 0) {
        throw "Invalid .printf statement";
      }
      state.log(printf(format.str, ...args));
      break;
    }
    case ".pool":
      if (line.length > 0) {
        throw "Invalid .pool statement";
      }
      if (state.bytes.writePool()) {
        state.bytes.align(isARM(state) ? 4 : 2);
      }
      break;
    case ".def": {
      if (!isNextId(line, "$")) {
        throw "Expecting $const after .def";
      }
      line.shift();
      let prefix = "$";
      if (isNextId(line, "$")) {
        line.shift();
        prefix += "$";
      }
      const name = parseName(line);
      if (name === false) {
        throw "Invalid constant name";
      }
      const paramNames: string[] = [];
      if (isNextId(line, "(")) {
        line.shift();
        while (!isNextId(line, ")")) {
          if (!isNextId(line, "$")) {
            throw "Expecting $param inside .def parameter list";
          }
          line.shift();
          if (isNextId(line, "$")) {
            throw "Use $param instead of $$param inside parameter list";
          }
          const pname = parseName(line);
          if (pname === false) {
            throw "Expecting $param inside .def parameter list";
          }
          paramNames.push("$" + pname);
          if (isNextId(line, ",")) {
            line.shift();
          } else {
            break;
          }
        }
        if (!isNextId(line, ")")) {
          throw "Missing `)` at end of parameter list";
        }
        line.shift();
      }
      if (!isNextId(line, "=")) {
        throw "Missing `=` in .def statement";
      }
      line.shift();
      const expr = ExpressionBuilder.parse(line, paramNames, state.ctable);
      if (expr === false) {
        throw "Invalid expression in .def statement";
      }
      if (line.length > 0) {
        throw "Invalid .def statement";
      }
      state.ctable.def(prefix + name, paramNames, expr);
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

function validateNum(
  state: IParseState,
  partNum: number,
  line: ITok[],
): boolean {
  try {
    if (parseNum(state, line) !== partNum) {
      return false;
    }
    return true;
  } catch (_) {
    return false;
  }
}

function validateSymExpr(
  syms: ISyms,
  partSym: string,
  line: ITok[],
  ctable: ConstTable,
  negate: boolean,
): boolean {
  try {
    const expr = ExpressionBuilder.parse(line, [], ctable);
    if (expr === false) {
      return false;
    }
    const ex = expr.build([]);
    if (!negate) {
      syms[partSym] = ex;
      return true;
    }
    const v = ex.value();
    if (v === false || v >= 0) {
      return false;
    }
    syms[partSym] = -v;
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

function calcRotImm(v: number): number | false {
  let r = 0;
  while (v !== 0 && (v & 3) === 0) {
    v >>>= 2;
    r++;
  }
  if ((v & 0xff) !== v) {
    return false;
  }
  return (((16 - r) & 0xf) << 8) | (v & 0xff);
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
        if (!validateNum(state, part.num, line)) {
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
            if (!validateSymExpr(syms, part.sym, line, state.ctable, false)) {
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
    false,
    (syms, address) => {
      const opcode = new BitNumber(32);
      for (const codePart of pb.op.codeParts) {
        switch (codePart.k) {
          case "immediate": {
            const v = syms[codePart.sym];
            if (v < 0 || v >= (1 << codePart.s)) {
              throw `Immediate value out of range 0..${
                (1 << codePart.s) -
                1
              }: ${v}`;
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
            const rotimm = calcRotImm(syms[codePart.sym]);
            if (rotimm === false) {
              throw `Can't generate rotated immediate from ${
                syms[codePart.sym]
              }`;
            }
            opcode.push(12, rotimm);
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
              if (v > 0xff) {
                throw `Offset too large: ${v}`;
              }
              opcode.push(
                codePart.s,
                codePart.low ? v & 0xf : ((v >> 4) & 0xf),
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

interface IPool {
  rd: number;
  ex: Expression;
}

function parsePoolStatement(line: ITok[], ctable: ConstTable): IPool | false {
  // pool statements have a specific format:
  //   op register, =constant
  const trd = line.shift();
  if (!trd || trd.kind !== TokEnum.ID) {
    return false;
  }
  const rd = decodeRegister(trd.id);
  if (rd < 0) {
    return false;
  }

  const tc = line.shift();
  if (!tc || tc.kind !== TokEnum.ID || tc.id !== ",") {
    return false;
  }
  const te = line.shift();
  if (!te || te.kind !== TokEnum.ID || te.id !== "=") {
    return false;
  }

  try {
    const ex = parseExpr(line, ctable);
    return { rd, ex };
  } catch (_) {
    return false;
  }
}

function parseArmPoolStatement(
  state: IParseState,
  flp: IFilePos,
  cmd: string,
  { rd, ex }: IPool,
) {
  let cmdSize = -1;
  let cmdSigned = false;
  let cond = -1;
  for (let ci = 0; ci < Arm.conditionEnum.length && cond < 0; ci++) {
    const ce = Arm.conditionEnum[ci];
    if (ce !== false) {
      for (const cs of ce.split("/")) {
        if (cmd === `ldr${cs}` || (cs !== "" && cmd === `ldr.${cs}`)) {
          cmdSize = 4;
          cond = ci;
        } else if (cmd === `ldrh${cs}` || (cs !== "" && cmd === `ldrh.${cs}`)) {
          cmdSize = 2;
          cond = ci;
        } else if (
          cmd === `ldrsh${cs}` || (cs !== "" && cmd === `ldrsh.${cs}`)
        ) {
          cmdSize = 2;
          cmdSigned = true;
          cond = ci;
        } else if (
          cmd === `ldrsb${cs}` || (cs !== "" && cmd === `ldrsb.${cs}`)
        ) {
          cmdSize = 1;
          cond = ci;
        } else {
          continue;
        }
        break;
      }
    }
  }
  if (cond < 0) {
    throw "Invalid arm pool statement";
  }

  if (cmdSize === 4) {
    state.bytes.expr32(
      errorString(flp, "Incomplete statement"),
      { ex },
      { align: 4, bytes: 4, sym: "ex" },
      ({ ex }, _) => {
        const mov = calcRotImm(ex);
        if (mov !== false) {
          // convert to: mov rd, #expression
          // cond 0011 1010 0000 rd mov
          return (
            (cond << 28) |
            0x03a00000 |
            (rd << 12) |
            mov
          );
        }
        const mvn = calcRotImm(~ex);
        if (mvn !== false) {
          // convert to: mvn rd, #expression
          // cond 0011 1110 0000 rd mvn
          return (
            (cond << 28) |
            0x03e00000 |
            (rd << 12) |
            mvn
          );
        }
        return false;
      },
      (_, address, poolAddress) => {
        // convert to: ldr rd, [pc, #offset]
        // cond 0111 1001 1111 rd offset
        const offset = poolAddress - address - 8;
        if (offset < -4) {
          throw new Error("Pool offset shouldn't be negative");
        } else if (offset > 0xfff) {
          throw "Next .pool too far away";
        }
        return offset < 0
          ? ((cond << 28) | 0x051f0000 | (rd << 12) | Math.abs(offset))
          : ((cond << 28) | 0x059f0000 | (rd << 12) | offset);
      },
    );
  } else if (cmdSize === 2) {
    state.bytes.expr32(
      errorString(flp, "Incomplete statement"),
      { ex },
      { align: 2, bytes: 2, sym: "ex" },
      () => false,
      (_, address, poolAddress) => {
        // convert to: ldrh rd, [pc, #offset]
        const offset = poolAddress - address - 8;
        if (offset < -4) {
          throw new Error("Pool offset shouldn't be negative");
        } else if (offset > 0xff) {
          throw "Next .pool too far away";
        }
        const mask = (((Math.abs(offset) >> 4) & 0xf) << 8) |
          Math.abs(offset) & 0xf;
        const s = cmdSigned ? 0xf0 : 0xb0;
        return offset < 0
          ? ((cond << 28) | 0x015f0000 | s | (rd << 12) | mask)
          : ((cond << 28) | 0x01df0000 | s | (rd << 12) | mask);
      },
    );
  } else { // cmdSize === 1
    state.bytes.expr32(
      errorString(flp, "Incomplete statement"),
      { ex },
      { align: 1, bytes: 1, sym: "ex" },
      () => false,
      (_, address, poolAddress) => {
        // convert to: ldrh rd, [pc, #offset]
        const offset = poolAddress - address - 8;
        if (offset < -4) {
          throw new Error("Pool offset shouldn't be negative");
        } else if (offset > 0xff) {
          throw "Next .pool too far away";
        }
        const mask = (((Math.abs(offset) >> 4) & 0xf) << 8) |
          Math.abs(offset) & 0xf;
        return offset < 0
          ? ((cond << 28) | 0x015f00d0 | (rd << 12) | mask)
          : ((cond << 28) | 0x01df00d0 | (rd << 12) | mask);
      },
    );
  }
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
        if (!validateNum(state, part.num, line)) {
          return false;
        }
        break;
      case "sym": {
        const codePart = part.codeParts[0];
        switch (codePart.k) {
          case "word":
          case "negword":
          case "halfword":
          case "shalfword":
          case "immediate":
          case "pcoffset":
          case "offsetsplit":
            if (
              !validateSymExpr(
                syms,
                part.sym,
                line,
                state.ctable,
                codePart.k === "negword",
              )
            ) {
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
          throw `Immediate value out of range 0..${
            ((1 << size) - 1) <<
            shift
          }: ${v}`;
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
          case "negword":
            pushAlign(codePart.s, syms[codePart.sym], 2);
            break;
          case "halfword":
            pushAlign(codePart.s, syms[codePart.sym], 1);
            break;
          case "shalfword": {
            const offset = syms[codePart.sym] - address - 4;
            if (offset < -(1 << codePart.s) || offset >= (1 << codePart.s)) {
              throw `Offset too large: ${offset}`;
            } else if (offset & 1) {
              throw "Can't branch to misaligned memory address";
            }
            opcode.push(codePart.s, offset >> 1);
            break;
          }
          case "pcoffset": {
            const offset = syms[codePart.sym] - (address & 0xfffffffd) - 4;
            if (offset < 0) {
              throw "Can't load from address before PC in thumb mode";
            } else if (offset & 3) {
              throw "Can't load from misaligned address";
            }
            pushAlign(codePart.s, offset, 2);
            break;
          }
          case "offsetsplit": {
            const offset = syms[codePart.sym] - address - 4;
            if (offset < -4194304 || offset >= 4194304) {
              throw `Offset too large: ${offset}`;
            } else if (offset & 1) {
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
    state.bytes.expr32(es, syms, false, writer(32));
  } else {
    state.bytes.expr16(es, syms, false, writer(16));
  }
  return true;
}

function parseThumbPoolStatement(
  state: IParseState,
  flp: IFilePos,
  cmd: string,
  { rd, ex }: IPool,
) {
  if (cmd !== "ldr") {
    throw "Invalid thumb pool statement";
  }
  state.bytes.expr16(
    errorString(flp, "Incomplete statement"),
    { ex },
    { align: 4, bytes: 4, sym: "ex" },
    ({ ex }, address) => {
      // convert to: add rd, pc, #offset
      const offset = ex - (address & 0xfffffffd) - 4;
      if (offset >= 0 && offset <= 1020 && (offset & 3) === 0) {
        return 0xa000 | (rd << 8) | (offset >> 2);
      }
      return false;
    },
    (_, address, poolAddress) => {
      // convert to: ldr rd, [pc, #offset]
      const offset = poolAddress - (address & 0xfffffffd) - 4;
      if (offset < 0) {
        throw new Error("Pool offset shouldn't be negative");
      } else if (offset & 3) {
        throw "Can't load from misaligned address";
      } else if (offset > 0x3fc) {
        throw "Next .pool too far away";
      }
      return 0x4800 | (rd << 8) | (offset >> 2);
    },
  );
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

function recalcActive(state: IParseState): boolean {
  return state.dotStack.every((ds) => ds.kind !== "if" || ds.isTrue);
}

function parseBlockStatement(
  state: IParseState,
  line: ITok[],
  cmd: string,
  flp: IFilePos,
): boolean {
  const ds = state.dotStack[state.dotStack.length - 1];
  switch (cmd) {
    case ".begin":
      if (line.length > 0 && state.active) {
        throw "Invalid .begin statement";
      }
      if (state.active) {
        state.ctable.scopeBegin();
        state.bytes.scopeBegin();
      }
      state.dotStack.push({ kind: "begin", arm: isARM(state), flp });
      return true;
    case ".script":
      if (line.length > 0 && state.active) {
        throw "Invalid .script statement";
      }
      if (state.active) {
        const body: ILineStr[] = [];
        const startFile = path.basename(flp.filename);
        const scr = sink.scr_new(
          {
            f_fstype: (_scr: sink.scr, file: string): Promise<sink.fstype> => {
              if (file === flp.filename) {
                return Promise.resolve(sink.fstype.FILE);
              }
              return state.fileType(file);
            },
            f_fsread: async (scr: sink.scr, file: string): Promise<boolean> => {
              if (file === flp.filename) {
                await sink.scr_write(
                  scr,
                  body.map((b) => b.data).join("\n"),
                  body[0]?.line ?? 1,
                );
                return true;
              }
              try {
                const data = await state.readBinaryFile(file);
                let text = "";
                for (const b of data) {
                  text += String.fromCharCode(b);
                }
                await sink.scr_write(scr, text, body[0]?.line ?? 1);
                return true;
              } catch (_e) {
                // ignore errors
              }
              return false;
            },
          },
          path.dirname(flp.filename),
          state.posix,
          false,
        );
        sink.scr_addpath(scr, ".");
        loadLibIntoScript(scr);
        state.script = { scr, startFile, body };
      } else {
        state.script = true; // we're in a script, but we're ignoring it
      }
      state.dotStack.push({ kind: "script", flp });
      return true;
    case ".once": {
      if (line.length > 0 && state.active) {
        throw "Invalid .once statement";
      }
      const key = flpString(flp);
      const isTrue = !state.onceFound.has(key);
      state.onceFound.add(key);
      state.dotStack.push({
        kind: "if",
        flp,
        isTrue,
        gotTrue: isTrue,
        gotElse: false,
      });
      state.active = recalcActive(state);
      return true;
    }
    case ".if": {
      const v = parseNum(state, line, !state.active);
      if (line.length > 0 && state.active) {
        throw "Invalid .if statement";
      }
      state.dotStack.push({
        kind: "if",
        flp,
        isTrue: v !== 0,
        gotTrue: v !== 0,
        gotElse: false,
      });
      state.active = recalcActive(state);
      return true;
    }
    case ".elseif": {
      const v = parseNum(state, line, !state.active);
      if (line.length > 0 && state.active) {
        throw "Invalid .elseif statement";
      }
      if (!ds || ds.kind !== "if") {
        throw "Unexpected .elseif statement, missing .if";
      }
      if (ds.gotElse) {
        throw "Cannot have .elseif statement after .else";
      }
      if (ds.gotTrue) {
        ds.isTrue = false;
      } else {
        ds.isTrue = v !== 0;
        ds.gotTrue = v !== 0;
      }
      state.active = recalcActive(state);
      return true;
    }
    case ".else": {
      if (line.length > 0 && state.active) {
        throw "Invalid .else statement";
      }
      if (!ds || ds.kind !== "if") {
        throw "Unexpected .else statement, missing .if";
      }
      if (ds.gotElse) {
        throw "Cannot have more than one .else statement";
      }
      ds.gotElse = true;
      ds.isTrue = !ds.gotTrue;
      ds.gotTrue = true;
      state.active = recalcActive(state);
      return true;
    }
    case ".struct": {
      let cname = "";
      let nextByte = 0;
      try {
        let prefix = "";
        if (!state.struct) {
          if (!isNextId(line, "$")) {
            throw "Expecting $const after .struct";
          }
          line.shift();
          prefix = "$";
          if (isNextId(line, "$")) {
            line.shift();
            prefix += "$";
          }
        }
        const name = parseName(line);
        if (name === false) {
          throw "Invalid .struct name";
        }
        if (isNextId(line, "=")) {
          line.shift();
          nextByte = parseNum(state, line);
        }
        if (line.length > 0) {
          throw "Invalid .struct statement";
        }
        cname = prefix + name;
      } catch (e) {
        if (state.active) {
          throw e;
        }
      }
      state.dotStack.push({
        kind: "struct",
        flp,
      });
      if (state.struct) {
        state.struct.prefix.push(cname);
      } else {
        state.struct = {
          nextByte,
          prefix: [cname],
          defines: [],
        };
      }
      return true;
    }
    case ".s8":
    case ".s16":
    case ".s32": {
      if (!state.struct) {
        if (state.active) {
          throw `Can't use ${cmd} outside of .struct`;
        } else {
          return true;
        }
      }

      const names: [string, number][] = [];
      while (line.length > 0) {
        const name = parseName(line);
        if (name === false) {
          if (state.active) {
            throw `Invalid ${cmd} name`;
          }
          return true;
        }
        let array = 1;
        if (isNextId(line, "[")) {
          line.shift();
          array = parseNum(state, line, !state.active);
          if (array < 1) {
            if (state.active) {
              throw `Invalid ${cmd} array length for "${name}"`;
            }
            return true;
          }
          if (!isNextId(line, "]")) {
            if (state.active) {
              throw `Invalid ${cmd} array for "${name}"`;
            }
            return true;
          }
          line.shift();
        }
        names.push([name, array]);
        if (!isNextId(line, ",")) {
          break;
        }
        line.shift();
      }

      if (line.length > 0 || !state.active) {
        if (state.active) {
          throw `Invalid ${cmd} statement`;
        } else {
          return true;
        }
      }

      const size = cmd === ".s8" ? 1 : cmd === ".s16" ? 2 : 4;
      for (const [name, array] of names) {
        while ((state.struct.nextByte % size) !== 0) {
          state.struct.nextByte++;
        }
        state.struct.defines.push({
          name: [...state.struct.prefix, name].join("."),
          value: state.struct.nextByte,
        }, {
          name: [...state.struct.prefix, name, "length"].join("."),
          value: array,
        }, {
          name: [...state.struct.prefix, name, "bytes"].join("."),
          value: size * array,
        });
        state.struct.nextByte += size * array;
      }
      return true;
    }
    case ".end":
      if (line.length > 0 && state.active) {
        throw "Invalid .end statement";
      }
      if (
        !ds ||
        (ds.kind !== "begin" && ds.kind !== "if" && ds.kind !== "struct" &&
          ds.kind !== "script")
      ) {
        throw "Unexpected .end statement";
      }
      state.dotStack.pop();
      if (ds.kind === "begin" && state.active) {
        state.ctable.scopeEnd();
        state.bytes.scopeEnd();
        if (ds.arm !== isARM(state)) {
          // if we're switching Thumb <-> ARM due to .end, then realign
          state.bytes.align(ds.arm ? 2 : 4);
        }
      } else if (ds.kind === "if") {
        state.active = recalcActive(state);
      } else if (ds.kind === "struct") {
        if (!state.struct) {
          throw new Error("Expecting struct in parse state");
        }
        state.struct.prefix.pop();
        if (state.struct.prefix.length <= 0) {
          // all done!
          if (state.active) {
            for (const { name, value } of state.struct.defines) {
              state.ctable.defNum(name, value);
            }
          }
          state.struct = false;
        }
      }
      return true;
    case ".macro":
    case ".endm":
      throw "TODO: .macro/.endm";
  }
  return false;
}

function parseLine(
  state: IParseState,
  line: ITok[],
):
  | { include: string }
  | { embed: string }
  | { stdlib: true }
  | { extlib: true }
  | undefined {
  if (!state.struct) {
    // check for labels
    while (true) {
      let label;
      try {
        label = parseLabel(line);
      } catch (e) {
        if (state.active) {
          throw e;
        } else {
          return;
        }
      }
      if (label !== false) {
        if (
          line.length <= 0 || line[0].kind !== TokEnum.ID || line[0].id !== ":"
        ) {
          if (state.active) {
            throw "Missing colon after label";
          } else {
            return;
          }
        }
        line.shift();
        if (state.active) {
          state.bytes.addLabel(label);
        }
      } else {
        break;
      }
    }
  }

  if (line.length <= 0) {
    return;
  }

  const cmdTok = line.shift();
  if (!cmdTok || cmdTok.kind !== TokEnum.ID) {
    if (state.active) {
      throw "Invalid statement";
    } else {
      return;
    }
  }
  const cmd = cmdTok.id;

  // check for block-level dot statements
  if (parseBlockStatement(state, line, cmd, cmdTok.flp)) {
    return;
  }

  if (!state.active) {
    return;
  }
  if (state.struct) {
    throw "Cannot have regular statements inside .struct";
  }

  if (cmd.startsWith(".")) {
    return parseDotStatement(state, cmd, line);
  } else if (isARM(state)) {
    const pool = parsePoolStatement([...line], state.ctable);
    if (pool) {
      parseArmPoolStatement(state, cmdTok.flp, cmd, pool);
    } else {
      const ops = Arm.parsedOps[cmd];
      if (!ops) {
        throw `Unknown arm statement: ${cmd}`;
      }
      let lastError = "Failed to parse arm statement";
      if (
        !ops.some((op) => {
          try {
            return parseArmStatement(state, cmdTok.flp, op, [...line]);
          } catch (e) {
            if (typeof e === "string") {
              lastError = e;
              return false;
            }
            throw e;
          }
        })
      ) {
        throw lastError;
      }
    }
  } else {
    const pool = parsePoolStatement([...line], state.ctable);
    if (pool) {
      parseThumbPoolStatement(state, cmdTok.flp, cmd, pool);
    } else {
      const ops = Thumb.parsedOps[cmd];
      if (!ops) {
        throw `Unknown thumb statement: ${cmd}`;
      }
      let lastError = "Failed to parse thumb statement";
      if (
        !ops.some((op) => {
          try {
            return parseThumbStatement(state, cmdTok.flp, op, [...line]);
          } catch (e) {
            if (typeof e === "string") {
              lastError = e;
              return false;
            }
            throw e;
          }
        })
      ) {
        throw lastError;
      }
    }
  }
}

function isARM(state: IParseState): boolean {
  for (let i = state.dotStack.length - 1; i >= 0; i--) {
    const ds = state.dotStack[i];
    if (ds.kind === "begin") {
      return ds.arm;
    }
  }
  return state.arm;
}

function setARM(state: IParseState, arm: boolean) {
  for (let i = state.dotStack.length - 1; i >= 0; i--) {
    const ds = state.dotStack[i];
    if (ds.kind === "begin") {
      ds.arm = arm;
      return;
    }
  }
  state.arm = arm;
}

export async function makeFromFile(
  filename: string,
  posix: boolean,
  isAbsolute: (filename: string) => boolean,
  fileType: (filename: string) => Promise<sink.fstype>,
  readTextFile: (filename: string) => Promise<string>,
  readBinaryFile: (filename: string) => Promise<number[] | Uint8Array>,
  log: (str: string) => void,
): Promise<{ result: readonly number[] } | { errors: string[] }> {
  let data;
  try {
    data = await readTextFile(filename);
  } catch (_) {
    return { errors: [`Failed to read file: ${filename}`] };
  }

  const lineStrs = splitLines(filename, data, true);
  const lx = lexNew();
  const state: IParseState = {
    arm: true,
    main: true,
    bytes: new Bytes(),
    ctable: new ConstTable((cname) => {
      if (cname === "$_version") {
        return version;
      } else if (cname === "$_arm") {
        return isARM(state) ? 1 : 0;
      } else if (cname === "$_thumb") {
        return !isARM(state) ? 1 : 0;
      } else if (cname === "$_main") {
        return state.main ? 1 : 0;
      } else if (cname === "$_here") {
        return state.bytes.nextAddress();
      } else if (cname === "$_pc") {
        return state.bytes.nextAddress() + (isARM(state) ? 8 : 4);
      } else if (cname === "$_base") {
        return state.bytes.getBase();
      }
      return false;
    }),
    blockBase: false,
    active: true,
    struct: false,
    dotStack: [],
    script: false,
    store: {},
    onceFound: new Set(),
    posix,
    fileType,
    readBinaryFile,
    log,
  };

  const alreadyIncluded = new Set<string>();
  const tokens: ITok[] = [];
  let lineStr;
  while ((lineStr = lineStrs.shift())) {
    const { filename, line, data } = lineStr;
    state.main = lineStr.main;
    if (state.script) {
      // process sink script
      const tok = lexAddLine({ ...lx }, filename, line, data).shift();
      if (tok && tok.kind === TokEnum.ID && tok.id === ".end") {
        if (state.script === true) {
          // ignored script section
          state.script = false;
          lineStrs.unshift(lineStr);
        } else {
          if (
            await sink.scr_loadfile(state.script.scr, state.script.startFile)
          ) {
            const put: ILineStr[] = [];
            const ctx = sink.ctx_new(state.script.scr, {
              f_say: (_ctx: sink.ctx, str: sink.str): Promise<sink.val> => {
                log(str);
                return Promise.resolve(sink.NIL);
              },
              f_warn: () => Promise.resolve(sink.NIL),
              f_ask: () => Promise.resolve(sink.NIL),
            });
            loadLibIntoContext(ctx, put, state.store, lineStr.main);
            const run = await sink.ctx_run(ctx);
            if (run === sink.run.PASS) {
              lineStrs.unshift(...put, lineStr);
              state.script = false;
            } else {
              return {
                errors: [
                  sink.ctx_geterr(ctx) ??
                    errorString({ ...lineStr, chr: 1 }, "Failed to run script"),
                ],
              };
            }
          } else {
            return {
              errors: [
                sink.scr_geterr(state.script.scr) ??
                  errorString(
                    { ...lineStr, chr: 1 },
                    "Failed to compile script",
                  ),
              ],
            };
          }
        }
      } else {
        if (state.script !== true) { // if not ignored
          state.script.body.push(lineStr);
        }
      }
    } else {
      // process assembly
      tokens.push(...lexAddLine(lx, filename, line, data));

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

      if (
        tokens.length > 0 && tokens[tokens.length - 1].kind === TokEnum.NEWLINE
      ) {
        tokens.pop(); // remove newline
        if (tokens.length > 0) {
          const flp = tokens[0].flp;
          try {
            const includeEmbed = parseLine(state, tokens);
            tokens.splice(0, tokens.length); // remove all tokens
            state.blockBase = true;

            if (includeEmbed && "stdlib" in includeEmbed) {
              lineStrs.unshift(...splitLines("stdlib", stdlib, false));
            } else if (includeEmbed && "extlib" in includeEmbed) {
              lineStrs.unshift(...splitLines("extlib", extlib, false));
            } else if (includeEmbed && "include" in includeEmbed) {
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

              lineStrs.unshift(...splitLines(full, data2, false));
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
          } catch (e) {
            if (typeof e === "string") {
              return { errors: [errorString(flp, e)] };
            }
            throw e;
          }
        }
      }
    }
  }

  // all done, verify that we don't have any open blocks
  const ds = state.dotStack[state.dotStack.length - 1];
  if (ds) {
    return {
      errors: [errorString(
        ds.flp,
        `Missing .end${
          ds.kind === "macro" ? "m" : ""
        } for .${ds.kind} statement`,
      )],
    };
  }

  let result;
  try {
    result = state.bytes.get();
  } catch (e) {
    if (typeof e === "string") {
      return { errors: [e] };
    }
    throw e;
  }
  return { result };
}

export async function make({ input, output }: IMakeArgs): Promise<number> {
  try {
    const result = await makeFromFile(
      input,
      path.sep === "/",
      path.isAbsolute,
      async (file: string) => {
        const st = await Deno.stat(file);
        if (st !== null) {
          if (st.isFile) {
            return sink.fstype.FILE;
          } else if (st.isDirectory) {
            return sink.fstype.DIR;
          }
        }
        return sink.fstype.NONE;
      },
      Deno.readTextFile,
      Deno.readFile,
      (str) => console.log(str),
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
      console.error(e);
      console.error("Unknown fatal error");
    }
    return 1;
  }
}
