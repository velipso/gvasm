//
// gvasm - Assembler and disassembler for Game Boy Advance homebrew
// by Sean Connelly (@velipso), https://sean.cm
// Project Home: https://github.com/velipso/gvasm
// SPDX-License-Identifier: 0BSD
//

import { IFilePos, ITokId } from './lexer.ts';
import { ARM, Thumb } from './ops.ts';
import { assertNever, printf } from './util.ts';
import { Expression, LookupFailMode, reservedNames } from './expr.ts';
import { IFileState, Project } from './project.ts';
import { CompError } from './parser.ts';
import { stdlib } from './stdlib.ts';

export type Mode = 'none' | 'arm' | 'thumb';

export type ISyms = { [sym: string]: Expression | number };

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
  if (t === '8') return 8;
  else if (t === '6') return 16;
  return 32;
}

abstract class Section {
  abstract flatten(state: IFileState, startLength: number): Promise<Uint8Array[]>;
}

interface IRewrite<T> {
  addr(): number | false;
  write(v: T): void;
}

class SectionBytes extends Section {
  private array: number[] = [];
  private byteArray: Uint8Array | undefined;
  private addrRecvs: { i: number; recv: { addr: number | false } }[] = [];
  private alignments: { flp: IFilePos; align: number; msg: string; i: number }[] = [];
  private addr: { base: { addr: number; relativeTo: number }; startLength: number } | false = false;

  async flatten(state: IFileState, startLength: number): Promise<Uint8Array[]> {
    this.addr = { base: state.base, startLength };
    const startAddr = state.base.addr + startLength - state.base.relativeTo;
    for (const { flp, align, msg, i } of this.alignments) {
      const addr = startAddr + i;
      if ((addr % align) !== 0) {
        throw new CompError(flp, msg);
      }
    }
    for (const { i, recv } of this.addrRecvs) {
      recv.addr = startAddr + i;
    }
    if (!this.byteArray) {
      this.byteArray = new Uint8Array(this.array);
    }
    return [this.byteArray];
  }

  clearAddr() {
    this.addr = false;
    for (const { recv } of this.addrRecvs) recv.addr = false;
  }

  addAddrRecv(recv: { addr: number | false }): () => void {
    const ar = { i: this.array.length, recv };
    this.addrRecvs.push(ar);
    return () => {
      const i = this.addrRecvs.indexOf(ar);
      if (i >= 0) this.addrRecvs.splice(i, 1);
    };
  }

  forceAlignment(flp: IFilePos, align: number, msg: string) {
    this.alignments.push({ flp, align, msg, i: this.array.length });
  }

  logo() {
    delete this.byteArray;
    // deno-fmt-ignore
    this.array.push(
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
  }

  write8(v: number) {
    delete this.byteArray;
    this.array.push(v & 0xff);
  }

  write16(v: number) {
    delete this.byteArray;
    this.array.push(v & 0xff, (v >> 8) & 0xff);
  }

  write32(v: number) {
    delete this.byteArray;
    this.array.push(v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >> 24) & 0xff);
  }

  writeArray(v: Uint8Array | number[]) {
    delete this.byteArray;
    for (let i = 0; i < v.length; i++) this.array.push(v[i] & 0xff);
  }

  rewrite8(): IRewrite<number> {
    const i = this.array.length;
    delete this.byteArray;
    this.array.push(0);
    return {
      addr: () => {
        if (this.addr === false) return false;
        return this.addr.base.addr + this.addr.startLength + i - this.addr.base.relativeTo;
      },
      write: (v: number) => {
        if (this.byteArray) {
          this.byteArray[i] = v & 0xff;
        } else {
          this.array[i] = v & 0xff;
        }
      },
    };
  }

  rewrite16(): IRewrite<number> {
    const i = this.array.length;
    delete this.byteArray;
    this.array.push(0, 0);
    return {
      addr: () => {
        if (this.addr === false) return false;
        return this.addr.base.addr + this.addr.startLength + i - this.addr.base.relativeTo;
      },
      write: (v: number) => {
        if (this.byteArray) {
          this.byteArray[i] = v & 0xff;
          this.byteArray[i + 1] = (v >> 8) & 0xff;
        } else {
          this.array[i] = v & 0xff;
          this.array[i + 1] = (v >> 8) & 0xff;
        }
      },
    };
  }

  rewrite32(): IRewrite<number> {
    const i = this.array.length;
    delete this.byteArray;
    this.array.push(0, 0, 0, 0);
    return {
      addr: () => {
        if (this.addr === false) return false;
        return this.addr.base.addr + this.addr.startLength + i - this.addr.base.relativeTo;
      },
      write: (v: number) => {
        if (this.byteArray) {
          this.byteArray[i] = v & 0xff;
          this.byteArray[i + 1] = (v >> 8) & 0xff;
          this.byteArray[i + 2] = (v >> 16) & 0xff;
          this.byteArray[i + 3] = (v >> 24) & 0xff;
        } else {
          this.array[i] = v & 0xff;
          this.array[i + 1] = (v >> 8) & 0xff;
          this.array[i + 2] = (v >> 16) & 0xff;
          this.array[i + 3] = (v >> 24) & 0xff;
        }
      },
    };
  }

  rewriteArray8(size: number): IRewrite<number[]> {
    const i = this.array.length;
    delete this.byteArray;
    for (let j = 0; j < size; j++) {
      this.array.push(0);
    }
    return {
      addr: () => {
        if (this.addr === false) return false;
        return this.addr.base.addr + this.addr.startLength + i - this.addr.base.relativeTo;
      },
      write: (v: number[]) => {
        if (v.length !== size) throw new Error('Bad rewrite for array');
        for (let j = 0; j < size; j++) {
          this.array[i + j] = v[j] & 0xff;
        }
      },
    };
  }

  rewriteArray16(size: number, littleEndian: boolean): IRewrite<number[]> {
    const i = this.array.length;
    delete this.byteArray;
    for (let j = 0; j < size; j++) {
      this.array.push(0, 0);
    }
    return {
      addr: () => {
        if (this.addr === false) return false;
        return this.addr.base.addr + this.addr.startLength + i - this.addr.base.relativeTo;
      },
      write: littleEndian
        ? (v: number[]) => {
          if (v.length !== size) throw new Error('Bad rewrite for array');
          for (let j = 0; j < size; j++) {
            this.array[i + j] = v[j] & 0xff;
            this.array[i + j + 1] = (v[j] >> 8) & 0xff;
          }
        }
        : (v: number[]) => {
          if (v.length !== size) throw new Error('Bad rewrite for array');
          for (let j = 0; j < size; j++) {
            this.array[i + j * 2] = (v[j] >> 8) & 0xff;
            this.array[i + j * 2 + 1] = v[j] & 0xff;
          }
        },
    };
  }

  rewriteArray32(size: number, littleEndian: boolean): IRewrite<number[]> {
    const i = this.array.length;
    delete this.byteArray;
    for (let j = 0; j < size; j++) {
      this.array.push(0, 0, 0, 0);
    }
    return {
      addr: () => {
        if (this.addr === false) return false;
        return this.addr.base.addr + this.addr.startLength + i - this.addr.base.relativeTo;
      },
      write: littleEndian
        ? (v: number[]) => {
          if (v.length !== size) throw new Error('Bad rewrite for array');
          for (let j = 0; j < size; j++) {
            this.array[i + j * 4] = v[j] & 0xff;
            this.array[i + j * 4 + 1] = (v[j] >> 8) & 0xff;
            this.array[i + j * 4 + 2] = (v[j] >> 16) & 0xff;
            this.array[i + j * 4 + 3] = (v[j] >> 24) & 0xff;
          }
        }
        : (v: number[]) => {
          if (v.length !== size) throw new Error('Bad rewrite for array');
          for (let j = 0; j < size; j++) {
            this.array[i + j * 4] = (v[j] >> 24) & 0xff;
            this.array[i + j * 4 + 1] = (v[j] >> 16) & 0xff;
            this.array[i + j * 4 + 2] = (v[j] >> 8) & 0xff;
            this.array[i + j * 4 + 3] = v[j] & 0xff;
          }
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

  flatten(state: IFileState, startLength: number): Promise<Uint8Array[]> {
    return this.proj.include(this.filename, state, startLength);
  }
}

class _SectionEmbed extends Section {
  proj: Project;
  filename: string;

  constructor(proj: Project, filename: string) {
    super();
    this.proj = proj;
    this.filename = filename;
  }

  async flatten(_state: IFileState, _startLength: number): Promise<Uint8Array[]> {
    return [await this.proj.embed(this.filename)];
  }
}

class SectionPool extends Section {
  pendingPools: PendingWritePoolCommon[];

  constructor(pendingPools: PendingWritePoolCommon[]) {
    super();
    this.pendingPools = pendingPools;
    for (const p of pendingPools) p.captured = true;
  }

  clearWrite() {
    // TODO: memory leak; does this help at all??????????????? I'm tired
    for (const p of this.pendingPools) p.poolWriteExpr = () => {};
  }

  async flatten(state: IFileState, startLength: number): Promise<Uint8Array[]> {
    const array: number[] = [];
    let bytes: Uint8Array | undefined = undefined;
    const startAddr = state.base.addr + startLength - state.base.relativeTo;
    for (const p of this.pendingPools) {
      if (p.poolAddr === 'inline') continue; // instruction doesn't need pool
      const cmdSize = p.cmdSize;
      // align the constant
      while ((startAddr + array.length) % cmdSize !== 0) {
        array.push(0);
      }
      // store the final address
      p.poolAddr = startAddr + array.length;
      const i = array.length;
      for (let j = 0; j < cmdSize; j++) array.push(0);
      p.poolWriteExpr = (ex: number) => {
        if (!bytes) throw new Error('Byte array isn\'t set');
        switch (cmdSize) {
          case 1:
            bytes[i] = ex & 0xff;
            break;
          case 2:
            bytes[i] = ex & 0xff;
            bytes[i + 1] = (ex >> 8) & 0xff;
            break;
          case 4:
            bytes[i] = ex & 0xff;
            bytes[i + 1] = (ex >> 8) & 0xff;
            bytes[i + 2] = (ex >> 16) & 0xff;
            bytes[i + 3] = (ex >> 24) & 0xff;
            break;
          default:
            throw new Error(`Invalid command size: ${cmdSize}`);
        }
      };
    }
    bytes = new Uint8Array(array);
    return [bytes];
  }
}

class SectionAlign extends Section {
  amount: number;
  fill: number | 'nop';

  constructor(amount: number, fill: number | 'nop') {
    super();
    this.amount = amount;
    this.fill = fill;
  }

  async flatten(state: IFileState, startLength: number): Promise<Uint8Array[]> {
    const array: number[] = [];
    const startAddr = state.base.addr + startLength - state.base.relativeTo;
    while (true) {
      const addr = startAddr + array.length;
      if (addr % this.amount === 0) break;
      if (this.fill === 'nop') {
        throw 'TODO: fill nop';
      } else {
        array.push(this.fill & 0xff);
      }
    }
    return array.length <= 0 ? [] : [new Uint8Array(array)];
  }
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
  filename: string;
}

interface IDefImportName {
  kind: 'importName';
  filename: string;
  name: string;
}

export type IDef =
  | IDefBegin
  | IDefImportAll
  | IDefImportName
  | IDefLabel
  | IDefNum;

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

export interface IPendingWriteContext {
  imp: Import;
  defHere: DefMap[];
  mode: Mode;
  addr: number | false;
}

abstract class PendingWrite {
  flp: IFilePos;
  context: IPendingWriteContext;

  constructor(flp: IFilePos, context: IPendingWriteContext) {
    this.flp = flp;
    this.context = context;
  }

  abstract attemptWrite(lookupFailMode: LookupFailMode): boolean;
}

abstract class PendingWriteInstCommon<T> extends PendingWrite {
  op: T;
  syms: ISyms;
  rewrite: IRewrite<number>;

  constructor(
    flp: IFilePos,
    context: IPendingWriteContext,
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

class PendingWriteInstARM extends PendingWriteInstCommon<ARM.IOp> {
  attemptWrite(lookupFailMode: LookupFailMode): boolean {
    // calculate all expressions
    const symNums: { [key: string]: number } = {};
    for (const [key, expr] of Object.entries(this.syms)) {
      if (typeof expr === 'number') {
        symNums[key] = expr;
      } else {
        const v = expr.value(this.context, lookupFailMode);
        if (v === false) return false;
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
          if (address === false) return false;
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
            if (address === false) return false;
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
  attemptWrite(lookupFailMode: LookupFailMode): boolean {
    // calculate all expressions
    const symNums: { [key: string]: number } = {};
    for (const [key, expr] of Object.entries(this.syms)) {
      if (typeof expr === 'number') {
        symNums[key] = expr;
      } else {
        const v = expr.value(this.context, lookupFailMode);
        if (v === false) return false;
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
    context: IPendingWriteContext,
    data: Expression[],
    rewrite: IRewrite<number[]>,
  ) {
    super(flp, context);
    this.data = data;
    this.rewrite = rewrite;
  }

  attemptWrite(lookupFailMode: LookupFailMode): boolean {
    if (lookupFailMode === 'deny') {
      const data: number[] = [];
      for (const expr of this.data) {
        if (typeof expr === 'number') {
          data.push(expr);
        } else {
          const v = expr.value(this.context, lookupFailMode);
          if (v === false) return false;
          data.push(v);
        }
      }
      this.rewrite.write(data);
      return true;
    } else {
      let returnFalse = false;
      const data: (number | Expression)[] = [];
      for (const expr of this.data) {
        if (typeof expr === 'number') {
          data.push(expr);
        } else {
          const v = expr.value(this.context, lookupFailMode);
          if (v === false) {
            data.push(expr);
            returnFalse = true;
          } else {
            data.push(v);
          }
        }
      }
      this.data = data; // cache results
      if (returnFalse) return false;
      this.rewrite.write(data as number[]); // verified via returnFalse
      return true;
    }
  }
}

class PendingWritePrintf extends PendingWrite {
  format: string;
  args: (number | Expression)[];
  log: (str: string) => void;

  constructor(
    flp: IFilePos,
    context: IPendingWriteContext,
    format: string,
    args: Expression[],
    log: (str: string) => void,
  ) {
    super(flp, context);
    this.format = format;
    this.args = args;
    this.log = log;
  }

  attemptWrite(lookupFailMode: LookupFailMode): boolean {
    if (lookupFailMode === 'deny') {
      const data: number[] = [];
      for (const expr of this.args) {
        if (typeof expr === 'number') {
          data.push(expr);
        } else {
          const v = expr.value(this.context, lookupFailMode);
          if (v === false) return false;
          data.push(v);
        }
      }
      this.log(printf(this.format, ...data));
      return true;
    } else {
      let returnFalse = false;
      const data: (number | Expression)[] = [];
      for (const expr of this.args) {
        if (typeof expr === 'number') {
          data.push(expr);
        } else {
          const v = expr.value(this.context, lookupFailMode);
          if (v === false) {
            data.push(expr);
            returnFalse = true;
          } else {
            data.push(v);
          }
        }
      }
      this.args = data; // cache results
      if (returnFalse) return false;
      this.log(printf(this.format, ...(data as number[]))); // verified via returnFalse
      return true;
    }
  }
}

abstract class PendingWritePoolCommon extends PendingWrite {
  captured = false;
  cmdSize: number;
  rd: number;
  expr: Expression | number;
  rewrite: IRewrite<number>;
  poolAddr: 'unknown' | 'inline' | number = 'unknown';
  poolWriteExpr: (ex: number) => void = () => {};

  constructor(
    flp: IFilePos,
    context: IPendingWriteContext,
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
    context: IPendingWriteContext,
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
      this.poolAddr = 'inline';
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
      this.poolAddr = 'inline';
      return true;
    }
    return false;
  }

  attemptWrite(lookupFailMode: LookupFailMode): boolean {
    if (lookupFailMode === 'deny') {
      // pool is already flattened, so we must use the pool addr
      let ex: number | false = false;
      if (this.expr instanceof Expression) {
        ex = this.expr.value(this.context, lookupFailMode);
      } else {
        ex = this.expr;
      }

      if (ex === false) return false;
      if (this.writeInline(ex)) return true;
      if (typeof this.poolAddr !== 'number') return false;
      const address = this.rewrite.addr();
      if (address === false) return false;

      if (this.cmdSize === 4) {
        // convert to: ldr rd, [pc, #offset]
        // cond 0111 1001 1111 rd offset
        const offset = this.poolAddr - address - 8;
        if (offset < -4) {
          throw new Error('Pool offset shouldn\'t be negative');
        } else if (offset > 0xfff) {
          throw new CompError(this.flp, 'Next .pool too far away');
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
          throw new CompError(this.flp, 'Next .pool too far away');
        }
        const mask = (((Math.abs(offset) >> 4) & 0xf) << 8) |
          Math.abs(offset) & 0xf;
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
            throw new CompError(this.flp, 'Next .pool too far away');
          }
          const mask = (((Math.abs(offset) >> 4) & 0xf) << 8) |
            Math.abs(offset) & 0xf;
          this.rewrite.write(
            offset < 0
              ? ((this.cond << 28) | 0x015f00d0 | (this.rd << 12) | mask)
              : ((this.cond << 28) | 0x01df00d0 | (this.rd << 12) | mask),
          );
          this.poolWriteExpr(ex);
          return true;
        } else {
          throw 'TODO: ldrb';
        }
      }
    } else {
      // pool isn't flattened yet, so try to convert to inline
      if (this.expr instanceof Expression) {
        const v = this.expr.value(this.context, lookupFailMode);
        if (v === false) return false;
        this.expr = v;
      }
      return this.writeInline(this.expr);
    }
  }
}

class _PendingWritePoolThumb extends PendingWritePoolCommon {
  attemptWrite(lookupFailMode: LookupFailMode): boolean {
    if (lookupFailMode === 'deny') {
      // pool is already flattened, so we must use the pool addr
      let ex: number | false = false;
      if (this.expr instanceof Expression) {
        ex = this.expr.value(this.context, lookupFailMode);
      } else {
        ex = this.expr;
      }

      if (ex === false) return false;
      const address = this.rewrite.addr();
      if (address === false) return false;

      const offset1 = ex - (address & 0xfffffffd) - 4;
      if (offset1 >= 0 && offset1 <= 1020 && (offset1 & 3) === 0) {
        // convert to: add rd, pc, #offset
        this.rewrite.write(0xa000 | (this.rd << 8) | (offset1 >> 2));
        this.poolAddr = 'inline';
        return true;
      }

      if (typeof this.poolAddr !== 'number') return false;

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
        const v = this.expr.value(this.context, lookupFailMode);
        if (v === false) return false;
        this.expr = v;
      }
      return false;
    }
  }
}

interface ILevelBegin {
  kind: 'begin';
  mode: Mode;
  regs: string[];
}

type ILevel = ILevelBegin;

export class Import {
  static defaultRegs = ['r0', 'r1', 'r2', 'r3', 'r4', 'r5', 'r6', 'r7', 'r8', 'r9', 'r10', 'r11'];
  static reservedRegs = ['r12', 'ip', 'r13', 'sp', 'r14', 'lr', 'r15', 'pc'];

  proj: Project;
  filename: string;
  main: boolean;
  defTable: DefMap = new Map();
  defHere = [this.defTable];
  levels: ILevel[] = [{ kind: 'begin', mode: 'none', regs: Import.defaultRegs }];
  sections: Section[] = [];
  pendingWrites: { pw: PendingWrite; remove: () => void }[] = [];
  pendingCRC: (IRewrite<number> & { flp: IFilePos })[] = [];
  uniqueId = 0;
  hasStdlib = false;

  constructor(proj: Project, filename: string, main: boolean) {
    this.proj = proj;
    this.filename = filename;
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

  pendingWriteContext(): IPendingWriteContext {
    return {
      imp: this,
      defHere: [...this.defHere],
      mode: this.mode(),
      addr: false,
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
    if (reservedNames.includes(name)) {
      throw new CompError(flp, `Cannot use reserved name: ${name}`);
    }
    if (this.defHere[0].has(name)) {
      throw new CompError(flp, `Cannot redefine: ${name}`);
    }
  }

  addSymNum(flp: IFilePos, name: string, num: number) {
    this.validateNewName(flp, name);
    this.defHere[0].set(name, { kind: 'num', num });
  }

  addSymNamedLabel(tk: ITokId) {
    this.validateNewName(tk, tk.id);
    const label: IDefLabel = { kind: 'label', addr: false };
    this.tailBytes().addAddrRecv(label);
    this.defHere[0].set(tk.id, label);
  }

  stdlib(flp: IFilePos) {
    if (this.hasStdlib) {
      throw new CompError(flp, 'Cannot import `.stdlib` twice');
    }
    this.hasStdlib = true;
    for (const [name, value] of stdlib) {
      this.addSymNum(flp, name, value);
    }
  }

  lookup(
    flp: IFilePos,
    defHere: DefMap[],
    idPath: (string | Expression)[],
  ): number | 'notfound' | false {
    const lookup = (i: number, here: DefMap): number | 'notfound' | false => {
      const p = idPath[i];
      if (typeof p !== 'string') return 'notfound';
      const root = here.get(p);
      if (!root) return 'notfound';
      switch (root.kind) {
        case 'begin':
          return i + 1 < idPath.length ? lookup(i + 1, root.map) : root.addr;
        case 'importAll': {
          if (i + 1 >= idPath.length) {
            throw new CompError(flp, 'Cannot use imported name as value');
          }
          const pf = this.proj.readFileCacheImport(root.filename);
          if (!pf) throw new Error(`Failed to reimport: ${root.filename}`);
          return lookup(i + 1, pf.defTable);
        }
        case 'importName': {
          const pf = this.proj.readFileCacheImport(root.filename);
          if (!pf) throw new Error(`Failed to reimport: ${root.filename}`);
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
        default:
          return assertNever(root);
      }
    };

    for (const here of defHere) {
      const v = lookup(0, here);
      if (typeof v === 'number' || v === false) return v;
    }
    return 'notfound';
  }

  async importAll(flp: IFilePos, filename: string, name: string) {
    const fullFile = this.proj.resolveFile(filename, this.filename);
    await this.proj.import(fullFile);
    this.validateNewName(flp, name);
    this.defTable.set(name, { kind: 'importAll', filename: fullFile });
  }

  async importNames(flp: IFilePos, filename: string, names: string[]) {
    const fullFile = this.proj.resolveFile(filename, this.filename);
    await this.proj.import(fullFile);
    for (const name of names) {
      this.validateNewName(flp, name);
      this.defTable.set(name, { kind: 'importName', filename: fullFile, name });
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
    const entry: IDefBegin = {
      kind: 'begin',
      map: new Map(),
      addr: false,
    };
    this.tailBytes().addAddrRecv(entry);
    this.defHere[0].set(symName, entry);
    this.defHere.unshift(entry.map);
    this.levels.unshift({ kind: 'begin', mode: this.mode(), regs: this.regs() });
  }

  beginEnd() {
    if (this.levels.length <= 1 || this.levels[0].kind !== 'begin') {
      throw new Error(`Can't call beginEnd without matching beginStart`);
    }
    this.defHere.shift();
    this.levels.shift();
  }

  pool() {
    const pendingPools: PendingWritePoolCommon[] = [];
    for (const { pw } of this.pendingWrites) {
      if (pw instanceof PendingWritePoolCommon && !pw.captured) {
        // TODO: memory leak; do I need to do something with remove..?
        // ??????????????? I'm too tired
        pendingPools.push(pw);
      }
    }
    if (pendingPools.length > 0) {
      this.sections.push(new SectionPool(pendingPools));
    }
  }

  align(amount: number, fill: number | 'nop') {
    this.sections.push(new SectionAlign(amount, fill));
  }

  writeLogo() {
    this.tailBytes().logo();
  }

  writeTitle(flp: IFilePos, title: string) {
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
    this.pendingCRC.push({ ...this.tailBytes().rewrite8(), flp });
  }

  writeInstARM(flp: IFilePos, op: ARM.IOp, syms: ISyms) {
    const bytes = this.tailBytes();
    const rewrite = bytes.rewrite32();
    const context = this.pendingWriteContext();
    const pw = new PendingWriteInstARM(flp, context, op, syms, rewrite);
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
    const bytes = this.tailBytes();
    const rewrite = bytes.rewrite32();
    const context = this.pendingWriteContext();
    const pw = new PendingWritePoolARM(flp, context, cmdSize, cmdSigned, cond, rd, expr, rewrite);
    this.addPendingWrite(pw);
  }

  writeInstThumb(flp: IFilePos, op: Thumb.IOp, syms: ISyms) {
    const bytes = this.tailBytes();
    const rewrite = op.doubleInstruction ? bytes.rewrite32() : bytes.rewrite16();
    const context = this.pendingWriteContext();
    const pw = new PendingWriteInstThumb(flp, context, op, syms, rewrite);
    this.addPendingWrite(pw);
  }

  writeData(flp: IFilePos, dataType: DataType, data: Expression[]) {
    const bytes = this.tailBytes();
    const context = this.pendingWriteContext();
    let pw: PendingWrite;
    switch (dataTypeSize(dataType)) {
      case 8: {
        const rewrite = bytes.rewriteArray8(data.length);
        pw = new PendingWriteData(flp, context, data, rewrite);
        break;
      }
      case 16: {
        if (dataTypeAligned(dataType)) {
          bytes.forceAlignment(
            flp,
            2,
            `Misaligned data; add \`.align 2\` or change to \`.${dataTypeToMisaligned(dataType)}\``,
          );
        }
        const rewrite = bytes.rewriteArray16(data.length, dataTypeLE(dataType));
        pw = new PendingWriteData(flp, context, data, rewrite);
        break;
      }
      case 32: {
        if (dataTypeAligned(dataType)) {
          bytes.forceAlignment(
            flp,
            4,
            `Misaligned data; add \`.align 4\` or change to \`.${dataTypeToMisaligned(dataType)}\``,
          );
        }
        const rewrite = bytes.rewriteArray32(data.length, dataTypeLE(dataType));
        pw = new PendingWriteData(flp, context, data, rewrite);
        break;
      }
      default:
        throw new Error(`Invalid data type size? ${dataType}`);
    }
    this.addPendingWrite(pw);
  }

  writeStr(str: string) {
    this.tailBytes().writeArray(new TextEncoder().encode(str));
  }

  printf(flp: IFilePos, format: string, args: Expression[]) {
    const context = this.pendingWriteContext();
    const pw = new PendingWritePrintf(flp, context, format, args, this.proj.getLog());
    this.addPendingWrite(pw);
  }

  addPendingWrite(pw: PendingWrite) {
    if (!pw.attemptWrite('allow')) {
      this.pendingWrites.push({ pw, remove: this.tailBytes().addAddrRecv(pw.context) });
    }
  }

  endOfFile() {
    // attempt rewrites now that we know more information
    for (let i = 0; i < this.pendingWrites.length; i++) {
      const { pw, remove } = this.pendingWrites[i];
      if (pw.attemptWrite('unresolved')) {
        this.pendingWrites.splice(i, 1);
        remove();
        i--;
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
    return Import.defaultRegs;
  }

  async flatten(initialState: IFileState, startLength: number): Promise<Uint8Array[]> {
    const sections: Uint8Array[] = [];
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
      if (section instanceof SectionPool) section.clearWrite();
    }
  }

  makeEnd(crc: number | false) {
    for (const rw of this.pendingCRC) {
      if (crc === false) throw new CompError(rw.flp, 'Cannot calculate CRC value');
      rw.write(crc);
    }
    for (const { pw } of this.pendingWrites) {
      if (!pw.attemptWrite('deny')) {
        throw new CompError(pw.flp, 'Failed to write instruction');
      }
    }
  }
}
