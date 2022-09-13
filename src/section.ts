//
// gvasm - Assembler and disassembler for Game Boy Advance homebrew
// by Sean Connelly (@velipso), https://sean.cm
// Project Home: https://github.com/velipso/gvasm
// SPDX-License-Identifier: 0BSD
//

import { IFilePos } from './lexer.ts';
import { assertNever } from './util.ts';
import { IBase, Project } from './project.ts';
import { CompError } from './parser.ts';
import { Mode, PendingWritePoolCommon } from './import.ts';

export abstract class Section {
  async flatten(_base: IBase, _startLength: number): Promise<Uint8Array[]> {
    return [];
  }
}

export interface IRewrite<T> {
  addr(): number | false;
  write(v: T): void;
}

export class SectionBytes extends Section {
  private array: number[] = [];
  private byteArray: Uint8Array | undefined;
  private addrRecvs: {
    i: number;
    recv: {
      addr: number | false;
      base?: number | false;
      bytes?: number | false;
    };
  }[] = [];
  private alignments: { flp: IFilePos; align: number; msg: string; i: number }[] = [];
  private addr: { base: IBase; startLength: number } | false = false;
  firstWrittenARM: boolean | undefined;

  async flatten(base: IBase, startLength: number): Promise<Uint8Array[]> {
    this.addr = { base, startLength };
    const startAddr = base.addr + startLength - base.relativeTo;
    for (const { flp, align, msg, i } of this.alignments) {
      const addr = startAddr + i;
      if ((addr % align) !== 0) {
        throw new CompError(flp, msg);
      }
    }
    for (const { i, recv } of this.addrRecvs) {
      recv.addr = startAddr + i;
      if ('base' in recv) {
        recv.base = base.addr;
      }
      if ('bytes' in recv) {
        recv.bytes = startLength + i;
      }
    }
    if (!this.byteArray) {
      this.byteArray = new Uint8Array(this.array);
    }
    return [this.byteArray];
  }

  setARM(arm: boolean) {
    if (this.firstWrittenARM === undefined) {
      this.firstWrittenARM = arm;
    }
  }

  clearAddr() {
    this.addr = false;
    for (const { recv } of this.addrRecvs) {
      recv.addr = false;
      if ('base' in recv) {
        recv.base = false;
      }
      if ('bytes' in recv) {
        recv.bytes = false;
      }
    }
  }

  addAddrRecv(recv: { addr: number | false }): () => void {
    const ar = { i: this.array.length, recv };
    this.addrRecvs.push(ar);
    return () => {
      const i = this.addrRecvs.indexOf(ar);
      if (i >= 0) {
        this.addrRecvs.splice(i, 1);
      }
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
        if (this.byteArray) {
          for (let j = 0; j < size; j++) {
            this.byteArray[i + j] = v[j] & 0xff;
          }
        } else {
          for (let j = 0; j < size; j++) {
            this.array[i + j] = v[j] & 0xff;
          }
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
          if (this.byteArray) {
            for (let j = 0; j < size; j++) {
              this.byteArray[i + j * 2] = v[j] & 0xff;
              this.byteArray[i + j * 2 + 1] = (v[j] >> 8) & 0xff;
            }
          } else {
            for (let j = 0; j < size; j++) {
              this.array[i + j * 2] = v[j] & 0xff;
              this.array[i + j * 2 + 1] = (v[j] >> 8) & 0xff;
            }
          }
        }
        : (v: number[]) => {
          if (v.length !== size) throw new Error('Bad rewrite for array');
          if (this.byteArray) {
            for (let j = 0; j < size; j++) {
              this.byteArray[i + j * 2] = (v[j] >> 8) & 0xff;
              this.byteArray[i + j * 2 + 1] = v[j] & 0xff;
            }
          } else {
            for (let j = 0; j < size; j++) {
              this.array[i + j * 2] = (v[j] >> 8) & 0xff;
              this.array[i + j * 2 + 1] = v[j] & 0xff;
            }
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
          if (this.byteArray) {
            for (let j = 0; j < size; j++) {
              this.byteArray[i + j * 4] = v[j] & 0xff;
              this.byteArray[i + j * 4 + 1] = (v[j] >> 8) & 0xff;
              this.byteArray[i + j * 4 + 2] = (v[j] >> 16) & 0xff;
              this.byteArray[i + j * 4 + 3] = (v[j] >> 24) & 0xff;
            }
          } else {
            for (let j = 0; j < size; j++) {
              this.array[i + j * 4] = v[j] & 0xff;
              this.array[i + j * 4 + 1] = (v[j] >> 8) & 0xff;
              this.array[i + j * 4 + 2] = (v[j] >> 16) & 0xff;
              this.array[i + j * 4 + 3] = (v[j] >> 24) & 0xff;
            }
          }
        }
        : (v: number[]) => {
          if (v.length !== size) throw new Error('Bad rewrite for array');
          if (this.byteArray) {
            for (let j = 0; j < size; j++) {
              this.byteArray[i + j * 4] = (v[j] >> 24) & 0xff;
              this.byteArray[i + j * 4 + 1] = (v[j] >> 16) & 0xff;
              this.byteArray[i + j * 4 + 2] = (v[j] >> 8) & 0xff;
              this.byteArray[i + j * 4 + 3] = v[j] & 0xff;
            }
          } else {
            for (let j = 0; j < size; j++) {
              this.array[i + j * 4] = (v[j] >> 24) & 0xff;
              this.array[i + j * 4 + 1] = (v[j] >> 16) & 0xff;
              this.array[i + j * 4 + 2] = (v[j] >> 8) & 0xff;
              this.array[i + j * 4 + 3] = v[j] & 0xff;
            }
          }
        },
    };
  }
}

export class SectionInclude extends Section {
  flp: IFilePos;
  proj: Project;
  fullFile: string;

  constructor(flp: IFilePos, proj: Project, fullFile: string) {
    super();
    this.flp = flp;
    this.proj = proj;
    this.fullFile = fullFile;
  }

  async flatten(base: IBase, startLength: number): Promise<Uint8Array[]> {
    return await this.proj.include(this.flp, this.fullFile, base, startLength);
  }
}

export class SectionEmbed extends Section {
  flp: IFilePos;
  proj: Project;
  fullFile: string;

  constructor(flp: IFilePos, proj: Project, fullFile: string) {
    super();
    this.flp = flp;
    this.proj = proj;
    this.fullFile = fullFile;
  }

  async flatten(_base: IBase, _startLength: number): Promise<Uint8Array[]> {
    return [await this.proj.embed(this.flp, this.fullFile)];
  }
}

export class SectionPool extends Section {
  pendingPools: PendingWritePoolCommon[];
  align: number;

  constructor(pendingPools: PendingWritePoolCommon[], align: number) {
    super();
    this.pendingPools = pendingPools;
    this.align = align;
    for (const p of pendingPools) {
      p.captured = true;
    }
  }

  clearWrite() {
    for (const p of this.pendingPools) {
      p.poolWriteExpr = () => {};
    }
  }

  async flatten(base: IBase, startLength: number): Promise<Uint8Array[]> {
    const array: number[] = [];
    let bytes: Uint8Array | undefined = undefined;
    const startAddr = base.addr + startLength - base.relativeTo;
    const lateWrites: { i: number; cmdSize: number }[] = [];
    for (const p of this.pendingPools) {
      if (p.poolAddr === 'inline') {
        // instruction doesn't need pool
        continue;
      }
      const cmdSize = p.cmdSize;

      //
      // if possible, search the current pool values to see if there are duplicates
      //

      if (typeof p.expr === 'number') {
        const ex = p.expr;
        let searchStart = 0;
        while ((startAddr + searchStart) % cmdSize !== 0) {
          searchStart++;
        }
        let found = false;
        while (searchStart + cmdSize <= array.length) {
          // is this address range going to be stomped later? then don't rely on it!
          let lateWrite = false;
          for (const lw of lateWrites) {
            if (searchStart < lw.i + lw.cmdSize && searchStart + cmdSize > lw.i) {
              lateWrite = true;
              break;
            }
          }
          if (lateWrite) {
            searchStart += cmdSize;
            continue;
          }
          switch (cmdSize) {
            case 1:
              found = array[searchStart] === (ex & 0xff);
              break;
            case 2:
              found = (array[searchStart] === (ex & 0xff)) &&
                (array[searchStart + 1] === ((ex >> 8) & 0xff));
              break;
            case 4:
              found = (array[searchStart] === (ex & 0xff)) &&
                (array[searchStart + 1] === ((ex >> 8) & 0xff)) &&
                (array[searchStart + 2] === ((ex >> 16) & 0xff)) &&
                (array[searchStart + 3] === ((ex >> 24) & 0xff));
              break;
            default:
              throw new Error(`Invalid command size: ${cmdSize}`);
          }
          if (found) {
            break;
          }
          searchStart += cmdSize;
        }
        if (found) {
          p.poolAddr = startAddr + searchStart;
          p.poolWriteExpr = () => {};
          continue;
        }
      }

      //
      // not found in pool yet, so add constant value
      //

      // align the constant
      while ((startAddr + array.length) % cmdSize !== 0) {
        array.push(0);
      }
      // store the final address
      p.poolAddr = startAddr + array.length;
      if (typeof p.expr === 'number') {
        // early write
        const ex = p.expr;
        switch (cmdSize) {
          case 1:
            array.push(ex & 0xff);
            break;
          case 2:
            array.push(ex & 0xff, (ex >> 8) & 0xff);
            break;
          case 4:
            array.push(ex & 0xff, (ex >> 8) & 0xff, (ex >> 16) & 0xff, (ex >> 24) & 0xff);
            break;
          default:
            throw new Error(`Invalid command size: ${cmdSize}`);
        }
        p.poolWriteExpr = () => {};
      } else {
        // late write
        const i = array.length;
        lateWrites.push({ i, cmdSize });
        for (let j = 0; j < cmdSize; j++) {
          array.push(0);
        }
        p.poolWriteExpr = (ex: number) => {
          if (!bytes) {
            throw new Error('Byte array isn\'t set');
          }
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
    }
    // align the end
    while ((startAddr + array.length) % this.align !== 0) {
      array.push(0);
    }
    bytes = new Uint8Array(array);
    return [bytes];
  }
}

export class SectionAlign extends Section {
  flp: IFilePos;
  mode: Mode;
  amount: number;
  fill: number | 'nop';

  constructor(flp: IFilePos, mode: Mode, amount: number, fill: number | 'nop') {
    super();
    this.flp = flp;
    this.mode = mode;
    this.amount = amount;
    this.fill = fill;
  }

  async flatten(base: IBase, startLength: number): Promise<Uint8Array[]> {
    const array: number[] = [];
    const startAddr = base.addr + startLength - base.relativeTo;
    let fill: number[];
    if (this.fill === 'nop') {
      switch (this.mode) {
        case 'none':
          throw new CompError(
            this.flp,
            'Missing mode for nop alignment; use `.arm` or `.thumb` prior to `.align`',
          );
        case 'arm':
          fill = [0x00, 0x00, 0xa0, 0xe1];
          break;
        case 'thumb':
          fill = [0xc0, 0x46];
          break;
        default:
          assertNever(this.mode);
      }
    } else {
      fill = [this.fill & 0xff];
    }
    while (true) {
      const addr = startAddr + array.length;
      if (addr % this.amount === 0) {
        break;
      }
      array.push(fill[addr % fill.length]);
    }
    return array.length <= 0 ? [] : [new Uint8Array(array)];
  }
}

export class SectionBase extends Section {
  base: number;
  overwrite: boolean;

  constructor(base: number, overwrite: boolean) {
    super();
    this.base = base;
    this.overwrite = overwrite;
  }
}

export class SectionBaseShift extends Section {
}
