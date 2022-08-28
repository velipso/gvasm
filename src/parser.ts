//
// gvasm - Assembler and disassembler for Game Boy Advance homebrew
// by Sean Connelly (@velipso), https://sean.cm
// Project Home: https://github.com/velipso/gvasm
// SPDX-License-Identifier: 0BSD
//

import { IFilePos, ILexKeyValue, ITok, ITokId } from './lexer.ts';
import { ARM, Thumb } from './ops.ts';
import { assertNever } from './util.ts';
import { Expression } from './expr.ts';
import { Project } from './project.ts';
import { Import, ISyms } from './import.ts';

export class Parser {
  i = 0;
  iStack: number[] = [];
  tks: ITok[];

  constructor(tks: ITok[]) {
    this.tks = tks;
  }

  here(): IFilePos {
    if (this.tks.length <= 0) return { filename: '', line: 1, chr: 1 };
    if (this.i >= this.tks.length) return this.tks[this.tks.length - 1];
    return this.tks[this.i];
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

  checkEnd(): boolean {
    if (this.i + 3 > this.tks.length) {
      return false;
    }
    const tk1 = this.tks[this.i];
    if (tk1.kind !== 'punc' || tk1.punc !== '.') {
      return false;
    }
    const tk2 = this.tks[this.i + 1];
    if (tk2.kind !== 'id' || tk2.id !== 'end') {
      return false;
    }
    const tk3 = this.tks[this.i + 2];
    if (tk3.kind !== 'newline') {
      throw new CompError(tk3, 'Invalid `.end` statement');
    }
    this.i += 3;
    return true;
  }

  forceNewline(hint: string) {
    const tk = this.tks[this.i];
    if (!tk) return;
    if (tk.kind !== 'newline') {
      throw new CompError(tk, `Missing newline at end of ${hint}`);
    }
    this.i++;
  }
}

export class CompError extends Error {
  filename: string;
  line: number;
  chr: number;

  constructor({ filename, line, chr }: IFilePos, msg: string) {
    super(msg);
    this.filename = filename;
    this.line = line;
    this.chr = chr;
  }

  static errorString(filename: string, line: number, chr: number, msg: string) {
    if (!filename) {
      return `${line}:${chr}: ${msg}`;
    }
    return `${filename}:${line}:${chr}: ${msg}`;
  }

  toString() {
    return CompError.errorString(this.filename, this.line, this.chr, this.message);
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
  try {
    return Expression.parse(parser, imp).value(imp.pendingWriteContext(), 'allow') === partNum;
  } catch (_) {
    return false;
  }
}

function validateSymExpr(
  syms: ISyms,
  partSym: string,
  negate: boolean,
  parser: Parser,
  imp: Import,
): boolean {
  try {
    const ex = Expression.parse(parser, imp);
    if (negate) {
      ex.negate();
    }
    syms[partSym] = ex;
    return true;
  } catch (_) {
    return false;
  }
}

function validateSymRegister(
  syms: ISyms,
  partSym: string,
  low: number,
  high: number,
  parser: Parser,
  imp: Import,
): boolean {
  try {
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
  } catch (_) {
    return false;
  }
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

  parser.forceNewline('ARM statement');
  imp.writeInstARM(flp, pb.op, syms);
  return true;
}

function parseARMPoolStatement(cmd: ITokId, pool: IPool, imp: Import) {
  let cmdSize = -1;
  let cmdSigned = false;
  let cond = -1;
  for (let ci = 0; ci < ARM.conditionEnum.length && cond < 0; ci++) {
    const ce = ARM.conditionEnum[ci];
    if (ce !== false) {
      for (const cs of ce.split('/')) {
        if (cmd.id === `ldr${cs}` || (cs !== '' && cmd.id === `ldr.${cs}`)) {
          cmdSize = 4;
          cond = ci;
        } else if (cmd.id === `ldrh${cs}` || (cs !== '' && cmd.id === `ldrh.${cs}`)) {
          cmdSize = 2;
          cond = ci;
        } else if (cmd.id === `ldrsh${cs}` || (cs !== '' && cmd.id === `ldrsh.${cs}`)) {
          cmdSize = 2;
          cmdSigned = true;
          cond = ci;
        } else if (cmd.id === `ldrb${cs}` || (cs !== '' && cmd.id === `ldrb.${cs}`)) {
          cmdSize = 1;
          cond = ci;
        } else if (cmd.id === `ldrsb${cs}` || (cs !== '' && cmd.id === `ldrsb.${cs}`)) {
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
    throw new CompError(cmd, 'Invalid ARM pool statement');
  }
  imp.writePoolARM(cmd, cmdSize, cmdSigned, cond, pool.rd, pool.expr);
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
            if (!validateSymExpr(syms, part.sym, false, parser, imp)) {
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

  parser.forceNewline('Thumb statement');
  imp.writeInstThumb(flp, pb.op, syms);
  return true;
}

function parseThumbPoolStatement(_cmd: ITokId, _pool: IPool, parser: Parser, _imp: Import) {
  parser.forceNewline('Thumb statement');
}

async function parseBeginBody(parser: Parser, imp: Import): Promise<void> {
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
              const context = imp.pendingWriteContext();
              const amount = Expression.parse(parser, imp).value(context, 'deny');
              if (amount === false) throw new Error('Align amount not constant');
              let fill: number | 'nop' = 0;
              if (parser.isNext(',')) {
                parser.nextTok();
                if (parser.isNext('nop')) {
                  fill = 'nop';
                  parser.nextTok();
                } else {
                  const fillx = Expression.parse(parser, imp).value(context, 'deny');
                  if (fillx === false) throw new Error('Align fill not constant');
                  fill = fillx;
                }
              }
              parser.forceNewline('`.align` statement');
              imp.align(amount, fill);
              break;
            }
            case 'arm':
              parser.forceNewline('`.arm` statement');
              imp.setMode('arm');
              break;
            case 'begin':
              await parseBegin(parser, imp);
              break;
            case 'crc':
              parser.forceNewline('`.crc` statement');
              imp.writeCRC(tk);
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
            case 'include':
              await parseInclude(parser, imp);
              break;
            case 'logo':
              parser.forceNewline('`.logo` statement');
              imp.writeLogo();
              break;
            case 'pool':
              parser.forceNewline('`.pool` statement');
              imp.pool();
              break;
            case 'printf': {
              const tk3 = parser.nextTokOptional();
              if (!tk3 || tk3.kind !== 'str') {
                throw new CompError(tk3 ?? tk2, 'Expecting `.printf "message"`');
              }
              const args: Expression[] = [];
              while (parser.isNext(',')) {
                parser.nextTok();
                args.push(Expression.parse(parser, imp));
              }
              parser.forceNewline('`.printf` statement');
              imp.printf(tk, tk3.str, args);
              break;
            }
            case 'str': {
              let str = '';
              while (true) {
                const tk3 = parser.nextTokOptional();
                if (!tk3 || tk3.kind !== 'str') {
                  throw new CompError(tk3 ?? tk2, 'Expecting `.str "string"`');
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
          throw new CompError(tk2, 'Invalid statement');
        case 'error':
          throw new CompError(tk2, tk2.msg);
        default:
          assertNever(tk2);
      }
      break;
    }
    case 'id': {
      const tk2 = parser.peekTokOptional();
      if (tk2 && tk2.kind === 'punc' && tk2.punc === ':') {
        imp.addSymNamedLabel(tk);
        parser.nextTok();
        break;
      }

      if (tk.id.charAt(0) === '_') {
        // TODO: debug statement
        console.log('TODO: debug:', tk.id);
        while (true) {
          const tk3 = parser.peekTokOptional();
          if (!tk3 || tk3.kind === 'newline') {
            break;
          }
          parser.nextTok();
        }
      } else {
        const mode = imp.mode();
        switch (mode) {
          case 'none':
            throw new CompError(tk, 'Unknown assembler mode (`.arm` or `.thumb`)');
          case 'arm': {
            const pool = parsePoolStatement(parser, imp);
            if (pool) {
              parseARMPoolStatement(tk, pool, imp);
            } else {
              const ops = ARM.parsedOps[tk.id];
              if (!ops) {
                throw new CompError(tk, `Unknown ARM command: ${tk.id}`);
              }
              let lastError = new CompError(tk, 'Failed to parse ARM statement');
              if (
                !ops.some((op) => {
                  try {
                    parser.save();
                    const res = parseARMStatement(tk, op, parser, imp);
                    if (res) {
                      parser.applySave();
                      return true;
                    }
                    parser.restore();
                    return false;
                  } catch (e) {
                    if (e instanceof CompError) {
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
            break;
          }
          case 'thumb': {
            const pool = parsePoolStatement(parser, imp);
            if (pool) {
              parseThumbPoolStatement(tk, pool, parser, imp);
            } else {
              const ops = Thumb.parsedOps[tk.id];
              if (!ops) {
                throw new CompError(tk, `Unknown Thumb command: ${tk.id}`);
              }
              let lastError = new CompError(tk, 'Failed to parse Thumb statement');
              if (
                !ops.some((op) => {
                  try {
                    parser.save();
                    const res = parseThumbStatement(tk, op, parser, imp);
                    if (res) {
                      parser.applySave();
                      return true;
                    }
                    parser.restore();
                    return false;
                  } catch (e) {
                    if (e instanceof CompError) {
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
      throw 'TODO: numbered labels';
    case 'str':
      throw new CompError(tk, 'Invalid statement inside `.begin`');
    case 'error':
      throw new CompError(tk, tk.msg);
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
      throw new CompError(
        parser.tks[parser.tks.length - 1],
        `Missing \`.end\` for \`.begin\` on line ${tk.line}`,
      );
    }
    await parseBeginBody(parser, imp);
  }
  imp.beginEnd();
}

async function parseInclude(parser: Parser, imp: Import) {
  const tk = parser.nextTok();
  if (tk.kind !== 'str') {
    throw new CompError(tk, 'Expecting `.include \'file.gvasm\'');
  }
  parser.forceNewline('`.include` statement');
  await imp.include(tk.str);
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
    if (!parser.isNext('}')) {
      let flp: IFilePos = tk;
      while (true) {
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
          } else {
            throw new CompError(tk2, 'Expecting list of names, `{ Name1, Name2, Name3 }`');
          }
        } else {
          throw new CompError(flp, 'Expecting list of names, `{ Name1, Name2, Name3 }`');
        }
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

export async function parse(
  proj: Project,
  filename: string,
  main: boolean,
  defines: ILexKeyValue[],
  tks: ITok[],
): Promise<Import> {
  const imp = new Import(proj, filename, main);

  for (const d of defines) {
    imp.addSymNum({ filename, line: 1, chr: 1 }, d.key, d.value);
  }

  const parser = new Parser(tks);

  // parse imports, then body
  while (await parseFileImport(parser, imp));
  while (parser.hasTok()) await parseBeginBody(parser, imp);
  imp.endOfFile();
  return imp;
}
