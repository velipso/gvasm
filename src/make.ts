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
import { Expression, ExpressionBuilder } from "./expr.ts";
import { Bytes } from "./bytes.ts";
import { path } from "./deps.ts";
import { ConstTable } from "./const.ts";
import { version } from "./main.ts";
import { stdlib } from "./stdlib.ts";

export interface IMakeArgs {
  input: string;
  output: string;
}

interface IParseState {
  arm: boolean;
  bytes: Bytes;
  ctable: ConstTable;
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

export function isNextId(line: ITok[], id: string): boolean {
  return line.length > 0 && line[0].kind === TokEnum.ID && line[0].id === id;
}

function parseComma(line: ITok[], error: string) {
  if (line[0].kind === TokEnum.ID && line[0].id === ",") {
    line.shift();
  } else {
    throw error;
  }
}

function parseNum(line: ITok[], ctable: ConstTable): number {
  const expr = ExpressionBuilder.parse(line, [], ctable);
  if (expr === false) {
    throw "Expecting constant number";
  }
  const v = expr.build([]).value();
  if (v === false) {
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
  line: ITok[],
  defaults: (number | false)[],
  ctable: ConstTable,
  error: string,
): number[] {
  const result: number[] = [];
  for (const def of defaults) {
    if (def === false || line.length > 0) {
      result.push(parseNum(line, ctable));
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
): { include: string } | { embed: string } | { stdlib: true } | undefined {
  switch (cmd) {
    case ".error":
      if (line.length === 1 && line[0].kind === TokEnum.STR) {
        throw line[0].str;
      } else {
        throw "Invalid .error statement";
      }
    case ".base": {
      const amount = parseNum(line, state.ctable);
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
        state.ctable,
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
        state.ctable,
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
        line,
        [false, 0],
        state.ctable,
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
        line,
        [false, 0],
        state.ctable,
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
    case ".crc":
      if (line.length > 0) {
        throw "Invalid .crc statement";
      }
      state.bytes.writeCRC();
      break;
    case ".begin":
      if (line.length > 0) {
        throw "Invalid .begin statement";
      }
      state.ctable.scopeBegin();
      state.bytes.scopeBegin();
      break;
    case ".end":
      if (line.length > 0) {
        throw "Invalid .end statement";
      }
      state.ctable.scopeEnd();
      state.bytes.scopeEnd();
      break;
    case ".if":
    case ".elseif":
    case ".else":
    case ".endif":
      throw "TODO: .if/.elseif/.else/.endif";
    case ".printf":
      throw "TODO: .printf";
    case ".pool":
      if (line.length > 0) {
        throw "Invalid .pool statement";
      }
      if (state.bytes.writePool()) {
        state.bytes.align(state.arm ? 4 : 2);
      }
      break;
    case ".defx": {
      if (!isNextId(line, "$")) {
        throw "Expecting $const after .defx";
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
            throw "Expecting $param inside .defx parameter list";
          }
          line.shift();
          if (isNextId(line, "$")) {
            throw "Use $param instead of $$param inside parameter list";
          }
          const pname = parseName(line);
          if (pname === false) {
            throw "Expecting $param inside .defx parameter list";
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
        throw "Missing `=` in .defx statement";
      }
      line.shift();
      const expr = ExpressionBuilder.parse(line, paramNames, state.ctable);
      if (expr === false) {
        throw "Invalid expression in .defx statement";
      }
      if (line.length > 0) {
        throw "Invalid .defx statement";
      }
      state.ctable.defx(prefix + name, paramNames, expr);
      break;
    }
    case ".defm":
    case ".endm":
      throw "TODO: .defm/.endm";
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
  partNum: number,
  line: ITok[],
  ctable: ConstTable,
): boolean {
  try {
    if (parseNum(line, ctable) !== partNum) {
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
): boolean {
  try {
    const expr = ExpressionBuilder.parse(line, [], ctable);
    if (expr === false) {
      return false;
    }
    syms[partSym] = expr.build([]);
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
        if (!validateNum(part.num, line, state.ctable)) {
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
            if (!validateSymExpr(syms, part.sym, line, state.ctable)) {
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
        if (!validateNum(part.num, line, state.ctable)) {
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
            if (!validateSymExpr(syms, part.sym, line, state.ctable)) {
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
    ({ ex }, _) => {
      if (ex >= 0 && ex < 256) {
        // convert to: mov rd, #expression
        return 0x2000 | (rd << 8) | ex;
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

function parseLine(
  state: IParseState,
  line: ITok[],
): { include: string } | { embed: string } | { stdlib: true } | undefined {
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
    ctable: new ConstTable((cname) => {
      if (cname === "$_version") {
        return version;
      } else if (cname === "$_arm") {
        return state.arm ? 1 : 0;
      } else if (cname === "$_thumb") {
        return state.arm ? 0 : 1;
      } else if (cname === "$_here") {
        return state.bytes.nextAddress();
      } else if (cname === "$_pc") {
        return state.bytes.nextAddress() + (state.arm ? 8 : 4);
      }
      return false;
    }),
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

        if (includeEmbed && "stdlib" in includeEmbed) {
          const tokens2 = lex("stdlib", stdlib);
          if (tokens2.some((t) => t.kind === TokEnum.ERROR)) {
            throw new Error("Error inside .stdlib");
          }
          tokens.splice(0, 0, ...tokens2);
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

      // all done, verify that we aren't missing an .end statement
      state.ctable.verifyNoMissingEnd();
    } catch (e) {
      if (typeof e === "string") {
        return { errors: [errorString(flp, e)] };
      }
      throw e;
    }
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
