//
// gvasm - Assembler and disassembler for Game Boy Advance homebrew
// by Sean Connelly (@velipso), https://sean.cm
// Project Home: https://github.com/velipso/gvasm
// SPDX-License-Identifier: 0BSD
//

import { IFilePos, ILexKeyValue, ITok } from './lexer.ts';
import { ARM, Thumb } from './ops.ts';
import { assertNever } from './util.ts';
import { Expression } from './expr.ts';
import { DataType, Import, IStruct, IStructMember, ISyms } from './import.ts';

export class Parser {
  i = 0;
  iStack: number[] = [];
  tks: ITok[];

  constructor(tks: ITok[]) {
    this.tks = tks;
  }

  insert(tks: ITok[]) {
    const before = this.tks.slice(0, this.i);
    const after = this.tks.slice(this.i);
    this.tks = before.concat(tks).concat(after);
  }

  here(): IFilePos {
    if (this.tks.length <= 0) {
      return { filename: '', line: 1, chr: 1 };
    }
    if (this.i >= this.tks.length) {
      return this.tks[this.tks.length - 1];
    }
    return this.tks[this.i];
  }

  last(): IFilePos {
    if (this.tks.length <= 0) {
      return { filename: '', line: 1, chr: 1 };
    }
    if (this.i >= this.tks.length) {
      return this.tks[this.tks.length - 1];
    }
    return this.tks[Math.max(0, this.i - 1)];
  }

  save() {
    this.iStack.push(this.i);
  }

  applySave() {
    if (this.iStack.length <= 0) {
      throw new Error('Unbalanced parser save/restore');
    }
    this.iStack.pop();
  }

  restore() {
    const i = this.iStack.pop();
    if (i === undefined) {
      throw new Error('Unbalanced parser save/restore');
    }
    this.i = i;
  }

  trim() {
    while (this.i < this.tks.length && this.tks[this.i].kind === 'newline') {
      this.i++;
    }
  }

  hasTok(amount = 1) {
    return this.i + amount <= this.tks.length;
  }

  nextTok(): ITok {
    if (this.i >= this.tks.length) {
      throw new CompError(
        this.tks.length <= 0 ? { filename: '', line: 1, chr: 1 } : this.tks[this.tks.length - 1],
        'Unexpected end of file',
      );
    }
    this.i++;
    return this.tks[this.i - 1];
  }

  nextTokOptional(): ITok | undefined {
    const tk = this.tks[this.i];
    if (tk) this.i++;
    return tk;
  }

  peekTokOptional(): ITok | undefined {
    return this.tks[this.i];
  }

  isNext(str: string): boolean {
    const tk = this.tks[this.i];
    return tk && (
      (tk.kind === 'id' && tk.id === str) ||
      (tk.kind === 'punc' && tk.punc === str)
    );
  }

  isNext2(str1: string, str2: string): boolean {
    const tk1 = this.tks[this.i];
    const tk2 = this.tks[this.i + 1];
    return tk1 && tk2 && (
      (tk1.kind === 'id' && tk1.id === str1) ||
      (tk1.kind === 'punc' && tk1.punc === str1)
    ) && (
      (tk2.kind === 'id' && tk2.id === str2) ||
      (tk2.kind === 'punc' && tk2.punc === str2)
    );
  }

  checkDotStatement(id: string): boolean {
    if (this.i + 2 > this.tks.length) {
      return false;
    }
    const tk1 = this.tks[this.i];
    if (tk1.kind !== 'punc' || tk1.punc !== '.') {
      return false;
    }
    const tk2 = this.tks[this.i + 1];
    if (tk2.kind !== 'id' || tk2.id !== id) {
      return false;
    }
    this.i += 2;
    return true;
  }

  checkEnd(): boolean {
    if (this.checkDotStatement('end')) {
      this.forceNewline('`.end` statement');
      return true;
    }
    return false;
  }

  checkElse(): boolean {
    if (this.checkDotStatement('else')) {
      this.forceNewline('`.else` statement');
      return true;
    }
    return false;
  }

  checkElseif(): boolean {
    return this.checkDotStatement('elseif');
  }

  checkNewline() {
    const tk = this.tks[this.i];
    if (!tk) {
      return true;
    } else if (tk.kind === 'newline') {
      this.i++;
      return true;
    } else {
      return false;
    }
  }

  forceNewline(hint: string) {
    const tk = this.tks[this.i];
    if (!tk) {
      return;
    }
    if (tk.kind !== 'newline') {
      throw new CompError(tk, `Missing newline at end of ${hint}`);
    }
    this.i++;
  }
}

export class CompError extends Error {
  errors: { flp: IFilePos | false; message: string }[];

  constructor(flp: IFilePos | false, message: string) {
    super(message);
    this.errors = [{ flp, message }];
  }

  static errorString({ filename, line, chr }: IFilePos, msg: string) {
    if (!filename) {
      return `${line}:${chr}: ${msg}`;
    }
    return `${filename}:${line}:${chr}: ${msg}`;
  }

  static extend(e: unknown, flp: IFilePos | false, message: string) {
    if (e instanceof CompError) {
      e.addError(flp, message);
      return e;
    }
    if (e instanceof Error) {
      throw e;
    }
    return new CompError(flp, message);
  }

  addError(flp: IFilePos | false, message: string) {
    this.errors.push({ flp, message });
  }

  mapFilenames(cb: (filename: string) => string) {
    for (const e of this.errors) {
      if (e.flp && e.flp.filename) {
        e.flp.filename = cb(e.flp.filename);
      }
    }
  }

  toErrors(): string[] {
    return this.errors.map((e) => e.flp ? CompError.errorString(e.flp, e.message) : e.message);
  }

  toString() {
    return this.toErrors().join('\n');
  }
}

function parseReglist(
  width: 8 | 16,
  registerRequired: number | false,
  parser: Parser,
  imp: Import,
): number | false {
  let state = 0;
  let reglist = 0;
  let lastRegister = -1;
  let done = false;
  const setFlag = (bit: number): boolean => {
    // can't set bit out of range
    if ((bit < 0 || bit >= width) && bit !== registerRequired) {
      return false;
    }
    // can't set same bit twice
    const mask = 1 << bit;
    if (reglist & mask) {
      return false;
    }
    reglist |= mask;
    return true;
  };
  while (!done) {
    const t = parser.nextTokOptional();
    if (!t) {
      return false;
    }
    switch (state) {
      case 0: // read open brace
        if (t.kind === 'punc' && t.punc === '{') {
          state = 1;
        } else {
          return false;
        }
        break;
      case 1: // read register
        if (t.kind === 'punc' && t.punc === '}') {
          done = true;
        } else if (t.kind === 'id') {
          lastRegister = imp.decodeRegister(t, false);
          if (lastRegister < 0) {
            return false;
          }
          state = 2;
        } else {
          return false;
        }
        break;
      case 2: // after register
        if (t.kind === 'punc' && t.punc === '}') {
          if (!setFlag(lastRegister)) {
            return false;
          }
          done = true;
        } else if (t.kind === 'punc' && t.punc === ',') {
          if (!setFlag(lastRegister)) {
            return false;
          }
          state = 1;
        } else if (t.kind === 'punc' && t.punc === '-') {
          state = 3;
        } else {
          return false;
        }
        break;
      case 3: // reading end of range
        if (t.kind === 'id') {
          const end = imp.decodeRegister(t, false);
          if (end < 0) {
            return false;
          }
          const first = Math.min(lastRegister, end);
          const last = Math.max(lastRegister, end);
          for (let b = first; b <= last; b++) {
            if (!setFlag(b)) {
              return false;
            }
          }
          state = 4;
        } else {
          return false;
        }
        break;
      case 4: // after range
        if (t.kind === 'punc' && t.punc === '}') {
          done = true;
        } else if (t.kind === 'punc' && t.punc === ',') {
          state = 1;
        } else {
          return false;
        }
        break;
    }
  }
  // verify the required register was set
  if (registerRequired !== false && !(reglist & (1 << registerRequired))) {
    return false;
  }
  return reglist;
}

interface IPool {
  rd: number;
  expr: Expression;
}

function parsePoolStatement(parser: Parser, imp: Import): IPool | false {
  parser.save();
  try {
    const tk1 = parser.nextTokOptional();
    if (!tk1 || tk1.kind !== 'id') {
      parser.restore();
      return false;
    }

    const rd = imp.decodeRegister(tk1, false);
    if (rd < 0) {
      parser.restore();
      return false;
    }

    const tk2 = parser.nextTokOptional();
    if (!tk2 || tk2.kind !== 'punc' || tk2.punc !== ',') {
      parser.restore();
      return false;
    }

    const tk3 = parser.nextTokOptional();
    if (!tk3 || tk3.kind !== 'punc' || tk3.punc !== '=') {
      parser.restore();
      return false;
    }

    // parse rest of expression
    const expr = Expression.parse(parser, imp);
    parser.forceNewline('pool load statement');
    parser.applySave();
    return { rd, expr };
  } catch (_) {
    parser.restore();
    return false;
  }
}

function validateStr(partStr: string, parser: Parser): boolean {
  if (partStr === '') {
    return true;
  }
  const tk = parser.nextTokOptional();
  if (
    tk && (
      (tk.kind === 'id' && tk.id === partStr) ||
      (tk.kind === 'punc' && tk.punc === partStr)
    )
  ) {
    return true;
  }
  return false;
}

function validateNum(partNum: number, parser: Parser, imp: Import): boolean {
  return Expression.parse(parser, imp).value(imp.expressionContext(0), false, false) === partNum;
}

function validateSymExpr(
  syms: ISyms,
  partSym: string,
  negate: boolean,
  parser: Parser,
  imp: Import,
): boolean {
  const ex = Expression.parse(parser, imp);
  if (!negate) {
    syms[partSym] = ex;
    return true;
  }
  const v = ex.value(imp.expressionContext(0), true, false);
  if (v === false || v >= 0) {
    return false;
  }
  syms[partSym] = -v;
  return true;
}

function validateSymRegister(
  syms: ISyms,
  partSym: string,
  low: number,
  high: number,
  parser: Parser,
  imp: Import,
): boolean {
  const t = parser.nextTok();
  if (!t || t.kind !== 'id') {
    return false;
  }
  const reg = imp.decodeRegister(t, false);
  if (reg >= low && reg <= high) {
    syms[partSym] = reg;
    return true;
  }
  return false;
}

function validateSymEnum(
  syms: ISyms,
  partSym: string,
  enums: (string | false)[],
  parser: Parser,
): boolean {
  const valid: { [str: string]: number } = {};
  for (let i = 0; i < enums.length; i++) {
    const en = enums[i];
    if (en === false) {
      continue;
    }
    for (const es of en.split('/')) {
      valid[es] = i;
    }
  }
  const t = parser.peekTokOptional();
  if (t && t.kind === 'id' && t.id in valid) {
    syms[partSym] = valid[t.id];
    parser.nextTok();
    return true;
  } else if (t && t.kind === 'punc' && t.punc in valid) {
    syms[partSym] = valid[t.punc];
    parser.nextTok();
    return true;
  } else if ('' in valid) {
    syms[partSym] = valid[''];
    return true;
  }
  return false;
}

function parseARMStatement(
  flp: IFilePos,
  pb: ARM.IParsedBody,
  parser: Parser,
  imp: Import,
): boolean {
  const syms = { ...pb.syms };
  for (const part of pb.body) {
    switch (part.kind) {
      case 'str':
        if (!validateStr(part.str, parser)) {
          return false;
        }
        break;
      case 'num':
        if (!validateNum(part.num, parser, imp)) {
          return false;
        }
        break;
      case 'sym': {
        const codePart = part.codeParts[0];
        switch (codePart.k) {
          case 'word':
          case 'immediate':
          case 'rotimm':
          case 'offset12':
          case 'pcoffset12':
          case 'offsetsplit':
          case 'pcoffsetsplit':
            if (!validateSymExpr(syms, part.sym, false, parser, imp)) {
              return false;
            }
            break;
          case 'register':
            if (!validateSymRegister(syms, part.sym, 0, 15, parser, imp)) {
              return false;
            }
            break;
          case 'enum':
            if (!validateSymEnum(syms, part.sym, codePart.enum, parser)) {
              return false;
            }
            break;
          case 'reglist': {
            const v = parseReglist(16, false, parser, imp);
            if (v === false) {
              return false;
            }
            syms[part.sym] = v;
            break;
          }
          case 'value':
          case 'ignored':
            throw new Error('Invalid syntax for parsed body');
          default:
            assertNever(codePart);
        }
        break;
      }
      default:
        assertNever(part);
    }
  }

  if (!parser.checkNewline()) {
    return false;
  }
  imp.writeInstARM(flp, pb.op, syms);
  return true;
}

function parseARMPoolStatement(flp: IFilePos, cmd: string, pool: IPool, imp: Import) {
  let cmdSize = -1;
  let cmdSigned = false;
  let cond = -1;
  for (let ci = 0; ci < ARM.conditionEnum.length && cond < 0; ci++) {
    const ce = ARM.conditionEnum[ci];
    if (ce !== false) {
      for (const cs of ce.split('/')) {
        if (cmd === `ldr${cs}` || (cs !== '' && cmd === `ldr.${cs}`)) {
          cmdSize = 4;
          cond = ci;
        } else if (cmd === `ldrh${cs}` || (cs !== '' && cmd === `ldrh.${cs}`)) {
          cmdSize = 2;
          cond = ci;
        } else if (cmd === `ldrsh${cs}` || (cs !== '' && cmd === `ldrsh.${cs}`)) {
          cmdSize = 2;
          cmdSigned = true;
          cond = ci;
        } else if (cmd === `ldrb${cs}` || (cs !== '' && cmd === `ldrb.${cs}`)) {
          cmdSize = 1;
          cond = ci;
        } else if (cmd === `ldrsb${cs}` || (cs !== '' && cmd === `ldrsb.${cs}`)) {
          cmdSize = 1;
          cmdSigned = true;
          cond = ci;
        } else {
          continue;
        }
        break;
      }
    }
  }
  if (cond < 0) {
    throw new CompError(flp, 'Invalid ARM pool statement');
  }
  imp.writePoolARM(flp, cmdSize, cmdSigned, cond, pool.rd, pool.expr);
}

function parseThumbStatement(
  flp: IFilePos,
  pb: Thumb.IParsedBody,
  parser: Parser,
  imp: Import,
): boolean {
  const syms = { ...pb.syms };
  for (const part of pb.body) {
    switch (part.kind) {
      case 'str':
        if (!validateStr(part.str, parser)) {
          return false;
        }
        break;
      case 'num':
        if (!validateNum(part.num, parser, imp)) {
          return false;
        }
        break;
      case 'sym': {
        const codePart = part.codeParts[0];
        switch (codePart.k) {
          case 'word':
          case 'negword':
          case 'halfword':
          case 'shalfword':
          case 'immediate':
          case 'pcoffset':
          case 'offsetsplit':
            if (!validateSymExpr(syms, part.sym, codePart.k === 'negword', parser, imp)) {
              return false;
            }
            break;
          case 'register':
            if (!validateSymRegister(syms, part.sym, 0, 7, parser, imp)) {
              return false;
            }
            break;
          case 'registerhigh':
            if (!validateSymRegister(syms, part.sym, 8, 15, parser, imp)) {
              return false;
            }
            break;
          case 'enum':
            if (!validateSymEnum(syms, part.sym, codePart.enum, parser)) {
              return false;
            }
            break;
          case 'reglist': {
            const v = parseReglist(8, codePart.extra ?? false, parser, imp);
            if (v === false) {
              return false;
            }
            syms[part.sym] = v;
            break;
          }
          case 'value':
          case 'ignored':
            throw new Error('Invalid syntax for parsed body');
          default:
            assertNever(codePart);
        }
        break;
      }
      default:
        assertNever(part);
    }
  }

  if (!parser.checkNewline()) {
    return false;
  }
  imp.writeInstThumb(flp, pb.op, syms);
  return true;
}

function parseThumbPoolStatement(
  flp: IFilePos,
  cmd: string,
  pool: IPool,
  imp: Import,
) {
  if (cmd !== 'ldr') {
    throw new CompError(flp, 'Invalid thumb pool statement');
  }
  imp.writePoolThumb(flp, pool.rd, pool.expr);
}

async function parseBeginBody(parser: Parser, imp: Import) {
  const tk = parser.nextTok();
  switch (tk.kind) {
    case 'punc': {
      if (tk.punc === '-' || tk.punc === '+') {
        let label = tk.punc;
        while (parser.hasTok() && parser.isNext(tk.punc)) {
          parser.nextTok();
          label += tk.punc;
        }
        imp.addSymRelativeLabel(label);
        break;
      }
      if (tk.punc !== '.' || !parser.hasTok()) {
        throw new CompError(tk, 'Invalid statement');
      }
      const tk2 = parser.nextTok();
      switch (tk2.kind) {
        case 'id':
          switch (tk2.id) {
            case 'align': {
              const context = imp.expressionContext(0);
              const amount = Expression.parse(parser, imp).value(context, true, false);
              if (amount === false) {
                throw new CompError(tk, 'Align amount must be constant');
              }
              let fill: number | 'nop' = 0;
              if (parser.isNext(',')) {
                parser.nextTok();
                if (parser.isNext('nop')) {
                  fill = 'nop';
                  parser.nextTok();
                } else {
                  const fillx = Expression.parse(parser, imp).value(context, true, false);
                  if (fillx === false) {
                    throw new CompError(tk, 'Align fill must be constant');
                  }
                  fill = fillx;
                }
              }
              parser.forceNewline('`.align` statement');
              imp.align(tk, amount, fill);
              break;
            }
            case 'arm':
              parser.forceNewline('`.arm` statement');
              imp.setMode('arm');
              break;
            case 'base': {
              const base = Expression.parse(parser, imp).value(
                imp.expressionContext(0),
                true,
                false,
              );
              if (base === false) {
                throw new CompError(tk, 'Base must be constant');
              }
              parser.forceNewline('`.base` statement');
              imp.setBase(base);
              break;
            }
            case 'begin':
              await parseBegin(parser, imp);
              break;
            case 'crc':
              parser.forceNewline('`.crc` statement');
              imp.writeCRC(tk);
              break;
            case 'def': {
              const name = parser.nextTokOptional();
              if (!name || name.kind !== 'id') {
                throw new CompError(name ?? tk, 'Expecting `.def name = value`');
              }
              let paramNames: string[] | undefined;
              if (parser.isNext('(')) {
                parser.nextTok();
                paramNames = [];
                while (!parser.isNext(')')) {
                  const paramName = parser.nextTokOptional();
                  if (!paramName || paramName.kind !== 'id') {
                    throw new CompError(parser.last(), 'Expecting `.def name(arg1, arg2) = value`');
                  }
                  imp.validateNewName(paramName, paramName.id);
                  if (paramNames.includes(paramName.id)) {
                    throw new CompError(
                      parser.last(),
                      `Parameter names must be unique; name used twice: ${paramName.id}`,
                    );
                  }
                  paramNames.push(paramName.id);
                  if (parser.isNext(',')) {
                    parser.nextTok();
                    continue;
                  } else if (parser.isNext(')')) {
                    break;
                  }
                }
                parser.nextTok(); // right paren
              }
              if (parser.isNext('=')) {
                parser.nextTok();
                const body = Expression.parse(parser, imp, paramNames);
                parser.forceNewline('`.def` statement');
                imp.addSymConst(tk, name.id, body);
              } else {
                throw new CompError(parser.here(), 'Expecting `.def name = value`');
              }
              break;
            }
            case 'embed':
              parseEmbed(parser, imp);
              break;
            case 'i8':
            case 'ib8':
            case 'im8':
            case 'ibm8':
            case 'i16':
            case 'ib16':
            case 'im16':
            case 'ibm16':
            case 'i32':
            case 'ib32':
            case 'im32':
            case 'ibm32':
            case 'u8':
            case 'ub8':
            case 'um8':
            case 'ubm8':
            case 'u16':
            case 'ub16':
            case 'um16':
            case 'ubm16':
            case 'u32':
            case 'ub32':
            case 'um32':
            case 'ubm32': {
              const data = [Expression.parse(parser, imp)];
              while (parser.isNext(',')) {
                parser.nextTok();
                data.push(Expression.parse(parser, imp));
              }
              parser.forceNewline(`\`.${tk2.id}\` statement`);
              imp.writeData(tk, tk2.id, data);
              break;
            }
            case 'i8fill':
            case 'ib8fill':
            case 'im8fill':
            case 'ibm8fill':
            case 'i16fill':
            case 'ib16fill':
            case 'im16fill':
            case 'ibm16fill':
            case 'i32fill':
            case 'ib32fill':
            case 'im32fill':
            case 'ibm32fill':
            case 'u8fill':
            case 'ub8fill':
            case 'um8fill':
            case 'ubm8fill':
            case 'u16fill':
            case 'ub16fill':
            case 'um16fill':
            case 'ubm16fill':
            case 'u32fill':
            case 'ub32fill':
            case 'um32fill':
            case 'ubm32fill': {
              const amount = Expression.parse(parser, imp).value(
                imp.expressionContext(0),
                true,
                false,
              );
              if (amount === false) {
                throw new CompError(tk, 'Data fill amount must be constant');
              }
              let fill = Expression.fromNum(0);
              if (parser.isNext(',')) {
                parser.nextTok();
                fill = Expression.parse(parser, imp);
              }
              parser.forceNewline(`\`.${tk2.id}\` statement`);
              imp.writeDataFill(tk, tk2.id.substr(0, tk2.id.length - 4) as DataType, amount, fill);
              break;
            }
            case 'if':
              await parseIf(tk, parser, imp);
              break;
            case 'include':
              parseInclude(parser, imp);
              break;
            case 'logo':
              parser.forceNewline('`.logo` statement');
              imp.writeLogo();
              break;
            case 'pool':
              parser.forceNewline('`.pool` statement');
              imp.pool();
              break;
            case 'printf':
            case 'error': {
              const tk3 = parser.nextTokOptional();
              if (!tk3 || tk3.kind !== 'str') {
                throw new CompError(parser.last(), 'Expecting `.printf "message"`');
              }
              const args: Expression[] = [];
              while (parser.isNext(',')) {
                parser.nextTok();
                args.push(Expression.parse(parser, imp));
              }
              parser.forceNewline(`\`.${tk2.id}\` statement`);
              imp.printf(tk, tk3.str, args, tk2.id === 'error');
              break;
            }
            case 'end':
              throw new CompError(parser.last(), 'Unbalanced `.end`');
            case 'regs':
              parseRegs(tk, parser, imp);
              break;
            case 'script':
              await parseScript(parser, imp);
              break;
            case 'str': {
              let str = '';
              while (true) {
                const tk3 = parser.nextTokOptional();
                if (!tk3 || tk3.kind !== 'str') {
                  throw new CompError(parser.last(), 'Expecting `.str "string"`');
                }
                str += tk3.str;
                if (parser.isNext(',')) {
                  parser.nextTok();
                  continue;
                }
                break;
              }
              parser.forceNewline('`.str` statement');
              imp.writeStr(str);
              break;
            }
            case 'struct': {
              const { name, base, struct } = parseStruct(parser, imp, true);
              imp.addSymStruct(tk, name, base, struct);
              break;
            }
            case 'thumb':
              parser.forceNewline('`.thumb` statement');
              imp.setMode('thumb');
              break;
            case 'title': {
              const title = parser.nextTokOptional();
              if (!title || title.kind !== 'str') {
                throw new CompError(title ?? tk2, 'Expecting `.title "Title"`');
              }
              parser.forceNewline('`.title` statement');
              imp.writeTitle(title, title.str);
              break;
            }
            default:
              throw new CompError(tk2, `Unknown statement: \`.${tk2.id}\``);
          }
          break;
        case 'punc':
        case 'newline':
        case 'num':
        case 'str':
        case 'script':
          throw new CompError(tk2, 'Invalid statement');
        case 'error':
          throw new CompError(tk2, tk2.msg);
        case 'closure':
          tk2.closure();
          break;
        default:
          assertNever(tk2);
      }
      break;
    }
    case 'id': {
      if (parser.isNext(':')) {
        imp.addSymNamedLabel(tk);
        parser.nextTok();
        break;
      }

      if (tk.id.charAt(0) === '_') {
        switch (tk.id) {
          case '_log': {
            const tk3 = parser.nextTokOptional();
            if (!tk3 || tk3.kind !== 'str') {
              throw new CompError(parser.last(), 'Expecting `_log "message"`');
            }
            const args: Expression[] = [];
            while (parser.isNext(',')) {
              parser.nextTok();
              args.push(Expression.parse(parser, imp, undefined, true));
            }
            parser.forceNewline('`_log` statement');
            imp.debugLog(tk3.str, args);
            break;
          }
          case '_exit':
            parser.forceNewline('`_exit` statement');
            imp.debugExit();
            break;
          default:
            throw new CompError(tk, `Unknown debug command: ${tk.id}`);
        }
      } else {
        let opName = tk.id;
        while (parser.isNext('.')) {
          parser.nextTok();
          opName += '.';
          const p = parser.peekTokOptional();
          if (p && p.kind === 'id') {
            opName += p.id;
            parser.nextTok();
          }
        }

        const mode = imp.mode();
        switch (mode) {
          case 'none':
            throw new CompError(tk, 'Unknown assembler mode (`.arm` or `.thumb`)');
          case 'arm': {
            const pool = parsePoolStatement(parser, imp);
            if (pool) {
              parseARMPoolStatement(tk, opName, pool, imp);
            } else {
              const ops = ARM.parsedOps[opName];
              if (!ops) {
                throw new CompError(tk, `Unknown ARM command: ${opName}`);
              }
              let lastError = new CompError(tk, 'Failed to parse ARM statement');
              if (
                !ops.some((op) => {
                  parser.save();
                  let res;
                  try {
                    res = parseARMStatement(tk, op, parser, imp);
                  } catch (e) {
                    if (e instanceof CompError) {
                      lastError = e;
                      parser.restore();
                      return false;
                    }
                    throw e;
                  }
                  if (res) {
                    parser.applySave();
                    return true;
                  }
                  parser.restore();
                  return false;
                })
              ) {
                throw lastError;
              }
            }
            break;
          }
          case 'thumb': {
            const pool = parsePoolStatement(parser, imp);
            if (pool) {
              parseThumbPoolStatement(tk, opName, pool, imp);
            } else {
              const ops = Thumb.parsedOps[opName];
              if (!ops) {
                throw new CompError(tk, `Unknown Thumb command: ${opName}`);
              }
              let lastError = new CompError(tk, 'Failed to parse Thumb statement');
              if (
                !ops.some((op) => {
                  parser.save();
                  let res;
                  try {
                    res = parseThumbStatement(tk, op, parser, imp);
                  } catch (e) {
                    if (e instanceof CompError) {
                      lastError = e;
                      parser.restore();
                      return false;
                    }
                    throw e;
                  }
                  if (res) {
                    parser.applySave();
                    return true;
                  }
                  parser.restore();
                  return false;
                })
              ) {
                throw lastError;
              }
            }
            break;
          }
          default:
            assertNever(mode);
        }
      }
      break;
    }
    case 'newline':
      break;
    case 'num':
      throw new Error('TODO: Not implemented: numbered labels');
    case 'str':
    case 'script':
      throw new CompError(tk, 'Invalid statement inside `.begin`');
    case 'error':
      throw new CompError(tk, tk.msg);
    case 'closure':
      tk.closure();
      break;
    default:
      assertNever(tk);
  }
}

async function parseBegin(parser: Parser, imp: Import) {
  const tk1 = parser.nextTok();
  let tk = tk1;
  let name: string | undefined;
  if (tk.kind === 'id') {
    name = tk.id;
    if (!parser.hasTok()) {
      throw new CompError(tk, 'Missing `.end` for `.begin`');
    }
    tk = parser.nextTok();
  }
  if (tk.kind !== 'newline') {
    throw new CompError(tk, 'Expecting `.begin` or `.begin Name`');
  }

  // parse begin body
  imp.beginStart(tk1, name);
  while (!parser.checkEnd()) {
    if (!parser.hasTok()) {
      throw new CompError(parser.here(), `Missing \`.end\` for \`.begin\` on line ${tk.line}`);
    }
    await parseBeginBody(parser, imp);
  }
  imp.end();
}

async function parseIf(flp: IFilePos, parser: Parser, imp: Import) {
  let condition;
  try {
    condition = Expression.parse(parser, imp).value(
      imp.expressionContext(0),
      true,
      false,
    );
  } catch (e) {
    throw CompError.extend(e, flp, 'Condition unknown at time of execution');
  }
  parser.forceNewline('`.if` statement');
  if (condition === false) {
    throw new CompError(flp, 'Condition unknown at time of execution');
  }
  let gotTrue = condition !== 0;
  let gotElse = false;
  imp.ifStart(gotTrue);
  while (!parser.checkEnd()) {
    if (!parser.hasTok()) {
      throw new CompError(parser.here(), `Missing \`.end\` for \`.if\` on line ${flp.line}`);
    }
    if (parser.checkElseif()) {
      if (gotElse) {
        throw new CompError(parser.last(), `Can't have \`.elseif\` after \`.else\``);
      }
      imp.end();
      const exflp = parser.here();
      const elseif = Expression.parse(parser, imp).value(
        imp.expressionContext(0),
        true,
        false,
      );
      if (gotTrue) {
        imp.ifStart(false);
      } else if (elseif === false) {
        throw new CompError(exflp, 'Condition unknown at time of execution');
      } else {
        gotTrue = elseif !== 0;
        imp.ifStart(gotTrue);
      }
    } else if (parser.checkElse()) {
      if (gotElse) {
        throw new CompError(parser.last(), `Can't have \`.else\` after \`.else\``);
      }
      imp.end();
      gotElse = true;
      imp.ifStart(!gotTrue);
    } else {
      await parseBeginBody(parser, imp);
    }
  }
  imp.end();
}

function parseInclude(parser: Parser, imp: Import) {
  const tk = parser.nextTok();
  if (tk.kind !== 'str') {
    throw new CompError(tk, 'Expecting `.include \'file.gvasm\'');
  }
  parser.forceNewline('`.include` statement');
  imp.include(tk, tk.str);
}

function parseEmbed(parser: Parser, imp: Import) {
  const tk = parser.nextTok();
  if (tk.kind !== 'str') {
    throw new CompError(tk, 'Expecting `.embed \'file.bin\'');
  }
  parser.forceNewline('`.embed` statement');
  imp.embed(tk, tk.str);
}

function parseRegs(cmdFlp: IFilePos, parser: Parser, imp: Import) {
  const regs: string[] = [];
  while (parser.hasTok()) {
    const name1 = parser.nextTok();
    if (name1.kind === 'newline') {
      break;
    }
    if (name1.kind !== 'id') {
      throw new CompError(name1, 'Expecting register name');
    }
    const n1 = name1.id;

    if (parser.isNext('-')) {
      parser.nextTok();
      const name2 = parser.nextTokOptional();
      if (!name2 || name2.kind !== 'id') {
        throw new CompError(parser.last(), 'Expecting register name');
      }
      const n2 = name2.id;
      const m1 = n1.match(/[0-9]+$/);
      const m2 = n2.match(/[0-9]+$/);
      if (m1 === null || m2 === null) {
        throw new CompError(
          name1,
          `Invalid range in \`.regs\` statement; names must end with numbers: ${n1}-${n2}`,
        );
      }
      const prefix1 = n1.substr(0, n1.length - m1[0].length);
      const prefix2 = n2.substr(0, n2.length - m2[0].length);
      if (prefix1 !== prefix2) {
        throw new CompError(
          name1,
          `Invalid range in \`.regs\` statement; prefix mismatch: ${n1}-${n2}`,
        );
      }
      const num1 = parseFloat(m1[0]);
      const num2 = parseFloat(m2[0]);
      if (num2 < num1) {
        if (num1 - num2 + 1 > 12) {
          throw new CompError(
            name1,
            `Invalid range in \`.regs\` statement; range too large: ${n1}-${n2}`,
          );
        }
        for (let i = num1; i >= num2; i--) {
          const name = `${prefix1}${i}`;
          imp.validateRegName(name2, name);
          regs.push(name);
        }
      } else {
        if (num2 - num1 + 1 > 12) {
          throw new CompError(
            name1,
            `Invalid range in \`.regs\` statement; range too large: ${n1}-${n2}`,
          );
        }
        for (let i = num1; i <= num2; i++) {
          const name = `${prefix1}${i}`;
          imp.validateRegName(name2, name);
          regs.push(name);
        }
      }
    } else {
      imp.validateRegName(name1, n1);
      regs.push(n1);
    }
    if (parser.isNext(',')) {
      parser.nextTok();
    } else if (parser.checkNewline()) {
      break;
    } else {
      throw new CompError(parser.here(), 'Invalid `.regs` statement');
    }
  }

  if (regs.length <= 0) {
    imp.proj.getLog()(CompError.errorString(cmdFlp, `Registers: ${imp.regs().join(', ')}`));
    return;
  }

  if (regs.length !== 12) {
    if (regs.length > 0) {
      throw new CompError(
        cmdFlp,
        `Invalid \`.regs\` statement; expecting 12 names but got ${regs.length}: ${
          regs.join(', ')
        }`,
      );
    } else {
      throw new CompError(cmdFlp, 'Invalid `.regs` statement; missing register names');
    }
  }

  imp.setRegs(regs);
}

async function parseScript(parser: Parser, imp: Import) {
  const tk1 = parser.nextTok();
  let tk = tk1;
  let name: string | undefined;
  if (tk.kind === 'id') {
    name = tk.id;
    if (!parser.hasTok()) {
      throw new CompError(tk, 'Missing `.end` for `.script`');
    }
    tk = parser.nextTok();
  }
  if (tk.kind !== 'newline') {
    throw new CompError(tk, 'Expecting `.script` or `.script Name`');
  }

  // parse script body
  imp.beginStart(tk1, name);
  const str = parser.nextTokOptional();
  if (!str || str.kind !== 'script') {
    throw new CompError(parser.last(), 'Missing script body');
  }
  if (!parser.checkEnd()) {
    throw new CompError(parser.here(), `Missing \`.end\` for \`.script\` on line ${tk.line}`);
  }
  const tks = await imp.runScript(tk, str.body);
  imp.end();

  if (tks.length > 0 && name) {
    // enter the existing scope
    const cname = name;
    tks.unshift({
      ...tk1,
      kind: 'closure',
      closure: () => {
        imp.enterScope(cname);
      },
    });
    tks.push({
      ...tk1,
      kind: 'closure',
      closure: () => {
        imp.end();
      },
    });
  }
  parser.insert(tks);
}

async function parseFileImport(parser: Parser, imp: Import): Promise<boolean> {
  parser.trim();
  if (parser.isNext2('.', 'stdlib')) {
    const flp = parser.nextTok();
    parser.nextTok();
    parser.forceNewline('`.stdlib` statement');
    imp.stdlib(flp);
    return true;
  } else if (!parser.isNext2('.', 'import')) {
    return false;
  }
  const tk0 = parser.nextTok();
  parser.nextTok();

  const filenameTok = parser.nextTokOptional();
  if (!filenameTok || filenameTok.kind !== 'str') {
    throw new CompError(tk0, 'Expecting `.import \'file.gvasm\' ...`');
  }
  const filename = filenameTok.str;

  const tk = parser.nextTokOptional();
  if (tk && tk.kind === 'id') {
    await imp.importAll(tk0, filename, tk.id);
  } else if (tk && tk.kind === 'punc' && tk.punc === '{') {
    const names: string[] = [];
    let flp: IFilePos = tk;
    while (!parser.isNext('}')) {
      const tk2 = parser.nextTokOptional();
      if (tk2 && tk2.kind === 'id') {
        if (names.includes(tk2.id)) {
          throw new CompError(tk2, `Cannot import symbol twice: ${tk2.id}`);
        }
        names.push(tk2.id);
        if (parser.isNext('}')) {
          break;
        } else if (parser.isNext(',')) {
          flp = parser.nextTok();
          if (parser.isNext('}')) {
            break;
          }
        } else if (parser.checkNewline()) {
          // do nothing
        } else {
          throw new CompError(tk2, 'Expecting list of names, `{ Name1, Name2, Name3 }`');
        }
      } else if (tk2 && tk2.kind === 'newline') {
        // do nothing
      } else {
        throw new CompError(flp, 'Expecting list of names, `{ Name1, Name2, Name3 }`');
      }
    }
    parser.nextTok(); // '}'
    await imp.importNames(tk0, filename, names);
  } else {
    throw new CompError(
      tk0,
      'Expecting `.import \'file.gvasm\' Name` or `.import \'file.gvasm\' { Names, ... }',
    );
  }

  parser.forceNewline('`.import` statement');

  return true;
}

function parseStruct(
  parser: Parser,
  imp: Import,
  allowBase: boolean,
): { name: string; base: Expression | false; struct: IStruct } {
  const name = parser.nextTok();
  if (name.kind !== 'id') {
    throw new CompError(name, 'Expecting `.struct Name`');
  }
  let length: Expression | false = false;
  if (parser.isNext('[')) {
    parser.nextTok();
    length = Expression.parse(parser, imp);
    if (!parser.isNext(']')) {
      throw new CompError(parser.here(), 'Expecting `.struct Name[length]`');
    }
    parser.nextTok();
  }
  let base: Expression | false = false;
  if (parser.isNext('=')) {
    if (!allowBase) {
      throw new CompError(parser.here(), 'Cannot set struct base inside another struct');
    }
    parser.nextTok();
    base = Expression.parse(parser, imp);
  }
  parser.forceNewline('`.struct` statement');

  const struct: IStruct = { kind: 'struct', flp: name, length, members: [] };
  while (!parser.checkEnd()) {
    parseStructBody(parser, imp, struct, true);
  }
  return { name: name.id, base, struct };
}

function structPushMember(
  flp: IFilePos,
  struct: IStruct,
  name: string | false,
  member: IStructMember,
) {
  if (name) {
    if (/^_[a-z]/.test(name)) {
      throw new CompError(flp, `Cannot start name with reserved prefix \`_[a-z]\`: ${name}`);
    }
    for (const { name: name2 } of struct.members) {
      if (name === name2) {
        throw new CompError(flp, `Cannot redefine: ${name}`);
      }
    }
  }
  struct.members.push({ name, member });
}

function parseStructBody(parser: Parser, imp: Import, struct: IStruct, active: boolean) {
  const tk = parser.nextTok();
  switch (tk.kind) {
    case 'punc': {
      if (tk.punc !== '.' || !parser.hasTok()) {
        throw new CompError(tk, 'Invalid statement');
      }
      const tk2 = parser.nextTok();
      switch (tk2.kind) {
        case 'id':
          switch (tk2.id) {
            case 'align': {
              const context = imp.expressionContext(0);
              const amount = Expression.parse(parser, imp).value(context, true, false);
              if (amount === false) {
                throw new CompError(tk, 'Align amount must be constant');
              }
              parser.forceNewline('`.align` statement');
              if (active) {
                structPushMember(tk, struct, false, { kind: 'align', amount });
              }
              break;
            }
            case 'i8':
            case 'ib8':
            case 'im8':
            case 'ibm8':
            case 'i16':
            case 'ib16':
            case 'im16':
            case 'ibm16':
            case 'i32':
            case 'ib32':
            case 'im32':
            case 'ibm32':
            case 'u8':
            case 'ub8':
            case 'um8':
            case 'ubm8':
            case 'u16':
            case 'ub16':
            case 'um16':
            case 'ubm16':
            case 'u32':
            case 'ub32':
            case 'um32':
            case 'ubm32':
              while (true) {
                const name = parser.nextTokOptional();
                if (!name || name.kind !== 'id') {
                  throw new CompError(parser.here(), `Expecting \`.${tk2.id} Name\``);
                }
                let length: Expression | false = false;
                if (parser.isNext('[')) {
                  parser.nextTok();
                  length = Expression.parse(parser, imp);
                  if (!parser.isNext(']')) {
                    throw new CompError(parser.here(), `Expecting \`.${tk2.id} Name[length]\``);
                  }
                  parser.nextTok();
                }
                if (active) {
                  structPushMember(name, struct, name.id, {
                    kind: 'data',
                    flp: name,
                    length,
                    dataType: tk2.id,
                  });
                }
                if (parser.isNext(',')) {
                  parser.nextTok();
                  continue;
                }
                parser.forceNewline(`\`.${tk2.id}\` statement`);
                break;
              }
              break;
            case 'if':
              parseStructIf(tk, parser, imp, struct);
              break;
            case 'end':
              throw new CompError(parser.last(), 'Unbalanced `.end`');
            case 'struct': {
              const flp = parser.peekTokOptional();
              const { name, struct: member } = parseStruct(parser, imp, false);
              if (active) {
                structPushMember(flp ?? tk, struct, name, member);
              }
              break;
            }
            default:
              throw new CompError(tk2, `Unknown statement: \`.${tk2.id}\``);
          }
          break;
        case 'punc':
        case 'newline':
        case 'num':
        case 'str':
        case 'script':
          throw new CompError(tk2, 'Invalid statement');
        case 'error':
          throw new CompError(tk2, tk2.msg);
        case 'closure':
          tk2.closure();
          break;
        default:
          assertNever(tk2);
      }
      break;
    }
    case 'id': {
      if (parser.isNext(':')) {
        if (active) {
          structPushMember(tk, struct, tk.id, { kind: 'label' });
        }
        parser.nextTok();
      } else {
        throw new CompError(tk, 'Invalid statement inside `.struct`');
      }
      break;
    }
    case 'newline':
      break;
    case 'num':
    case 'str':
    case 'script':
      throw new CompError(tk, 'Invalid statement inside `.struct`');
    case 'error':
      throw new CompError(tk, tk.msg);
    case 'closure':
      tk.closure();
      break;
    default:
      assertNever(tk);
  }
}

function parseStructIf(flp: IFilePos, parser: Parser, imp: Import, struct: IStruct) {
  const condition = Expression.parse(parser, imp).value(
    imp.expressionContext(0),
    true,
    false,
  );
  parser.forceNewline('`.if` statement');
  if (condition === false) {
    throw new CompError(flp, 'Condition unknown at time of execution');
  }
  let gotTrue = condition !== 0;
  let gotElse = false;
  let active = gotTrue;
  while (!parser.checkEnd()) {
    if (!parser.hasTok()) {
      throw new CompError(parser.here(), `Missing \`.end\` for \`.if\` on line ${flp.line}`);
    }
    if (parser.checkElseif()) {
      if (gotElse) {
        throw new CompError(parser.last(), `Can't have \`.elseif\` after \`.else\``);
      }
      const exflp = parser.here();
      const elseif = Expression.parse(parser, imp).value(
        imp.expressionContext(0),
        true,
        false,
      );
      if (gotTrue) {
        active = false;
      } else if (elseif === false) {
        throw new CompError(exflp, 'Condition unknown at time of execution');
      } else {
        gotTrue = elseif !== 0;
        active = gotTrue;
      }
    } else if (parser.checkElse()) {
      if (gotElse) {
        throw new CompError(parser.last(), `Can't have \`.else\` after \`.else\``);
      }
      gotElse = true;
      active = !gotTrue;
    } else {
      parseStructBody(parser, imp, struct, active);
    }
  }
}

export async function parse(
  imp: Import,
  fullFile: string,
  defines: ILexKeyValue[],
  tks: ITok[],
): Promise<Import> {
  for (const d of defines) {
    imp.addSymNum({ filename: fullFile, line: 1, chr: 1 }, d.key, d.value);
  }

  const parser = new Parser(tks);

  // parse imports, then body
  while (await parseFileImport(parser, imp));
  while (parser.hasTok()) {
    await parseBeginBody(parser, imp);
  }
  imp.endOfFile();
  return imp;
}
