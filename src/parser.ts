//
// gvasm - Assembler and disassembler for Game Boy Advance homebrew
// by Sean Connelly (@velipso), https://sean.cm
// Project Home: https://github.com/velipso/gvasm
// SPDX-License-Identifier: 0BSD
//

import { IFilePos, ITok, ITokId } from './lexer.ts';
import { ARM, Thumb } from './ops.ts';
import { assertNever } from './util.ts';
import { Expression, IExprContext, LookupFailMode, reservedNames } from './expr.ts';
import { IFileState, Project } from './project.ts';

export type Mode = 'none' | 'arm' | 'thumb';

type ISyms = { [sym: string]: Expression | number };

export class Parser {
  i = 0;
  iStack: number[] = [];
  tks: ITok[];

  constructor(tks: ITok[]) {
    this.tks = tks;
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

interface ILevelBegin {
  kind: 'begin';
  mode: Mode;
  regs: string[];
}

type ILevel = ILevelBegin;

abstract class Section {
  abstract flatten(state: IFileState, startLength: number): Promise<number[][]>;
}

interface IRewrite {
  addr(): number | false;
  write(v: number): void;
}

class SectionBytes extends Section {
  static MAX_LENGTH = 0x02000000;
  private array: number[] = [];
  private addrRecvs: { i: number; recv: { addr: number | false } }[] = [];
  private addr: { base: { addr: number; relativeTo: number }; startLength: number } | false = false;

  async flatten(state: IFileState, startLength: number): Promise<number[][]> {
    this.addr = { base: state.base, startLength };
    for (const { i, recv } of this.addrRecvs) {
      recv.addr = state.base.addr + startLength + i - state.base.relativeTo;
    }
    return [this.array];
  }

  clearAddr() {
    this.addr = false;
    for (const { recv } of this.addrRecvs) recv.addr = false;
  }

  length() {
    return this.array.length;
  }

  addAddrRecv(recv: { addr: number | false }) {
    this.addrRecvs.push({ i: this.array.length, recv });
  }

  write8(v: number) {
    this.array.push(v & 0xff);
  }

  write16(v: number) {
    this.array.push(
      v & 0xff,
      (v >> 8) & 0xff,
    );
  }

  write32(v: number) {
    this.array.push(
      v & 0xff,
      (v >> 8) & 0xff,
      (v >> 16) & 0xff,
      (v >> 24) & 0xff,
    );
  }

  writeArray(v: number[] | Uint8Array) {
    for (let i = 0; i < v.length; i++) {
      this.array.push(v[i] & 0xff);
    }
  }

  rewrite8(): IRewrite {
    const i = this.array.length;
    this.write8(0);
    return {
      addr: () => {
        if (this.addr === false) return false;
        return this.addr.base.addr + this.addr.startLength + i - this.addr.base.relativeTo;
      },
      write: (v: number) => {
        this.array[i] = v & 0xff;
      },
    };
  }

  rewrite16(): IRewrite {
    const i = this.array.length;
    this.write16(0);
    return {
      addr: () => {
        if (this.addr === false) return false;
        return this.addr.base.addr + this.addr.startLength + i - this.addr.base.relativeTo;
      },
      write: (v: number) => {
        this.array[i] = v & 0xff;
        this.array[i + 1] = (v >> 8) & 0xff;
      },
    };
  }

  rewrite32(): IRewrite {
    const i = this.array.length;
    this.write32(0);
    return {
      addr: () => {
        if (this.addr === false) return false;
        return this.addr.base.addr + this.addr.startLength + i - this.addr.base.relativeTo;
      },
      write: (v: number) => {
        this.array[i] = v & 0xff;
        this.array[i + 1] = (v >> 8) & 0xff;
        this.array[i + 2] = (v >> 16) & 0xff;
        this.array[i + 3] = (v >> 24) & 0xff;
      },
    };
  }
}

class SectionInclude extends Section {
  proj: Project;
  filename: string;

  constructor(proj: Project, filename: string) {
    super();
    this.proj = proj;
    this.filename = filename;
  }

  async flatten(state: IFileState, startLength: number): Promise<number[][]> {
    return await this.proj.include(this.filename, state, startLength);
  }
}

class SectionPool extends Section {
  async flatten(_state: IFileState, _startLength: number): Promise<number[][]> {
    return [];
  }
}

interface ISymBegin {
  kind: 'begin';
  map: Map<string, ISym>;
  addr: number | false;
}

interface ISymNum {
  kind: 'num';
  num: number;
}

interface ISymLabel {
  kind: 'label';
  addr: number | false;
}

interface ISymImportAll {
  kind: 'importAll';
  filename: string;
}

interface ISymImportName {
  kind: 'importName';
  filename: string;
  name: string;
}

export type ISym =
  | ISymBegin
  | ISymImportAll
  | ISymImportName
  | ISymLabel
  | ISymNum;

class BitNumber {
  private maxSize: number;
  private bpos = 0;
  private value = 0;

  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  push(size: number, v: number) {
    this.value |= (v & ((1 << size) - 1)) << this.bpos;
    this.bpos += size;
  }

  get() {
    if (this.bpos !== this.maxSize) {
      throw new Error(`Opcode length isn't ${this.maxSize} bits`);
    }
    return this.value;
  }
}

interface IPendingInstCommon<T> {
  flp: IFilePos;
  op: T;
  syms: ISyms;
  context: IExprContext;
  rewrite: IRewrite;
}

interface IPendingInstARM extends IPendingInstCommon<ARM.IOp> {
  isARM: true;
}

interface IPendingInstThumb extends IPendingInstCommon<Thumb.IOp> {
  isARM: false;
}

type IPendingInst = IPendingInstARM | IPendingInstThumb;

export class ParsedFile {
  static defaultRegs = ['r0', 'r1', 'r2', 'r3', 'r4', 'r5', 'r6', 'r7', 'r8', 'r9', 'r10', 'r11'];
  static reservedRegs = ['r12', 'ip', 'r13', 'sp', 'r14', 'lr', 'r15', 'pc'];

  proj: Project;
  filename: string;
  symTable = new Map<string, ISym>();
  symHere = [this.symTable];
  levels: ILevel[] = [];
  sections: Section[] = [];
  inst: IPendingInst[] = [];
  uniqueId = 0;

  constructor(proj: Project, filename: string) {
    this.proj = proj;
    this.filename = filename;
  }

  tailBytes(): SectionBytes {
    const tail = this.sections[this.sections.length - 1];
    if (tail && tail instanceof SectionBytes) {
      return tail;
    }
    const bytes = new SectionBytes();
    this.sections.push(bytes);
    return bytes;
  }

  exprContext(): IExprContext {
    return {
      proj: this.proj,
      main: this.proj.isMain(this.filename),
      symHere: [...this.symHere],
      mode: this.mode(),
      addr: false,
    };
  }

  decodeRegister(t: ITokId, allowCpsr: boolean): number {
    if (allowCpsr && t.id === 'cpsr') {
      return 16;
    }
    const a = ParsedFile.reservedRegs.indexOf(t.id);
    if (a >= 0) {
      return 12 + (a >> 1);
    }
    const regs = this.regs();
    const b = regs.indexOf(t.id);
    if (b >= 0) {
      return b;
    }
    // attempt to provide friendly error message
    const c = ParsedFile.defaultRegs.indexOf(t.id);
    if (c >= 0) {
      throw new CompError(t, `Invalid register name; ${t.id} has been renamed to: ${regs[c]}`);
    }
    return -1;
  }

  isRegister(name: string) {
    return (
      name === 'cpsr' ||
      ParsedFile.reservedRegs.includes(name) ||
      ParsedFile.defaultRegs.includes(name) ||
      this.regs().includes(name)
    );
  }

  validateNewName(flp: IFilePos, name: string) {
    if (this.isRegister(name)) {
      throw new CompError(flp, `Cannot use register name: ${name}`);
    }
    if (reservedNames.includes(name)) {
      throw new CompError(flp, `Cannot use reserved name: ${name}`);
    }
    if (this.symHere[0].has(name)) {
      throw new CompError(flp, `Cannot redefine: ${name}`);
    }
  }

  addSymNum(flp: IFilePos, name: string, num: number) {
    this.validateNewName(flp, name);
    this.symHere[0].set(name, { kind: 'num', num });
  }

  addSymNamedLabel(tk: ITokId) {
    this.validateNewName(tk, tk.id);
    const label: ISymLabel = { kind: 'label', addr: false };
    this.tailBytes().addAddrRecv(label);
    this.symHere[0].set(tk.id, label);
  }

  async importAll(flp: IFilePos, filename: string, name: string) {
    const fullFile = this.proj.resolveFile(filename, this.filename);
    await this.proj.import(fullFile);
    this.validateNewName(flp, name);
    this.symTable.set(name, { kind: 'importAll', filename: fullFile });
  }

  async importNames(flp: IFilePos, filename: string, names: string[]) {
    const fullFile = this.proj.resolveFile(filename, this.filename);
    await this.proj.import(fullFile);
    for (const name of names) {
      this.validateNewName(flp, name);
      this.symTable.set(name, { kind: 'importName', filename: fullFile, name });
    }
  }

  include(filename: string) {
    const fullFile = this.proj.resolveFile(filename, this.filename);
    this.sections.push(new SectionInclude(this.proj, fullFile));
    return Promise.resolve();
  }

  beginStart(flp: IFilePos, name: string | undefined) {
    const symName = name ?? `%${this.uniqueId++}`;
    this.validateNewName(flp, symName);
    const entry: ISymBegin = {
      kind: 'begin',
      map: new Map(),
      addr: false,
    };
    this.tailBytes().addAddrRecv(entry);
    this.symHere[0].set(symName, entry);
    this.symHere.unshift(entry.map);
    this.levels.unshift({ kind: 'begin', mode: this.mode(), regs: this.regs() });
  }

  beginEnd() {
    if (this.levels.length <= 0 || this.levels[0].kind !== 'begin') {
      throw new Error(`Can't call beginEnd without matching beginStart`);
    }
    this.symHere.shift();
    this.levels.shift();
  }

  pool() {
    // TODO: populate pool with outstanding expressions
    this.sections.push(new SectionPool());
  }

  armStatement(flp: IFilePos, op: ARM.IOp, syms: ISyms) {
    const rewrite = this.tailBytes().rewrite32();
    const context = this.exprContext();
    if (!this.armWrite(flp, op, syms, context, 'allow', rewrite)) {
      this.inst.push({ isARM: true, flp, op, syms, context, rewrite });
    }
  }

  armWrite(
    _flp: IFilePos,
    _op: ARM.IOp,
    _syms: ISyms,
    _context: IExprContext,
    _lookupFailMode: LookupFailMode,
    _rewrite: IRewrite,
  ): boolean {
    return false;
  }

  thumbStatement(flp: IFilePos, op: Thumb.IOp, syms: ISyms) {
    const bytes = this.tailBytes();
    const rewrite = op.doubleInstruction ? bytes.rewrite32() : bytes.rewrite16();
    const context = this.exprContext();
    if (!this.thumbWrite(flp, op, syms, context, 'allow', rewrite)) {
      this.inst.push({ isARM: false, flp, op, syms, context, rewrite });
    }
  }

  thumbWrite(
    flp: IFilePos,
    op: Thumb.IOp,
    syms: ISyms,
    context: IExprContext,
    lookupFailMode: LookupFailMode,
    rewrite: IRewrite,
  ): boolean {
    // calculate all expressions
    const symNums: { [key: string]: number } = {};
    for (const [key, expr] of Object.entries(syms)) {
      if (typeof expr === 'number') {
        symNums[key] = expr;
      } else {
        const v = expr.value(context, lookupFailMode);
        if (v === false) return false;
        symNums[key] = v;
      }
    }

    // generate opcode
    const address = rewrite.addr();
    const opcode = new BitNumber(op.doubleInstruction ? 32 : 16);
    const pushAlign = (size: number, v: number, shift: number) => {
      if (v < 0 || v >= (1 << (size + shift))) {
        throw new CompError(
          flp,
          `Immediate value out of range 0..${
            ((1 << size) - 1) <<
            shift
          }: ${v}`,
        );
      }
      if (v & ((1 << shift) - 1)) {
        throw new CompError(
          flp,
          `Immediate value is not ${shift === 2 ? 'word' : 'halfword'} aligned: ${v}`,
        );
      }
      opcode.push(size, v >> shift);
    };
    for (const codePart of op.codeParts) {
      switch (codePart.k) {
        case 'immediate':
          pushAlign(codePart.s, symNums[codePart.sym], 0);
          break;
        case 'enum':
        case 'register':
        case 'reglist':
          opcode.push(codePart.s, symNums[codePart.sym]);
          break;
        case 'registerhigh':
          opcode.push(codePart.s, symNums[codePart.sym] - 8);
          break;
        case 'value':
        case 'ignored':
          opcode.push(codePart.s, codePart.v);
          break;
        case 'word':
        case 'negword':
          pushAlign(codePart.s, symNums[codePart.sym], 2);
          break;
        case 'halfword':
          pushAlign(codePart.s, symNums[codePart.sym], 1);
          break;
        case 'shalfword': {
          if (address === false) return false;
          const offset = symNums[codePart.sym] - address - 4;
          if (offset < -(1 << codePart.s) || offset >= (1 << codePart.s)) {
            throw new CompError(flp, `Offset too large: ${offset}`);
          } else if (offset & 1) {
            throw new CompError(flp, 'Can\'t branch to misaligned memory address');
          }
          opcode.push(codePart.s, offset >> 1);
          break;
        }
        case 'pcoffset': {
          if (address === false) return false;
          const offset = symNums[codePart.sym] - (address & 0xfffffffd) - 4;
          if (offset < 0) {
            throw new CompError(flp, 'Can\'t load from address before PC in thumb mode');
          } else if (offset & 3) {
            throw new CompError(flp, 'Can\'t load from misaligned address');
          }
          pushAlign(codePart.s, offset, 2);
          break;
        }
        case 'offsetsplit': {
          if (address === false) return false;
          const offset = symNums[codePart.sym] - address - 4;
          if (offset < -4194304 || offset >= 4194304) {
            throw new CompError(flp, `Offset too large: ${offset}`);
          } else if (offset & 1) {
            throw new CompError(flp, 'Can\'t branch to misaligned memory address');
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

    // write!
    rewrite.write(opcode.get());
    return true;
  }

  endOfFile() {
    // attempt rewrites now that we know more information
    for (let i = 0; i < this.inst.length; i++) {
      const { isARM, flp, op, syms, context, rewrite } = this.inst[i];
      if (isARM) {
        if (this.armWrite(flp, op, syms, context, 'unresolved', rewrite)) {
          this.inst.splice(i, 1);
          i--;
        }
      } else {
        if (this.thumbWrite(flp, op, syms, context, 'unresolved', rewrite)) {
          this.inst.splice(i, 1);
          i--;
        }
      }
    }
  }

  setMode(mode: Mode) {
    for (const lv of this.levels) {
      if (lv.kind === 'begin') {
        lv.mode = mode;
        return;
      }
    }
    throw new Error(`Can't set instruction set outside of begin block`);
  }

  mode(): Mode {
    for (const lv of this.levels) {
      if (lv.kind === 'begin') {
        return lv.mode;
      }
    }
    return 'none';
  }

  setRegs(regs: string[]) {
    for (const lv of this.levels) {
      if (lv.kind === 'begin') {
        lv.regs = regs;
        return;
      }
    }
    throw new Error(`Can't set registers outside of begin block`);
  }

  regs(): string[] {
    for (const lv of this.levels) {
      if (lv.kind === 'begin') {
        return lv.regs;
      }
    }
    return ParsedFile.defaultRegs;
  }

  async flatten(initialState: IFileState, startLength: number): Promise<number[][]> {
    const sections: number[][] = [];
    const states = [initialState];
    let length = startLength;
    for (const section of this.sections) {
      const sects = await section.flatten(states[0], length);
      for (const sect of sects) {
        if (sect.length <= 0) continue;
        length += sect.length;
        sections.push(sect);
      }
    }
    return sections;
  }

  makeStart() {
    for (const section of this.sections) {
      if (section instanceof SectionBytes) section.clearAddr();
    }
  }

  makeEnd() {
    for (const { isARM, flp, op, syms, context, rewrite } of this.inst) {
      if (isARM) {
        if (!this.armWrite(flp, op, syms, context, 'deny', rewrite)) {
          throw new CompError(flp, 'Failed to write instruction');
        }
      } else {
        if (!this.thumbWrite(flp, op, syms, context, 'deny', rewrite)) {
          throw new CompError(flp, 'Failed to write instruction');
        }
      }
    }
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
  result: ParsedFile,
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
          lastRegister = result.decodeRegister(t, false);
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
          const end = result.decodeRegister(t, false);
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

function parsePoolStatement(parser: Parser, result: ParsedFile): IPool | false {
  try {
    const tk1 = parser.tks[parser.i + 0];
    if (!tk1 || tk1.kind !== 'id') {
      return false;
    }

    const rd = result.decodeRegister(tk1, false);
    if (rd < 0) {
      return false;
    }

    const tk2 = parser.tks[parser.i + 1];
    if (!tk2 || tk2.kind !== 'punc' || tk2.punc !== ',') {
      return false;
    }

    const tk3 = parser.tks[parser.i + 2];
    if (!tk3 || tk3.kind !== 'punc' || tk3.punc !== '=') {
      return false;
    }

    // consume tokens
    parser.i += 3;

    // parse rest of expression
    const expr = Expression.parse(parser, result);
    return { rd, expr };
  } catch (_) {
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

function validateNum(partNum: number, parser: Parser, result: ParsedFile): boolean {
  try {
    return Expression.parse(parser, result).value(result.exprContext(), 'allow') === partNum;
  } catch (_) {
    return false;
  }
}

function validateSymExpr(
  syms: ISyms,
  partSym: string,
  negate: boolean,
  parser: Parser,
  result: ParsedFile,
): boolean {
  try {
    const ex = Expression.parse(parser, result);
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
  result: ParsedFile,
): boolean {
  try {
    const t = parser.nextTok();
    if (!t || t.kind !== 'id') {
      return false;
    }
    const reg = result.decodeRegister(t, false);
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

function parseARMStatement(_pb: ARM.IParsedBody, _parser: Parser, _result: ParsedFile): boolean {
  return false;
}

function parseARMPoolStatement(_cmd: ITokId, _pool: IPool, _parser: Parser, _result: ParsedFile) {
}

function parseThumbStatement(
  flp: IFilePos,
  pb: Thumb.IParsedBody,
  parser: Parser,
  result: ParsedFile,
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
        if (!validateNum(part.num, parser, result)) {
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
            if (!validateSymExpr(syms, part.sym, false, parser, result)) {
              return false;
            }
            break;
          case 'register':
            if (!validateSymRegister(syms, part.sym, 0, 7, parser, result)) {
              return false;
            }
            break;
          case 'registerhigh':
            if (!validateSymRegister(syms, part.sym, 8, 15, parser, result)) {
              return false;
            }
            break;
          case 'enum':
            if (!validateSymEnum(syms, part.sym, codePart.enum, parser)) {
              return false;
            }
            break;
          case 'reglist': {
            const v = parseReglist(8, codePart.extra ?? false, parser, result);
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
  result.thumbStatement(flp, pb.op, syms);
  return true;
}

function parseThumbPoolStatement(_cmd: ITokId, _pool: IPool, parser: Parser, _result: ParsedFile) {
  parser.forceNewline('Thumb statement');
}

function parseBeginBody(parser: Parser, result: ParsedFile) {
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
            case 'arm':
              parser.forceNewline('`.arm` statement');
              result.setMode('arm');
              break;
            case 'begin':
              parseBegin(parser, result);
              break;
            case 'pool':
              parser.forceNewline('`.pool` statement');
              result.pool();
              break;
            case 'thumb':
              parser.forceNewline('`.thumb` statement');
              result.setMode('thumb');
              break;
            default:
              throw new CompError(tk2, `Unknown statement: \`.${tk2.id}\``);
          }
          break;
        case 'punc':
        case 'newline':
        case 'num':
        case 'str':
          throw new CompError(tk2, 'Invalid statement inside `.begin`');
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
        result.addSymNamedLabel(tk);
        parser.nextTok();
        parser.forceNewline('label');
      } else if (tk.id.charAt(0) === '_') {
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
        const mode = result.mode();
        switch (mode) {
          case 'none':
            throw new CompError(tk, 'Unknown assembler mode (`.arm` or `.thumb`)');
          case 'arm': {
            const pool = parsePoolStatement(parser, result);
            if (pool) {
              parseARMPoolStatement(tk, pool, parser, result);
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
                    const res = parseARMStatement(op, parser, result);
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
            parser.forceNewline('ARM statement');
            break;
          }
          case 'thumb': {
            const pool = parsePoolStatement(parser, result);
            if (pool) {
              parseThumbPoolStatement(tk, pool, parser, result);
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
                    const res = parseThumbStatement(tk, op, parser, result);
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
      return;
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

function parseBegin(parser: Parser, result: ParsedFile) {
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
  result.beginStart(tk1, name);
  while (!parser.checkEnd()) {
    if (!parser.hasTok()) {
      throw new CompError(
        parser.tks[parser.tks.length - 1],
        `Missing \`.end\` for \`.begin\` on line ${tk.line}`,
      );
    }
    parseBeginBody(parser, result);
  }
  result.beginEnd();
}

async function parseInclude(parser: Parser, result: ParsedFile) {
  const tk = parser.nextTok();
  if (tk.kind !== 'str') {
    throw new CompError(tk, 'Expecting `.include \'file.gvasm\'');
  }
  parser.forceNewline('`.include` statement');
  await result.include(tk.str);
}

async function parseFileImport(parser: Parser, result: ParsedFile): Promise<boolean> {
  if (!parser.isNext2('.', 'import')) {
    return false;
  }
  const imp = parser.nextTok();
  parser.nextTok();

  const filenameTok = parser.nextTokOptional();
  if (!filenameTok || filenameTok.kind !== 'str') {
    throw new CompError(imp, 'Expecting `.import \'file.gvasm\' ...`');
  }
  const filename = filenameTok.str;

  const tk = parser.nextTokOptional();
  if (tk && tk.kind === 'id') {
    await result.importAll(imp, filename, tk.id);
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
    await result.importNames(imp, filename, names);
  } else {
    throw new CompError(
      imp,
      'Expecting `.import \'file.gvasm\' Name` or `.import \'file.gvasm\' { Names, ... }',
    );
  }

  parser.forceNewline('`.import` statement');

  return true;
}

async function parseFileBody(parser: Parser, result: ParsedFile): Promise<boolean> {
  const tk = parser.nextTokOptional();
  if (!tk) return false;
  switch (tk.kind) {
    case 'punc': {
      if (tk.punc !== '.' || !parser.hasTok()) {
        throw new CompError(tk, 'Invalid statement');
      }
      const tk2 = parser.nextTok();
      switch (tk2.kind) {
        case 'id':
          if (!parser.hasTok()) {
            throw new CompError(tk2, 'Invalid statement');
          }
          switch (tk2.id) {
            case 'begin':
              parseBegin(parser, result);
              break;
            case 'include':
              await parseInclude(parser, result);
              break;
            case 'pool':
              parser.forceNewline('`.pool` statement');
              result.pool();
              break;
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
    case 'newline':
      return true;
    case 'id':
      throw 'TODO: named labels';
    case 'str':
    case 'num':
      throw new CompError(tk, 'Invalid statement');
    case 'error':
      throw new CompError(tk, tk.msg);
    default:
      assertNever(tk);
  }
  return true;
}

export async function parse(
  proj: Project,
  filename: string,
  defines: { key: string; value: number }[],
  tks: ITok[],
): Promise<ParsedFile> {
  const result = new ParsedFile(proj, filename);

  for (const d of defines) {
    result.addSymNum({ filename, line: 1, chr: 1 }, d.key, d.value);
  }

  const parser = new Parser(tks);

  // parse imports, then body
  while (await parseFileImport(parser, result));
  while (await parseFileBody(parser, result));
  result.endOfFile();
  return result;
}
