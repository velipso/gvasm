//
// gvasm - Assembler and disassembler for Game Boy Advance homebrew
// by Sean Connelly (@velipso), https://sean.cm
// Project Home: https://github.com/velipso/gvasm
// SPDX-License-Identifier: 0BSD
//

import { IFilePos, ITok, ITokId } from './lexer.ts';
import { ARM, Thumb } from './ops.ts';
import { assertNever, calcRotImm, printf } from './util.ts';
import { Expression, reservedNames } from './expr.ts';
import { IBase, IMemory, Project } from './project.ts';
import { CompError, ITypedMemory } from './parser.ts';
import { stdlib } from './stdlib.ts';
import {
  IRewrite,
  Section,
  SectionAlign,
  SectionBase,
  SectionBaseShift,
  SectionBytes,
  SectionEmbed,
  SectionInclude,
  SectionMemory,
  SectionPool,
} from './section.ts';

export type Mode = 'none' | 'arm' | 'thumb';

export type ISyms = { [sym: string]: Expression | number };

interface IDebugStatementLog {
  kind: 'log';
  addr: number | false;
  format: string;
  context: IExpressionContext;
  args: Expression[];
}

interface IDebugStatementExit {
  kind: 'exit';
  addr: number | false;
}

export type IDebugStatement = IDebugStatementLog | IDebugStatementExit;

export type DataType =
  | 'i8'
  | 'ib8'
  | 'im8'
  | 'ibm8'
  | 'i16'
  | 'ib16'
  | 'im16'
  | 'ibm16'
  | 'i32'
  | 'ib32'
  | 'im32'
  | 'ibm32'
  | 'u8'
  | 'ub8'
  | 'um8'
  | 'ubm8'
  | 'u16'
  | 'ub16'
  | 'um16'
  | 'ubm16'
  | 'u32'
  | 'ub32'
  | 'um32'
  | 'ubm32';

export function dataTypeCreate(
  unsigned: boolean,
  bigendian: boolean,
  misaligned: boolean,
  size: number,
): DataType {
  if (size !== 8 && size !== 16 && size !== 32) {
    throw new Error('Invalid data type size');
  }
  return (
    (unsigned ? 'u' : 'i') +
    (bigendian ? 'b' : '') +
    (misaligned ? 'm' : '') +
    size
  ) as DataType;
}

export function dataTypeSigned(dataType: DataType) {
  return dataType.charAt(0) === 'i';
}

export function dataTypeLE(dataType: DataType) {
  return dataType.charAt(1) !== 'b';
}

export function dataTypeAligned(dataType: DataType) {
  return dataType.charAt(1) !== 'm' && dataType.charAt(2) !== 'm';
}

export function dataTypeToMisaligned(dataType: DataType): DataType {
  switch (dataType) {
    case 'i8':
      return 'im8';
    case 'ib8':
      return 'ibm8';
    case 'im8':
      return 'im8';
    case 'ibm8':
      return 'ibm8';
    case 'i16':
      return 'im16';
    case 'ib16':
      return 'ibm16';
    case 'im16':
      return 'im16';
    case 'ibm16':
      return 'ibm16';
    case 'i32':
      return 'im32';
    case 'ib32':
      return 'ibm32';
    case 'im32':
      return 'im32';
    case 'ibm32':
      return 'ibm32';
    case 'u8':
      return 'um8';
    case 'ub8':
      return 'ubm8';
    case 'um8':
      return 'um8';
    case 'ubm8':
      return 'ubm8';
    case 'u16':
      return 'um16';
    case 'ub16':
      return 'ubm16';
    case 'um16':
      return 'um16';
    case 'ubm16':
      return 'ubm16';
    case 'u32':
      return 'um32';
    case 'ub32':
      return 'ubm32';
    case 'um32':
      return 'um32';
    case 'ubm32':
      return 'ubm32';
    default:
      return assertNever(dataType);
  }
}

export function dataTypeSize(dataType: DataType) {
  const t = dataType.charAt(dataType.length - 1);
  if (t === '8') {
    return 1;
  } else if (t === '6') {
    return 2;
  }
  return 4;
}

type DefMap = Map<string, IDef>;

interface IDefBegin {
  kind: 'begin';
  map: DefMap;
  addr: number | false;
}

interface IDefNum {
  kind: 'num';
  num: number;
}

interface IDefLabel {
  kind: 'label';
  addr: number | false;
}

interface IDefImportAll {
  kind: 'importAll';
  fullFile: string;
}

interface IDefImportName {
  kind: 'importName';
  fullFile: string;
  name: string;
}

interface IDefConst {
  kind: 'const';
  context: IExpressionContext;
  body: Expression;
}

interface IDefScriptExport {
  kind: 'scriptExport';
  data: string;
}

interface IDefStruct {
  kind: 'struct';
  flp: IFilePos;
  context: IExpressionContext;
  base: Expression | 'iwram' | 'ewram' | false;
  struct: IStruct;
}

type IDef =
  | IDefBegin
  | IDefImportAll
  | IDefImportName
  | IDefLabel
  | IDefNum
  | IDefConst
  | IDefScriptExport
  | IDefStruct;

export interface IStruct {
  kind: 'struct';
  flp: IFilePos;
  length: Expression | false;
  members: { name: string | false; member: IStructMember }[];
  memoryStart: number | false;
}

interface IStructData {
  kind: 'data';
  flp: IFilePos;
  length: Expression | false;
  dataType: DataType;
}

interface IStructLabel {
  kind: 'label';
}

interface IStructAlign {
  kind: 'align';
  amount: number;
}

export type IStructMember =
  | IStruct
  | IStructData
  | IStructLabel
  | IStructAlign;

interface IReverseLabel {
  name: string;
  addr: number | false;
  level: number;
}

interface IForwardLabel {
  name: string;
  addr: number | false;
  defined: boolean;
  usedBy: unknown[];
}

interface ILookupData {
  kind: 'lookupData';
  dataType: DataType;
  value: number | false;
}

type ILookup =
  | number
  | IDefConst
  | IDefScriptExport
  | ILookupData;

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
    return this;
  }

  get() {
    if (this.bpos !== this.maxSize) {
      throw new Error(`Opcode length isn't ${this.maxSize} bits`);
    }
    return this.value;
  }
}

export interface IExpressionContext {
  imp: Import;
  defHere: DefMap[];
  reverseLabels: IReverseLabel[];
  mode: Mode;
  addr: number | false;
  base: number | false;
  bytes: number | false;
  hereOffset: number;
}

abstract class PendingWrite {
  flp: IFilePos;
  context: IExpressionContext;

  constructor(flp: IFilePos, context: IExpressionContext) {
    this.flp = flp;
    this.context = context;
  }

  abstract attemptWrite(failNotFound: boolean): boolean;
}

abstract class PendingWriteInstCommon<T> extends PendingWrite {
  op: T;
  syms: ISyms;
  rewrite: IRewrite<number>;

  constructor(
    flp: IFilePos,
    context: IExpressionContext,
    op: T,
    syms: ISyms,
    rewrite: IRewrite<number>,
  ) {
    super(flp, context);
    this.op = op;
    this.syms = syms;
    this.rewrite = rewrite;
  }
}

class PendingWriteInstARM extends PendingWriteInstCommon<ARM.IOp> {
  attemptWrite(failNotFound: boolean): boolean {
    // calculate all expressions
    const symNums: { [key: string]: number } = {};
    for (const [key, expr] of Object.entries(this.syms)) {
      if (typeof expr === 'number') {
        symNums[key] = expr;
      } else {
        const v = expr.value(this.context, failNotFound, false);
        if (v === false) {
          return false;
        }
        symNums[key] = v;
      }
    }

    // generate opcode
    const address = this.rewrite.addr();
    const opcode = new BitNumber(32);
    for (const codePart of this.op.codeParts) {
      switch (codePart.k) {
        case 'immediate': {
          const v = symNums[codePart.sym];
          if (v < 0 || v >= (1 << codePart.s)) {
            throw new CompError(
              this.flp,
              `Immediate value out of range 0..${
                (1 << codePart.s) -
                1
              }: ${v}`,
            );
          }
          opcode.push(codePart.s, v);
          break;
        }
        case 'enum':
        case 'register':
        case 'reglist':
          opcode.push(codePart.s, symNums[codePart.sym]);
          break;
        case 'value':
        case 'ignored':
          opcode.push(codePart.s, codePart.v);
          break;
        case 'rotimm': {
          const rotimm = calcRotImm(symNums[codePart.sym]);
          if (rotimm === false) {
            throw new CompError(
              this.flp,
              `Can't generate rotated immediate from ${symNums[codePart.sym]}`,
            );
          }
          opcode.push(12, rotimm);
          break;
        }
        case 'word': {
          if (address === false) {
            return false;
          }
          const offset = symNums[codePart.sym] - address - 8;
          if (offset & 3) {
            throw new CompError(this.flp, 'Can\'t branch to misaligned memory address');
          }
          opcode.push(codePart.s, offset >> 2);
          break;
        }
        case 'offset12':
        case 'pcoffset12': {
          let offset;
          if (codePart.k === 'offset12') {
            offset = symNums[codePart.sym];
          } else {
            if (address === false) {
              return false;
            }
            offset = symNums[codePart.sym] - address - 8;
          }
          if (codePart.sign) {
            opcode.push(codePart.s, offset < 0 ? 0 : 1);
          } else {
            const v = Math.abs(offset);
            if (v >= (1 << codePart.s)) {
              throw new CompError(this.flp, `Offset too large: ${v}`);
            }
            opcode.push(codePart.s, v);
          }
          break;
        }
        case 'offsetsplit':
        case 'pcoffsetsplit': {
          let offset;
          if (codePart.k === 'offsetsplit') {
            offset = symNums[codePart.sym];
          } else {
            if (address === false) return false;
            offset = symNums[codePart.sym] - address - 8;
          }
          if (codePart.sign) {
            opcode.push(codePart.s, offset < 0 ? 0 : 1);
          } else {
            const v = Math.abs(offset);
            if (v > 0xff) {
              throw new CompError(this.flp, `Offset too large: ${v}`);
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

    this.rewrite.write(opcode.get());
    return true;
  }
}

class PendingWriteInstThumb extends PendingWriteInstCommon<Thumb.IOp> {
  attemptWrite(failNotFound: boolean): boolean {
    // calculate all expressions
    const symNums: { [key: string]: number } = {};
    for (const [key, expr] of Object.entries(this.syms)) {
      if (typeof expr === 'number') {
        symNums[key] = expr;
      } else {
        const v = expr.value(this.context, failNotFound, false);
        if (v === false) {
          return false;
        }
        symNums[key] = v;
      }
    }

    // generate opcode
    const address = this.rewrite.addr();
    const opcode = new BitNumber(this.op.doubleInstruction ? 32 : 16);
    const pushAlign = (size: number, v: number, shift: number) => {
      if (v < 0 || v >= (1 << (size + shift))) {
        throw new CompError(
          this.flp,
          `Immediate value out of range 0..${
            ((1 << size) - 1) <<
            shift
          }: ${v}`,
        );
      }
      if (v & ((1 << shift) - 1)) {
        throw new CompError(
          this.flp,
          `Immediate value is not ${shift === 2 ? 'word' : 'halfword'} aligned: ${v}`,
        );
      }
      opcode.push(size, v >> shift);
    };
    for (const codePart of this.op.codeParts) {
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
            throw new CompError(this.flp, `Offset too large: ${offset}`);
          } else if (offset & 1) {
            throw new CompError(this.flp, 'Can\'t branch to misaligned memory address');
          }
          opcode.push(codePart.s, offset >> 1);
          break;
        }
        case 'pcoffset': {
          if (address === false) return false;
          const offset = symNums[codePart.sym] - (address & 0xfffffffd) - 4;
          if (offset < 0) {
            throw new CompError(this.flp, 'Can\'t load from address before PC in thumb mode');
          } else if (offset & 3) {
            throw new CompError(this.flp, 'Can\'t load from misaligned address');
          }
          pushAlign(codePart.s, offset, 2);
          break;
        }
        case 'offsetsplit': {
          if (address === false) return false;
          const offset = symNums[codePart.sym] - address - 4;
          if (offset < -4194304 || offset >= 4194304) {
            throw new CompError(this.flp, `Offset too large: ${offset}`);
          } else if (offset & 1) {
            throw new CompError(this.flp, 'Can\'t branch to misaligned memory address');
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

    this.rewrite.write(opcode.get());
    return true;
  }
}

class PendingWriteData extends PendingWrite {
  data: (number | Expression)[];
  rewrite: IRewrite<number[]>;

  constructor(
    flp: IFilePos,
    context: IExpressionContext,
    data: (number | Expression)[],
    rewrite: IRewrite<number[]>,
  ) {
    super(flp, context);
    this.data = data;
    this.rewrite = rewrite;
  }

  attemptWrite(failNotFound: boolean): boolean {
    if (failNotFound) {
      const data: number[] = [];
      for (const expr of this.data) {
        if (typeof expr === 'number') {
          data.push(expr);
        } else {
          const v = expr.value(this.context, failNotFound, false);
          if (v === false) {
            return false;
          }
          data.push(v);
        }
      }
      this.rewrite.write(data);
      return true;
    } else {
      let allNumber = true;
      const data: (number | Expression)[] = [];
      for (const expr of this.data) {
        if (typeof expr === 'number') {
          data.push(expr);
        } else {
          const v = expr.value(this.context, failNotFound, false);
          if (v === false) {
            data.push(expr);
            allNumber = false;
          } else {
            data.push(v);
          }
        }
      }
      this.data = data; // cache results
      if (!allNumber) {
        return false;
      }
      this.rewrite.write(data as number[]); // verified via allNumber
      return true;
    }
  }
}

class PendingWriteDataFill extends PendingWrite {
  amount: number;
  fill: number | Expression;
  fillCache: { array: number[]; fill: number } | undefined;
  rewrite: IRewrite<number[]>;

  constructor(
    flp: IFilePos,
    context: IExpressionContext,
    amount: number,
    fill: number | Expression,
    rewrite: IRewrite<number[]>,
  ) {
    super(flp, context);
    this.amount = amount;
    this.fill = fill;
    this.rewrite = rewrite;
  }

  write(fill: number) {
    if (!this.fillCache || this.fillCache.fill !== fill) {
      const array: number[] = [];
      for (let i = 0; i < this.amount; i++) {
        array.push(fill);
      }
      this.fillCache = { array, fill };
    }
    this.rewrite.write(this.fillCache.array);
  }

  attemptWrite(failNotFound: boolean): boolean {
    if (failNotFound) {
      const fill = typeof this.fill === 'number'
        ? this.fill
        : this.fill.value(this.context, failNotFound, false);
      if (fill === false) {
        return false;
      }
      this.write(fill);
      return true;
    } else {
      const fill = typeof this.fill === 'number'
        ? this.fill
        : this.fill.value(this.context, failNotFound, false);
      if (fill === false) {
        return false;
      }
      this.fill = fill;
      this.write(fill);
      return true;
    }
  }
}

class PendingWritePrintf extends PendingWrite {
  format: string;
  args: (number | Expression)[];
  error: boolean;
  log: (str: string) => void;

  constructor(
    flp: IFilePos,
    context: IExpressionContext,
    format: string,
    args: Expression[],
    error: boolean,
    log: (str: string) => void,
  ) {
    super(flp, context);
    this.format = format;
    this.args = args;
    this.error = error;
    this.log = log;
  }

  attemptWrite(failNotFound: boolean): boolean {
    if (failNotFound) {
      const data: number[] = [];
      for (const expr of this.args) {
        if (typeof expr === 'number') {
          data.push(expr);
        } else {
          const v = expr.value(this.context, failNotFound, false);
          if (v === false) {
            return false;
          }
          data.push(v);
        }
      }
      const msg = printf(this.format, ...data);
      if (this.error) {
        throw new CompError(this.flp, msg);
      } else {
        this.log(msg);
      }
      return true;
    } else {
      let allNumber = true;
      const data: (number | Expression)[] = [];
      for (const expr of this.args) {
        if (typeof expr === 'number') {
          data.push(expr);
        } else {
          const v = expr.value(this.context, failNotFound, false);
          if (v === false) {
            data.push(expr);
            allNumber = false;
          } else {
            data.push(v);
          }
        }
      }
      this.args = data; // cache results
      if (!allNumber) {
        return false;
      }
      const msg = printf(this.format, ...(data as number[])); // verified via allNumber
      if (this.error) {
        throw new CompError(this.flp, msg);
      } else {
        this.log(msg);
      }
      return true;
    }
  }
}

class PendingWriteAssert extends PendingWrite {
  message: string;
  expr: number | Expression;

  constructor(
    flp: IFilePos,
    context: IExpressionContext,
    message: string,
    expr: Expression,
  ) {
    super(flp, context);
    this.message = message;
    this.expr = expr;
  }

  attemptWrite(failNotFound: boolean): boolean {
    if (failNotFound) {
      const v = typeof this.expr === 'number'
        ? this.expr
        : this.expr.value(this.context, failNotFound, false);
      if (v === false) {
        return false;
      }
      if (v === 0) {
        throw new CompError(this.flp, `Assertion failed: ${this.message}`);
      }
      return true;
    } else {
      const v = typeof this.expr === 'number'
        ? this.expr
        : this.expr.value(this.context, failNotFound, false);
      if (v === false) {
        return false;
      }
      this.expr = v; // cache result
      if (v === 0) {
        throw new CompError(this.flp, `Assertion failed: ${this.message}`);
      }
      return true;
    }
  }
}

abstract class PendingWriteTypedMemCommon extends PendingWrite {
  typedMem: ITypedMemory;
  rewrite: IRewrite<number>;

  constructor(
    flp: IFilePos,
    context: IExpressionContext,
    typedMem: ITypedMemory,
    rewrite: IRewrite<number>,
  ) {
    super(flp, context);
    this.typedMem = typedMem;
    this.rewrite = rewrite;
  }
}

class PendingWriteTypedMemARM extends PendingWriteTypedMemCommon {
  attemptWrite(failNotFound: boolean): boolean {
    const dataTypeOut: [DataType | false] = [false];
    const field = this.typedMem.field.value(
      this.context,
      failNotFound,
      false,
      undefined,
      undefined,
      dataTypeOut,
    );
    const [dataType] = dataTypeOut;
    if (field === false || dataType === false) {
      return false;
    }
    switch (dataTypeSize(dataType)) {
      case 1:
        switch (this.typedMem.kind) {
          case 'ldrImm':
          case 'strImm':
            if (this.typedMem.kind.startsWith('ldr') && dataTypeSigned(dataType)) {
              const v = this.typedMem.zero ? 0 : Math.abs(field);
              if (v >= (1 << 8)) {
                throw new CompError(this.flp, `Offset too large: ${v}`);
              }
              this.rewrite.write(
                new BitNumber(32)
                  .push(4, v & 0xf)
                  .push(1, 1) // constant
                  .push(2, 2) // signed byte
                  .push(1, 1) // constant
                  .push(4, (v >> 4) & 0xf)
                  .push(4, this.typedMem.rd)
                  .push(4, this.typedMem.rb)
                  .push(1, 1) // load
                  .push(1, 0) // no write back
                  .push(1, 1) // constant
                  .push(1, field < 0 ? 0 : 1)
                  .push(1, 1) // pre indexing
                  .push(3, 0) // constant
                  .push(4, this.typedMem.cond)
                  .get(),
              );
            } else {
              const v = this.typedMem.zero ? 0 : Math.abs(field);
              if (v >= (1 << 12)) {
                throw new CompError(this.flp, `Offset too large: ${v}`);
              }
              this.rewrite.write(
                new BitNumber(32)
                  .push(12, v)
                  .push(4, this.typedMem.rd)
                  .push(4, this.typedMem.rb)
                  .push(1, this.typedMem.kind.startsWith('str') ? 0 : 1)
                  .push(1, 0) // no write back
                  .push(1, 1) // transfer byte
                  .push(1, field < 0 ? 0 : 1)
                  .push(1, 1) // pre indexing
                  .push(1, 0) // immediate offset
                  .push(2, 1) // constant
                  .push(4, this.typedMem.cond)
                  .get(),
              );
            }
            return true;
          case 'ldrReg':
          case 'strReg':
            if (this.typedMem.kind.startsWith('ldr') && dataTypeSigned(dataType)) {
              this.rewrite.write(
                new BitNumber(32)
                  .push(4, this.typedMem.ro)
                  .push(1, 1) // constant
                  .push(2, 2) // signed byte
                  .push(1, 1) // constant
                  .push(4, 0) // constant
                  .push(4, this.typedMem.rd)
                  .push(4, this.typedMem.rb)
                  .push(1, 1) // load
                  .push(1, 0) // no write back
                  .push(1, 0) // constant
                  .push(1, 1) // add offset
                  .push(1, 1) // pre indexing
                  .push(3, 0) // constant
                  .push(4, this.typedMem.cond)
                  .get(),
              );
            } else {
              this.rewrite.write(
                new BitNumber(32)
                  .push(4, this.typedMem.ro)
                  .push(8, 0) // no shift
                  .push(4, this.typedMem.rd)
                  .push(4, this.typedMem.rb)
                  .push(1, this.typedMem.kind.startsWith('str') ? 0 : 1)
                  .push(1, 0) // no write back
                  .push(1, 1) // transfer byte
                  .push(1, 1) // add offset
                  .push(1, 1) // pre indexing
                  .push(1, 1) // register offset
                  .push(2, 1) // constant
                  .push(4, this.typedMem.cond)
                  .get(),
              );
            }
            return true;
          default:
            assertNever(this.typedMem);
        }
        break;
      case 2:
        switch (this.typedMem.kind) {
          case 'ldrImm':
          case 'strImm': {
            const v = this.typedMem.zero ? 0 : Math.abs(field);
            if (v >= (1 << 8)) {
              throw new CompError(this.flp, `Offset too large: ${v}`);
            }
            this.rewrite.write(
              new BitNumber(32)
                .push(4, v & 0xf)
                .push(1, 1) // constant
                .push(2, this.typedMem.kind.startsWith('ldr') && dataTypeSigned(dataType) ? 3 : 1)
                .push(1, 1) // constant
                .push(4, (v >> 4) & 0xf)
                .push(4, this.typedMem.rd)
                .push(4, this.typedMem.rb)
                .push(1, this.typedMem.kind.startsWith('str') ? 0 : 1)
                .push(1, 0) // no write back
                .push(1, 1) // constant
                .push(1, field < 0 ? 0 : 1)
                .push(1, 1) // pre indexing
                .push(3, 0) // constant
                .push(4, this.typedMem.cond)
                .get(),
            );
            return true;
          }
          case 'ldrReg':
          case 'strReg':
            this.rewrite.write(
              new BitNumber(32)
                .push(4, this.typedMem.ro)
                .push(1, 1) // constant
                .push(2, this.typedMem.kind.startsWith('ldr') && dataTypeSigned(dataType) ? 3 : 1)
                .push(1, 1) // constant
                .push(4, 0) // constant
                .push(4, this.typedMem.rd)
                .push(4, this.typedMem.rb)
                .push(1, this.typedMem.kind.startsWith('str') ? 0 : 1)
                .push(1, 0) // no write back
                .push(1, 0) // constant
                .push(1, 1) // add offset
                .push(1, 1) // pre indexing
                .push(3, 0) // constant
                .push(4, this.typedMem.cond)
                .get(),
            );
            return true;
          default:
            assertNever(this.typedMem);
        }
        break;
      case 4:
        switch (this.typedMem.kind) {
          case 'ldrImm':
          case 'strImm': {
            const v = this.typedMem.zero ? 0 : Math.abs(field);
            if (v >= (1 << 12)) {
              throw new CompError(this.flp, `Offset too large: ${v}`);
            }
            this.rewrite.write(
              new BitNumber(32)
                .push(12, v)
                .push(4, this.typedMem.rd)
                .push(4, this.typedMem.rb)
                .push(1, this.typedMem.kind.startsWith('str') ? 0 : 1)
                .push(1, 0) // no write back
                .push(1, 0) // transfer word
                .push(1, field < 0 ? 0 : 1)
                .push(1, 1) // pre indexing
                .push(1, 0) // immediate offset
                .push(2, 1) // constant
                .push(4, this.typedMem.cond)
                .get(),
            );
            return true;
          }
          case 'ldrReg':
          case 'strReg':
            this.rewrite.write(
              new BitNumber(32)
                .push(4, this.typedMem.ro)
                .push(8, 0) // no shift
                .push(4, this.typedMem.rd)
                .push(4, this.typedMem.rb)
                .push(1, this.typedMem.kind.startsWith('str') ? 0 : 1)
                .push(1, 0) // no write back
                .push(1, 0) // transfer word
                .push(1, 1) // add offset
                .push(1, 1) // pre indexing
                .push(1, 1) // register offset
                .push(2, 1) // constant
                .push(4, this.typedMem.cond)
                .get(),
            );
            return true;
          default:
            assertNever(this.typedMem);
        }
        break;
    }
  }
}

class PendingWriteTypedMemThumb extends PendingWriteTypedMemCommon {
  constructor(
    flp: IFilePos,
    context: IExpressionContext,
    typedMem: ITypedMemory,
    rewrite: IRewrite<number>,
  ) {
    super(flp, context, typedMem, rewrite);
    const validateReg = (r: number) => {
      if (r < 0 || r >= 8) {
        throw new CompError(this.flp, 'Invalid register; register must be in r0-r7 range');
      }
    };
    validateReg(this.typedMem.rd);
    validateReg(this.typedMem.rb);
    switch (this.typedMem.kind) {
      case 'ldrImm':
      case 'strImm':
        break;
      case 'ldrReg':
      case 'strReg':
        validateReg(this.typedMem.ro);
        break;
      default:
        assertNever(this.typedMem);
    }
  }

  attemptWrite(failNotFound: boolean): boolean {
    const dataTypeOut: [DataType | false] = [false];
    const field = this.typedMem.field.value(
      this.context,
      failNotFound,
      false,
      undefined,
      undefined,
      dataTypeOut,
    );
    const [dataType] = dataTypeOut;
    if (field === false || dataType === false) {
      return false;
    }
    switch (dataTypeSize(dataType)) {
      case 1:
        switch (this.typedMem.kind) {
          case 'ldrImm':
            if (dataTypeSigned(dataType)) {
              throw new CompError(
                this.flp,
                'Cannot convert `ldrx rX, [rX, #Imm]` into `ldsb rX, [rX, #Imm]` because instruction doesn\'t exist in Thumb',
              );
            }
            // fall through
          case 'strImm': {
            const vs = this.typedMem.zero ? 0 : field;
            if (vs < 0 || vs >= (1 << 5)) {
              throw new CompError(this.flp, `Offset too large: ${vs}`);
            }
            this.rewrite.write(
              new BitNumber(16)
                .push(3, this.typedMem.rd)
                .push(3, this.typedMem.rb)
                .push(5, vs)
                .push(1, this.typedMem.kind.startsWith('str') ? 0 : 1)
                .push(1, 1) // byte
                .push(3, 3) // constant
                .get(),
            );
            return true;
          }
          case 'ldrReg':
          case 'strReg':
            if (this.typedMem.kind.startsWith('ldr') && dataTypeSigned(dataType)) {
              this.rewrite.write(
                new BitNumber(16)
                  .push(3, this.typedMem.rd)
                  .push(3, this.typedMem.rb)
                  .push(3, this.typedMem.ro)
                  .push(1, 1) // constant
                  .push(1, 1) // signed
                  .push(1, 0) // H = 0
                  .push(4, 5) // constant
                  .get(),
              );
            } else {
              this.rewrite.write(
                new BitNumber(16)
                  .push(3, this.typedMem.rd)
                  .push(3, this.typedMem.rb)
                  .push(3, this.typedMem.ro)
                  .push(1, 0) // constant
                  .push(1, 1) // byte
                  .push(1, this.typedMem.kind.startsWith('str') ? 0 : 1)
                  .push(4, 5) // constant
                  .get(),
              );
            }
            return true;
          default:
            assertNever(this.typedMem);
        }
        break;
      case 2:
        switch (this.typedMem.kind) {
          case 'ldrImm':
            if (dataTypeSigned(dataType)) {
              throw new CompError(
                this.flp,
                'Cannot convert `ldrx rX, [rX, #Imm]` into `ldsh rX, [rX, #Imm]` because instruction doesn\'t exist in Thumb',
              );
            }
            // fall through
          case 'strImm': {
            const v = this.typedMem.zero ? 0 : field;
            if (v & 1) {
              throw new CompError(this.flp, `Immediate value is not halfword aligned: ${v}`);
            }
            const vs = v >> 1;
            if (vs < 0 || vs >= (1 << 5)) {
              throw new CompError(this.flp, `Offset too large: ${v}`);
            }
            this.rewrite.write(
              new BitNumber(16)
                .push(3, this.typedMem.rd)
                .push(3, this.typedMem.rb)
                .push(5, vs)
                .push(1, this.typedMem.kind.startsWith('str') ? 0 : 1)
                .push(4, 8) // constant
                .get(),
            );
            return true;
          }
          case 'ldrReg':
          case 'strReg':
            this.rewrite.write(
              new BitNumber(16)
                .push(3, this.typedMem.rd)
                .push(3, this.typedMem.rb)
                .push(3, this.typedMem.ro)
                .push(1, 1) // constant
                .push(1, this.typedMem.kind.startsWith('ldr') && dataTypeSigned(dataType) ? 1 : 0)
                .push(1, this.typedMem.kind.startsWith('str') ? 0 : 1)
                .push(4, 5) // constant
                .get(),
            );
            return true;
          default:
            assertNever(this.typedMem);
        }
        break;
      case 4:
        switch (this.typedMem.kind) {
          case 'ldrImm':
          case 'strImm': {
            const v = this.typedMem.zero ? 0 : field;
            if (v & 3) {
              throw new CompError(this.flp, `Immediate value is not word aligned: ${v}`);
            }
            const vs = v >> 2;
            if (vs < 0 || vs >= (1 << 5)) {
              throw new CompError(this.flp, `Offset too large: ${v}`);
            }
            this.rewrite.write(
              new BitNumber(16)
                .push(3, this.typedMem.rd)
                .push(3, this.typedMem.rb)
                .push(5, vs)
                .push(1, this.typedMem.kind.startsWith('str') ? 0 : 1)
                .push(1, 0) // word
                .push(3, 3) // constant
                .get(),
            );
            return true;
          }
          case 'ldrReg':
          case 'strReg':
            this.rewrite.write(
              new BitNumber(16)
                .push(3, this.typedMem.rd)
                .push(3, this.typedMem.rb)
                .push(3, this.typedMem.ro)
                .push(1, 0) // constant
                .push(1, 0) // word
                .push(1, this.typedMem.kind.startsWith('str') ? 0 : 1)
                .push(4, 5) // constant
                .get(),
            );
            return true;
          default:
            assertNever(this.typedMem);
        }
        break;
    }
  }
}

export abstract class PendingWritePoolCommon extends PendingWrite {
  captured = false;
  cmdSize: number;
  rd: number;
  expr: Expression | number;
  rewrite: IRewrite<number>;
  poolAddr: 'unknown' | 'inline' | number = 'unknown';
  poolWriteExpr: (ex: number) => void = () => {};

  constructor(
    flp: IFilePos,
    context: IExpressionContext,
    cmdSize: number,
    rd: number,
    expr: Expression,
    rewrite: IRewrite<number>,
  ) {
    super(flp, context);
    this.cmdSize = cmdSize;
    this.rd = rd;
    this.expr = expr;
    this.rewrite = rewrite;
  }
}

class PendingWritePoolARM extends PendingWritePoolCommon {
  cmdSigned: boolean;
  cond: number;

  constructor(
    flp: IFilePos,
    context: IExpressionContext,
    cmdSize: number,
    cmdSigned: boolean,
    cond: number,
    rd: number,
    expr: Expression,
    rewrite: IRewrite<number>,
  ) {
    super(flp, context, cmdSize, rd, expr, rewrite);
    this.cmdSigned = cmdSigned;
    this.cond = cond;
  }

  writeInline(ex: number): boolean {
    if (this.cmdSize === 2) {
      ex &= 0xffff;
    } else if (this.cmdSize === 1) {
      ex &= 0xff;
    }
    if (this.cmdSigned) {
      // TODO: can we write sign extended loads as movs? probably
      return false;
    }
    const mov = calcRotImm(ex);
    if (mov !== false) {
      // convert to: mov rd, #expression
      // cond 0011 1010 0000 rd mov
      this.rewrite.write(
        (this.cond << 28) |
          0x03a00000 |
          (this.rd << 12) |
          mov,
      );
      if (this.poolAddr === 'unknown') {
        this.poolAddr = 'inline';
      }
      return true;
    }
    const mvn = calcRotImm(~ex);
    if (mvn !== false) {
      // convert to: mvn rd, #expression
      // cond 0011 1110 0000 rd mvn
      this.rewrite.write(
        (this.cond << 28) |
          0x03e00000 |
          (this.rd << 12) |
          mvn,
      );
      if (this.poolAddr === 'unknown') {
        this.poolAddr = 'inline';
      }
      return true;
    }
    return false;
  }

  attemptWrite(failNotFound: boolean): boolean {
    if (failNotFound) {
      // pool is flattened, so we have space in the pool if we need it
      let ex: number | false = false;
      if (this.expr instanceof Expression) {
        ex = this.expr.value(this.context, failNotFound, false);
      } else {
        ex = this.expr;
      }
      if (ex === false) {
        return false;
      }

      if (this.writeInline(ex)) {
        // turns out we don't need the pool space... guess it's wasted
        return true;
      }

      if (typeof this.poolAddr !== 'number') {
        throw new CompError(this.flp, 'Cannot resolve pool');
      }

      const address = this.rewrite.addr();
      if (address === false) { // shouldn't happen
        return false;
      }

      if (this.cmdSize === 4) {
        // convert to: ldr rd, [pc, #offset]
        // cond 0111 ?001 1111 rd offset
        const offset = this.poolAddr - address - 8;
        if (offset < -4) {
          throw new Error('Pool offset shouldn\'t be negative');
        } else if (offset > 0xfff) {
          throw new CompError(this.flp, 'Next `.pool` statement too far away');
        }
        this.rewrite.write(
          offset < 0
            ? ((this.cond << 28) | 0x051f0000 | (this.rd << 12) | Math.abs(offset))
            : ((this.cond << 28) | 0x059f0000 | (this.rd << 12) | offset),
        );
        this.poolWriteExpr(ex);
        return true;
      } else if (this.cmdSize === 2) {
        // convert to: ldrh rd, [pc, #offset]
        const offset = this.poolAddr - address - 8;
        if (offset < -4) {
          throw new Error('Pool offset shouldn\'t be negative');
        } else if (offset > 0xff) {
          throw new CompError(this.flp, 'Next `.pool` statement too far away');
        }
        const mask = (((Math.abs(offset) >> 4) & 0xf) << 8) | Math.abs(offset) & 0xf;
        const s = this.cmdSigned ? 0xf0 : 0xb0;
        this.rewrite.write(
          offset < 0
            ? ((this.cond << 28) | 0x015f0000 | s | (this.rd << 12) | mask)
            : ((this.cond << 28) | 0x01df0000 | s | (this.rd << 12) | mask),
        );
        this.poolWriteExpr(ex);
        return true;
      } else { // cmdSize === 1
        if (this.cmdSigned) {
          // convert to: ldrsb rd, [pc, #offset]
          const offset = this.poolAddr - address - 8;
          if (offset < -4) {
            throw new Error('Pool offset shouldn\'t be negative');
          } else if (offset > 0xff) {
            throw new CompError(this.flp, 'Next `.pool` statement too far away');
          }
          const mask = (((Math.abs(offset) >> 4) & 0xf) << 8) | Math.abs(offset) & 0xf;
          this.rewrite.write(
            offset < 0
              ? ((this.cond << 28) | 0x015f00d0 | (this.rd << 12) | mask)
              : ((this.cond << 28) | 0x01df00d0 | (this.rd << 12) | mask),
          );
          this.poolWriteExpr(ex);
          return true;
        } else {
          // convert to: ldrb rd, [pc, #offset]
          // cond 0101 ?101 1111 rd offset
          const offset = this.poolAddr - address - 8;
          if (offset < -4) {
            throw new Error('Pool offset shouldn\'t be negative');
          } else if (offset > 0xfff) {
            throw new CompError(this.flp, 'Next `.pool` statement too far away');
          }
          this.rewrite.write(
            offset < 0
              ? ((this.cond << 28) | 0x055f0000 | (this.rd << 12) | Math.abs(offset))
              : ((this.cond << 28) | 0x05df0000 | (this.rd << 12) | offset),
          );
          this.poolWriteExpr(ex);
          return true;
        }
      }
    } else {
      // pool isn't flattened yet, so try to convert to inline
      if (this.expr instanceof Expression) {
        const v = this.expr.value(this.context, failNotFound, false);
        if (v === false) {
          return false;
        }
        this.expr = v;
      }
      return this.writeInline(this.expr);
    }
  }
}

class PendingWritePoolThumb extends PendingWritePoolCommon {
  attemptWrite(failNotFound: boolean): boolean {
    if (failNotFound) {
      // pool is flattened, so we have space in the pool if we need it
      let ex: number | false = false;
      if (this.expr instanceof Expression) {
        ex = this.expr.value(this.context, failNotFound, false);
      } else {
        ex = this.expr;
      }
      if (ex === false) {
        return false;
      }

      const address = this.rewrite.addr();
      if (address === false) { // shouldn't happen
        return false;
      }

      const offset1 = ex - (address & 0xfffffffd) - 4;
      if (offset1 >= 0 && offset1 <= 1020 && (offset1 & 3) === 0) {
        // turns out we don't need the pool space... guess it's wasted
        // convert to: add rd, pc, #offset
        this.rewrite.write(0xa000 | (this.rd << 8) | (offset1 >> 2));
        if (this.poolAddr === 'unknown') {
          this.poolAddr = 'inline';
        }
        return true;
      }

      if (typeof this.poolAddr !== 'number') { // shouldn't happen
        return false;
      }

      // convert to: ldr rd, [pc, #offset]
      const offset2 = this.poolAddr - (address & 0xfffffffd) - 4;
      if (offset2 < 0) {
        throw new Error('Pool offset shouldn\'t be negative');
      } else if (offset2 & 3) {
        throw new CompError(this.flp, 'Can\'t load from misaligned address');
      } else if (offset2 > 0x3fc) {
        throw new CompError(this.flp, 'Next .pool too far away');
      }
      this.rewrite.write(0x4800 | (this.rd << 8) | (offset2 >> 2));
      this.poolWriteExpr(ex);
      return true;
    } else {
      // try to cache expression if possible
      if (this.expr instanceof Expression) {
        const v = this.expr.value(this.context, failNotFound, false);
        if (v === false) {
          return false;
        }
        this.expr = v;
      }
      return false;
    }
  }
}

interface ILevel {
  active: boolean;
  mode: Mode;
  regs: string[];
  newScope: boolean;
  shiftState: boolean;
}

export class Import {
  static defaultRegs = ['r0', 'r1', 'r2', 'r3', 'r4', 'r5', 'r6', 'r7', 'r8', 'r9', 'r10', 'r11'];
  static reservedRegs = ['r12', 'ip', 'r13', 'sp', 'r14', 'lr', 'r15', 'pc'];

  proj: Project;
  fullFile: string;
  main: boolean;
  defTable: DefMap = new Map();
  defHere = [this.defTable];
  levels: ILevel[] = [{
    active: true,
    mode: 'none',
    regs: Import.defaultRegs,
    newScope: true,
    shiftState: true,
  }];
  sections: Section[] = [];
  reverseLabels: IReverseLabel[] = [];
  forwardLabels: IForwardLabel[] = [];
  debugStatements: IDebugStatement[] = [];
  pendingWrites: { pw: PendingWrite; remove: () => void }[] = [];
  pendingCRC: (IRewrite<number> & { flp: IFilePos })[] = [];
  structs: IDefStruct[] = [];
  uniqueId = 0;
  hasStdlib = false;
  firstWrittenBase = -1;
  firstWrittenARM = true;

  constructor(proj: Project, fullFile: string, main: boolean) {
    this.proj = proj;
    this.fullFile = fullFile;
    this.main = main;
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

  expressionContext(hereOffset: number): IExpressionContext {
    return {
      imp: this,
      defHere: this.defHere,
      reverseLabels: this.reverseLabels.concat(),
      mode: this.mode(),
      addr: false,
      base: false,
      bytes: false,
      hereOffset,
    };
  }

  decodeRegister(t: ITokId, allowCpsr: boolean): number {
    if (allowCpsr && t.id === 'cpsr') {
      return 16;
    }
    const a = Import.reservedRegs.indexOf(t.id);
    if (a >= 0) {
      return 12 + (a >> 1);
    }
    const regs = this.regs();
    const b = regs.indexOf(t.id);
    if (b >= 0) {
      return b;
    }
    // attempt to provide friendly error message
    const c = Import.defaultRegs.indexOf(t.id);
    if (c >= 0) {
      throw new CompError(t, `Invalid register name; ${t.id} has been renamed to: ${regs[c]}`);
    }
    return -1;
  }

  isRegister(name: string) {
    return (
      name === 'cpsr' ||
      Import.reservedRegs.includes(name) ||
      Import.defaultRegs.includes(name) ||
      this.regs().includes(name)
    );
  }

  validateNewName(flp: IFilePos, name: string) {
    if (this.isRegister(name)) {
      throw new CompError(flp, `Cannot use register name: ${name}`);
    }
    this.validateRegName(flp, name);
  }

  validateRegName(flp: IFilePos, name: string) {
    if (name === 'cpsr' || Import.reservedRegs.includes(name)) {
      throw new CompError(flp, `Cannot use reserved register name: ${name}`);
    }
    if (reservedNames.includes(name)) {
      throw new CompError(flp, `Cannot use reserved name: ${name}`);
    }
    if (this.defHere[0].has(name)) {
      throw new CompError(flp, `Cannot redefine: ${name}`);
    }
    if (/^_[a-z]/.test(name)) {
      throw new CompError(flp, `Cannot start name with reserved prefix \`_[a-z]\`: ${name}`);
    }
  }

  addSymNum(flp: IFilePos, name: string, num: number) {
    if (!this.active()) {
      return;
    }
    this.validateNewName(flp, name);
    this.defHere[0].set(name, { kind: 'num', num });
  }

  addSymNamedLabel(tk: ITokId) {
    if (!this.active()) {
      return;
    }
    this.validateNewName(tk, tk.id);
    const label: IDefLabel = { kind: 'label', addr: false };
    this.tailBytes().addAddrRecv(label);
    this.defHere[0].set(tk.id, label);
  }

  addSymRelativeLabel(name: string) {
    if (!this.active()) {
      return;
    }
    if (name.charAt(0) === '-') {
      const label: IReverseLabel = { name, addr: false, level: this.defHere.length };
      this.reverseLabels.unshift(label);
      this.tailBytes().addAddrRecv(label);
    } else {
      for (const fwd of this.forwardLabels) {
        if (fwd.name === name && !fwd.defined) {
          fwd.defined = true;
          this.tailBytes().addAddrRecv(fwd);
          return;
        }
      }
    }
  }

  getForwardLabel(uniqueId: unknown, name: string): number | false {
    for (const fwd of this.forwardLabels) {
      if (fwd.usedBy.includes(uniqueId)) {
        return fwd.addr;
      }
      if (fwd.name === name && !fwd.defined) {
        fwd.usedBy.push(uniqueId);
        return fwd.addr;
      }
    }
    const label: IForwardLabel = { name, addr: false, defined: false, usedBy: [uniqueId] };
    this.forwardLabels.push(label);
    return false;
  }

  addSymConst(flp: IFilePos, name: string, body: Expression) {
    if (!this.active()) {
      return;
    }
    const context = this.expressionContext(0);
    this.tailBytes().addAddrRecv(context);
    this.validateNewName(flp, name);
    this.defHere[0].set(name, { kind: 'const', context, body });
  }

  addSymStruct(
    flp: IFilePos,
    name: string,
    base: Expression | 'iwram' | 'ewram' | false,
    struct: IStruct,
  ) {
    if (!this.active()) {
      return;
    }
    const context = this.expressionContext(0);
    this.validateNewName(flp, name);
    const defStruct: IDefStruct = { kind: 'struct', flp, context, base, struct };
    this.structs.push(defStruct);
    this.defHere[0].set(name, defStruct);
    if (base === 'iwram' || base === 'ewram') {
      this.sections.push(new SectionMemory(base, context, struct));
    }
  }

  stdlib(flp: IFilePos) {
    if (!this.active()) {
      return;
    }
    if (this.hasStdlib) {
      throw new CompError(flp, 'Cannot import `.stdlib` twice');
    }
    this.hasStdlib = true;
    for (const [name, value] of stdlib) {
      this.addSymNum(flp, name, value);
    }
  }

  static structSize(
    context: IExpressionContext,
    failNotFound: boolean,
    fromScript: string | false,
    struct: IStruct,
    base: number,
    useLength: boolean,
  ): { alignment: number; size: number } | false {
    let alignment = 1;
    let here = base;
    for (const { member } of struct.members) {
      switch (member.kind) {
        case 'align':
          alignment = Math.max(alignment, member.amount);
          if (member.amount > 1 && (here % member.amount) > 0) {
            here += member.amount - (here % member.amount);
          }
          break;
        case 'data': {
          const dsize = dataTypeSize(member.dataType);
          if (dataTypeAligned(member.dataType)) {
            alignment = Math.max(alignment, dsize);
            if ((here % dsize) !== 0) {
              throw new CompError(
                member.flp,
                `Misaligned member; add \`.align ${dsize}\` or change to \`.${
                  dataTypeToMisaligned(member.dataType)
                }\``,
              );
            }
          }
          if (member.length) {
            const length = member.length.value(context, failNotFound, fromScript);
            if (length === false) {
              return false;
            }
            if (length < 1) {
              throw new CompError(member.flp, `Invalid array length: ${length}`);
            }
            here += dsize * length;
          } else {
            here += dsize;
          }
          break;
        }
        case 'label':
          break;
        case 'struct': {
          const s = Import.structSize(context, failNotFound, fromScript, member, here, true);
          if (s === false) {
            return false;
          }
          alignment = Math.max(alignment, s.alignment);
          here += s.size;
          break;
        }
        default:
          assertNever(member);
      }
    }

    if (struct.length) {
      const length = struct.length.value(context, failNotFound, fromScript);
      if (length === false) {
        return false;
      }
      if (length < 1) {
        throw new CompError(struct.flp, `Invalid array length: ${length}`);
      } else if (length > 1) {
        const oneSize = here - base;
        if ((base % alignment) !== (here % alignment)) {
          throw new CompError(
            struct.flp,
            `Array becomes misaligned; add \`.align ${alignment}\` at end of struct`,
          );
        }
        if (useLength) {
          here += (length - 1) * oneSize;
        }
      }
    }

    return { alignment, size: here - base };
  }

  lookup(
    flp: IFilePos,
    context: IExpressionContext,
    failNotFound: boolean,
    fromScript: string | false,
    idPath: (string | number | Expression)[],
    uniqueId: unknown,
  ): ILookup | 'notfound' | false {
    const lookupStruct = (
      i: number,
      structCtx: IExpressionContext,
      struct: IStruct,
      base: number,
      didIndex: boolean,
    ): ILookup | 'notfound' | false => {
      if (i >= idPath.length) {
        return base;
      }
      const idHere = idPath[i];

      // special index
      if (idHere === '_length') {
        if (i + 1 < idPath.length) {
          throw new CompError(flp, 'Cannot index into constant number');
        }
        const length = struct.length === false
          ? 1
          : struct.length.value(structCtx, failNotFound, fromScript);
        if (length === false) {
          return false;
        }
        return length;
      } else if (idHere === '_bytes') {
        if (i + 1 < idPath.length) {
          throw new CompError(flp, 'Cannot index into constant number');
        }
        const s = Import.structSize(structCtx, failNotFound, fromScript, struct, base, true);
        if (s === false) {
          return false;
        }
        return s.size;
      }

      // numeric index
      if (!didIndex && struct.length) {
        if (typeof idHere === 'string') {
          throw new CompError(flp, 'Expecting index into array');
        }
        const index = typeof idHere === 'number'
          ? idHere
          : idHere.value(context, failNotFound, fromScript);
        if (index === false) {
          return false;
        }
        const length = struct.length.value(structCtx, failNotFound, fromScript);
        if (length === false) {
          return false;
        }
        if (index < 0 || index >= length) {
          throw new CompError(flp, 'Index outside array boundary');
        }
        const s = Import.structSize(structCtx, failNotFound, fromScript, struct, base, false);
        if (s === false) {
          return false;
        }
        return lookupStruct(i + 1, structCtx, struct, base + s.size * index, true);
      }

      // member index
      let here = base;
      for (const { name, member } of struct.members) {
        switch (member.kind) {
          case 'align':
            if (member.amount > 1 && (here % member.amount) > 0) {
              here += member.amount - (here % member.amount);
            }
            break;
          case 'data': {
            const dsize = dataTypeSize(member.dataType);
            if (name === idHere) {
              if (i + 1 >= idPath.length) {
                return {
                  kind: 'lookupData',
                  dataType: member.dataType,
                  value: here,
                };
              }
              const idNext = idPath[i + 1];

              // numeric index
              if (typeof idNext === 'number' || idNext instanceof Expression) {
                const index = typeof idNext === 'number'
                  ? idNext
                  : idNext.value(context, failNotFound, fromScript);
                if (index === false) {
                  return false;
                }
                if (member.length === false) {
                  throw new CompError(flp, 'Cannot index into non-array');
                }
                const length = member.length.value(structCtx, failNotFound, fromScript);
                if (length === false) {
                  return false;
                }
                if (index < 0 || index >= length) {
                  throw new CompError(flp, 'Index outside array boundary');
                }
                if (i + 2 < idPath.length) {
                  throw new CompError(flp, 'Cannot index into constant number');
                }
                return {
                  kind: 'lookupData',
                  dataType: member.dataType,
                  value: here + dsize * index,
                };
              }

              // special index
              if (idNext === '_length') {
                if (i + 2 < idPath.length) {
                  throw new CompError(flp, 'Cannot index into constant number');
                }
                const length = member.length === false
                  ? 1
                  : member.length.value(structCtx, failNotFound, fromScript);
                if (length === false) {
                  return false;
                }
                return length;
              } else if (idNext === '_bytes') {
                if (i + 2 < idPath.length) {
                  throw new CompError(flp, 'Cannot index into constant number');
                }
                const length = member.length === false
                  ? 1
                  : member.length.value(structCtx, failNotFound, fromScript);
                if (length === false) {
                  return false;
                }
                return dsize * length;
              }
            }
            if (member.length) {
              const length = member.length.value(structCtx, failNotFound, fromScript);
              if (length === false) {
                return false;
              }
              here += dsize * length;
            } else {
              here += dsize;
            }
            break;
          }
          case 'label':
            if (name === idHere) {
              if (i + 1 < idPath.length) {
                throw new CompError(flp, 'Cannot index into constant number');
              }
              return here;
            }
            break;
          case 'struct': {
            if (name === idHere) {
              return lookupStruct(i + 1, structCtx, member, here, false);
            }
            const s = Import.structSize(structCtx, failNotFound, fromScript, member, here, true);
            if (s === false) {
              return false;
            }
            here += s.size;
            break;
          }
          default:
            assertNever(member);
        }
      }
      return 'notfound';
    };

    const lookup = (i: number, here: DefMap): ILookup | 'notfound' | false => {
      const p = idPath[i];
      if (typeof p !== 'string') {
        return 'notfound';
      }
      const root = here.get(p);
      if (!root) {
        return 'notfound';
      }
      switch (root.kind) {
        case 'begin':
          return i + 1 < idPath.length ? lookup(i + 1, root.map) : root.addr;
        case 'importAll': {
          if (i + 1 >= idPath.length) {
            throw new CompError(flp, 'Cannot use imported name as value');
          }
          if (!fromScript && !failNotFound) {
            // don't resolve external symbols early unless required by a script
            return false;
          }
          const pf = this.proj.readFileCacheImport(root.fullFile, failNotFound, fromScript);
          if (!pf) {
            return false;
          }
          return lookup(i + 1, pf.defTable);
        }
        case 'importName': {
          if (!fromScript && !failNotFound) {
            // don't resolve external symbols early unless required by a script
            return false;
          }
          const pf = this.proj.readFileCacheImport(root.fullFile, failNotFound, fromScript);
          if (!pf) {
            return false;
          }
          return lookup(i, pf.defTable);
        }
        case 'label':
          if (i + 1 < idPath.length) {
            throw new CompError(flp, 'Cannot index into a label');
          }
          return root.addr;
        case 'num':
          if (i + 1 < idPath.length) {
            throw new CompError(flp, 'Cannot index into constant number');
          }
          return root.num;
        case 'const':
          return root;
        case 'scriptExport':
          if (i + 1 < idPath.length) {
            throw new CompError(flp, 'Cannot index into script export');
          }
          return root;
        case 'struct': {
          const base = root.base === false
            ? 0
            : root.base === 'iwram' || root.base === 'ewram'
            ? root.struct.memoryStart
            : root.base.value(root.context, failNotFound, fromScript);
          if (typeof base !== 'number') {
            return false;
          }
          return lookupStruct(i + 1, root.context, root.struct, base, false);
        }
        default:
          return assertNever(root);
      }
    };

    if (idPath.length === 1) {
      const label = idPath[0];
      if (typeof label === 'string' && label.charAt(0) === '-') {
        // lookup reverse label
        for (const rel of context.reverseLabels) {
          if (label === rel.name) {
            return rel.addr;
          }
        }
        return 'notfound';
      } else if (typeof label === 'string' && label.charAt(0) === '+') {
        // lookup forward label
        return this.getForwardLabel(uniqueId, label);
      }
    }

    for (const here of context.defHere) {
      const v = lookup(0, here);
      if (v !== 'notfound') {
        return v;
      }
    }
    return 'notfound';
  }

  async importAll(flp: IFilePos, filename: string, name: string) {
    const fullFile = this.proj.resolveFile(filename, this.fullFile);
    await this.proj.import(flp, fullFile);
    this.validateNewName(flp, name);
    this.defTable.set(name, { kind: 'importAll', fullFile });
  }

  async importNames(flp: IFilePos, filename: string, names: string[]) {
    const fullFile = this.proj.resolveFile(filename, this.fullFile);
    await this.proj.import(flp, fullFile);
    for (const name of names) {
      this.validateNewName(flp, name);
      this.defTable.set(name, { kind: 'importName', fullFile, name });
    }
  }

  include(flp: IFilePos, filename: string) {
    if (!this.active()) {
      return;
    }
    const fullFile = this.proj.resolveFile(filename, this.fullFile);
    this.sections.push(new SectionInclude(flp, this.proj, fullFile));
  }

  embed(flp: IFilePos, filename: string) {
    if (!this.active()) {
      return;
    }
    const fullFile = this.proj.resolveFile(filename, this.fullFile);
    this.sections.push(new SectionEmbed(flp, this.proj, fullFile));
  }

  beginStart(flp: IFilePos, name: string | undefined) {
    const symName = name ?? `%${this.uniqueId++}`;
    this.validateNewName(flp, symName);
    const entry: IDefBegin = {
      kind: 'begin',
      map: new Map(),
      addr: false,
    };
    this.tailBytes().addAddrRecv(entry);
    this.defHere[0].set(symName, entry);
    this.defHere = [entry.map, ...this.defHere];
    this.levels.unshift({
      active: this.active(),
      mode: this.mode(),
      regs: this.regs(),
      newScope: true,
      shiftState: false,
    });
  }

  enterScope(name: string) {
    const entry = this.defHere[0].get(name);
    if (!entry || entry.kind !== 'begin') {
      throw new Error(`Can't enter scope: ${name}`);
    }
    this.defHere = [entry.map, ...this.defHere];
    this.levels.unshift({
      active: this.active(),
      mode: this.mode(),
      regs: this.regs(),
      newScope: true,
      shiftState: false,
    });
  }

  ifStart(active: boolean) {
    this.levels.unshift({
      active: this.active() && active,
      mode: this.mode(),
      regs: this.regs(),
      newScope: false,
      shiftState: false,
    });
  }

  end() {
    const entry = this.levels.shift();
    if (!entry || this.levels.length <= 0) {
      throw new Error(`Can't call end without matching beginStart/enterScope/ifStart`);
    }
    if (entry.shiftState) {
      this.sections.push(new SectionBaseShift());
    }
    if (entry.newScope) {
      this.defHere = this.defHere.slice(1);
      // remove stale '---' labels
      while (this.reverseLabels.length > 0 && this.reverseLabels[0].level > this.defHere.length) {
        this.reverseLabels.shift();
      }
    }
  }

  async runScript(flp: IFilePos, body: string): Promise<ITok[]> {
    if (!this.active()) {
      return [];
    }
    return await this.proj.runScript(flp, this, body);
  }

  scriptExport(flp: IFilePos, name: string, data: string | number) {
    if (!this.active()) {
      return;
    }
    this.validateNewName(flp, name);
    if (typeof data === 'number') {
      this.defHere[0].set(name, { kind: 'num', num: data });
    } else {
      this.defHere[0].set(name, { kind: 'scriptExport', data });
    }
  }

  pool() {
    if (!this.active()) {
      return;
    }
    const pendingPools: PendingWritePoolCommon[] = [];
    for (const { pw } of this.pendingWrites) {
      if (pw instanceof PendingWritePoolCommon && !pw.captured) {
        pendingPools.push(pw);
      }
    }
    if (pendingPools.length > 0) {
      const mode = this.mode();
      this.sections.push(
        new SectionPool(pendingPools, mode === 'arm' ? 4 : mode === 'thumb' ? 2 : 1),
      );
    }
  }

  align(flp: IFilePos, amount: number, fill: number | 'nop') {
    if (!this.active()) {
      return;
    }
    this.sections.push(new SectionAlign(flp, this.mode(), amount, fill));
  }

  writeLogo() {
    if (!this.active()) {
      return;
    }
    this.tailBytes().logo();
  }

  writeTitle(flp: IFilePos, title: string) {
    if (!this.active()) {
      return;
    }
    const data = new TextEncoder().encode(title);
    if (data.length > 12) {
      throw new CompError(flp, 'Invalid `.title` statement: title can\'t exceed 12 bytes');
    }
    const bytes = this.tailBytes();
    for (let i = 0; i < 12; i++) {
      bytes.write8(i < data.length ? data[i] : 0);
    }
  }

  writeCRC(flp: IFilePos) {
    if (!this.active()) {
      return;
    }
    this.pendingCRC.push({ ...this.tailBytes().rewrite8(), flp });
  }

  writeInstARM(flp: IFilePos, op: ARM.IOp, syms: ISyms) {
    if (!this.active()) {
      return;
    }
    const bytes = this.tailBytes();
    bytes.setARM(true);
    bytes.forceAlignment(flp, 4, 'Misaligned instruction; add `.align 4`');
    const rewrite = bytes.rewrite32();
    const context = this.expressionContext(4);
    const pw = new PendingWriteInstARM(flp, context, op, syms, rewrite);
    this.addPendingWrite(pw);
  }

  writeTypedMemARM(flp: IFilePos, typedMem: ITypedMemory) {
    if (!this.active()) {
      return;
    }
    const bytes = this.tailBytes();
    bytes.setARM(true);
    bytes.forceAlignment(flp, 4, 'Misaligned instruction; add `.align 4`');
    const rewrite = bytes.rewrite32();
    const context = this.expressionContext(4);
    const pw = new PendingWriteTypedMemARM(flp, context, typedMem, rewrite);
    this.addPendingWrite(pw);
  }

  writePoolARM(
    flp: IFilePos,
    cmdSize: number,
    cmdSigned: boolean,
    cond: number,
    rd: number,
    expr: Expression,
  ) {
    if (!this.active()) {
      return;
    }
    const bytes = this.tailBytes();
    bytes.setARM(true);
    bytes.forceAlignment(flp, 4, 'Misaligned instruction; add `.align 4`');
    const rewrite = bytes.rewrite32();
    const context = this.expressionContext(4);
    const pw = new PendingWritePoolARM(flp, context, cmdSize, cmdSigned, cond, rd, expr, rewrite);
    this.addPendingWrite(pw);
  }

  writeInstThumb(flp: IFilePos, op: Thumb.IOp, syms: ISyms) {
    if (!this.active()) {
      return;
    }
    const bytes = this.tailBytes();
    bytes.setARM(false);
    bytes.forceAlignment(flp, 2, 'Misaligned instruction; add `.align 2`');
    const rewrite = op.doubleInstruction ? bytes.rewrite32() : bytes.rewrite16();
    const context = this.expressionContext(op.doubleInstruction ? 4 : 2);
    const pw = new PendingWriteInstThumb(flp, context, op, syms, rewrite);
    this.addPendingWrite(pw);
  }

  writeTypedMemThumb(flp: IFilePos, typedMem: ITypedMemory) {
    if (!this.active()) {
      return;
    }
    const bytes = this.tailBytes();
    bytes.setARM(false);
    bytes.forceAlignment(flp, 2, 'Misaligned instruction; add `.align 2`');
    const rewrite = bytes.rewrite16();
    const context = this.expressionContext(2);
    const pw = new PendingWriteTypedMemThumb(flp, context, typedMem, rewrite);
    this.addPendingWrite(pw);
  }

  writePoolThumb(flp: IFilePos, rd: number, expr: Expression) {
    if (!this.active()) {
      return;
    }
    const bytes = this.tailBytes();
    bytes.setARM(false);
    bytes.forceAlignment(flp, 2, 'Misaligned instruction; add `.align 2`');
    const rewrite = bytes.rewrite16();
    const context = this.expressionContext(2);
    const pw = new PendingWritePoolThumb(flp, context, 4, rd, expr, rewrite);
    this.addPendingWrite(pw);
  }

  writeData(flp: IFilePos, dataType: DataType, data: (number | Expression)[]) {
    if (!this.active()) {
      return;
    }
    const bytes = this.tailBytes();
    const dataSize = dataTypeSize(dataType);
    const context = this.expressionContext(dataSize);
    if ((dataSize === 2 || dataSize === 4) && dataTypeAligned(dataType)) {
      bytes.forceAlignment(
        flp,
        dataSize,
        `Misaligned data; add \`.align ${dataSize}\` or change to \`.${
          dataTypeToMisaligned(dataType)
        }\``,
      );
    }
    let rewrite: IRewrite<number[]>;
    switch (dataSize) {
      case 1:
        rewrite = bytes.rewriteArray8(data.length);
        break;
      case 2:
        rewrite = bytes.rewriteArray16(data.length, dataTypeLE(dataType));
        break;
      case 4:
        rewrite = bytes.rewriteArray32(data.length, dataTypeLE(dataType));
        break;
      default:
        throw new Error(`Invalid data type size? ${dataType}`);
    }
    this.addPendingWrite(new PendingWriteData(flp, context, data, rewrite));
  }

  writeDataFill(flp: IFilePos, dataType: DataType, amount: number, fill: number | Expression) {
    if (!this.active()) {
      return;
    }
    const bytes = this.tailBytes();
    const dataSize = dataTypeSize(dataType);
    const context = this.expressionContext(dataSize);
    if ((dataSize === 2 || dataSize === 4) && dataTypeAligned(dataType)) {
      bytes.forceAlignment(
        flp,
        dataSize,
        `Misaligned data; add \`.align ${dataSize}\` or change to \`.${
          dataTypeToMisaligned(dataType)
        }fill\``,
      );
    }
    let rewrite: IRewrite<number[]>;
    switch (dataSize) {
      case 1:
        rewrite = bytes.rewriteArray8(amount);
        break;
      case 2:
        rewrite = bytes.rewriteArray16(amount, dataTypeLE(dataType));
        break;
      case 4:
        rewrite = bytes.rewriteArray32(amount, dataTypeLE(dataType));
        break;
      default:
        throw new Error(`Invalid data type size? ${dataType}`);
    }
    this.addPendingWrite(new PendingWriteDataFill(flp, context, amount, fill, rewrite));
  }

  writeStr(str: string) {
    if (!this.active()) {
      return;
    }
    this.tailBytes().writeArray(new TextEncoder().encode(str));
  }

  printf(flp: IFilePos, format: string, args: Expression[], error: boolean) {
    if (!this.active()) {
      return;
    }
    const context = this.expressionContext(0);
    const pw = new PendingWritePrintf(flp, context, format, args, error, this.proj.getLog());
    this.addPendingWrite(pw);
  }

  assert(flp: IFilePos, message: string, expr: Expression) {
    if (!this.active()) {
      return;
    }
    const context = this.expressionContext(0);
    const pw = new PendingWriteAssert(flp, context, message, expr);
    this.addPendingWrite(pw);
  }

  debugLog(format: string, args: Expression[]) {
    const stmt: IDebugStatementLog = {
      kind: 'log',
      format,
      context: this.expressionContext(0),
      args,
      addr: false,
    };
    this.tailBytes().addAddrRecv(stmt);
    this.debugStatements.push(stmt);
  }

  debugExit() {
    const stmt: IDebugStatementExit = { kind: 'exit', addr: false };
    this.tailBytes().addAddrRecv(stmt);
    this.debugStatements.push(stmt);
  }

  private addPendingWrite(pw: PendingWrite) {
    if (!pw.attemptWrite(false)) {
      this.pendingWrites.push({ pw, remove: this.tailBytes().addAddrRecv(pw.context) });
    }
  }

  endOfFile() {
    // attempt rewrites now that we know more information
    for (let i = 0; i < this.pendingWrites.length; i++) {
      const { pw, remove } = this.pendingWrites[i];
      if (pw.attemptWrite(false)) {
        this.pendingWrites.splice(i, 1);
        remove();
        i--;
      }
    }
  }

  setBase(base: number) {
    if (!this.active()) {
      return;
    }
    const lv = this.levels[0];
    // overwrite the base at this level if we already unshifted a base here
    this.sections.push(new SectionBase(base, lv.shiftState));
    lv.shiftState = true;
  }

  setMode(mode: Mode) {
    this.levels[0].mode = mode;
  }

  mode(): Mode {
    return this.levels[0].mode;
  }

  setRegs(regs: string[]) {
    this.levels[0].regs = regs;
  }

  regs(): string[] {
    return this.levels[0].regs;
  }

  active(): boolean {
    return this.levels[0].active;
  }

  async flatten(initialBase: IBase, memory: IMemory, startLength: number): Promise<Uint8Array[]> {
    this.firstWrittenBase = -1;
    this.firstWrittenARM = true;
    const sections: Uint8Array[] = [];
    const bases = [initialBase];
    let length = startLength;
    for (const section of this.sections) {
      if (section instanceof SectionBase) {
        if (section.overwrite) {
          bases.shift();
        }
        bases.unshift({
          addr: section.base,
          relativeTo: length,
        });
      } else if (section instanceof SectionBaseShift) {
        bases.shift();
        if (bases.length <= 0) {
          throw new Error('Unbalanced base shift');
        }
      } else if (section instanceof SectionMemory) {
        const { kind, context, struct } = section;
        const size = Import.structSize(context, true, false, struct, 0, true);
        if (size === false) {
          throw new Error('Unknown struct size');
        }
        const sizeAligned = size.size + ((size.size % 4) === 0 ? 0 : (4 - (size.size % 4)));
        section.setMemoryStart(memory[kind]);
        const iwram = memory.iwram + (kind === 'iwram' ? sizeAligned : 0);
        const ewram = memory.ewram + (kind === 'ewram' ? sizeAligned : 0);
        if (iwram - 0x03000000 > 32 * 1024 - 256) {
          throw new CompError(struct.flp, 'Out of memory for static allocation in IWRAM');
        }
        if (ewram - 0x02000000 > 256 * 1024) {
          throw new CompError(struct.flp, 'Out of memory for static allocation in EWRAM');
        }
        memory.iwram = iwram;
        memory.ewram = ewram;
      } else {
        const baseAddr = bases[0].addr;
        const sects = await section.flatten(bases[0], memory, length);
        for (const sect of sects) {
          if (sect.length <= 0) {
            continue;
          }
          if (this.firstWrittenBase < 0) {
            this.firstWrittenBase = baseAddr;
            if (section instanceof SectionBytes) {
              this.firstWrittenARM = section.firstWrittenARM ?? true;
            }
          }
          length += sect.length;
          sections.push(sect);
        }
      }
    }
    return sections;
  }

  makeStart() {
    for (const section of this.sections) {
      if (section instanceof SectionBytes) {
        section.clearAddr();
      }
      if (section instanceof SectionPool) {
        section.clearWrite();
      }
      if (section instanceof SectionMemory) {
        section.clearMemoryStart();
      }
    }
  }

  makeEnd(crc: number | false) {
    for (const rw of this.pendingCRC) {
      if (crc === false) {
        throw new CompError(rw.flp, 'Cannot calculate CRC value');
      }
      rw.write(crc);
    }
    for (const { pw } of this.pendingWrites) {
      if (!pw.attemptWrite(true)) {
        throw new CompError(pw.flp, 'Failed to write instruction');
      }
    }
    // validate all structs by walking them
    for (const { flp, context, base, struct } of this.structs) {
      const baseNum = base === false || base === 'iwram' || base === 'ewram'
        ? 0
        : base.value(context, true, false);
      if (baseNum === false) {
        throw new CompError(flp, 'Cannot calculate struct base');
      }
      if (!Import.structSize(context, true, false, struct, baseNum, true)) {
        throw new CompError(flp, 'Cannot calculate struct layout');
      }
    }
  }
}
