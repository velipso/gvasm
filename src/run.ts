//
// gvasm - Assembler and disassembler for Game Boy Advance homebrew
// by Sean Connelly (@velipso), https://sean.cm
// Project Home: https://github.com/velipso/gvasm
// SPDX-License-Identifier: 0BSD
//

import { IDebugStatement } from './make.ts';
import { ILexKeyValue } from './lexer.ts';
/*
import { parseARM, parseThumb } from './dis.ts';
import { assertNever, hex16, hex32 } from './util.ts';
*/
export interface IRunArgs {
  input: string;
  defines: ILexKeyValue[];
}

interface IMemoryRegion {
  addr: number;
  size: number;
  ram?: number[];
  rom?: readonly number[];
}

export type SymReader = (name: string) => number;

const V = 0x10000000;
const C = 0x20000000;
const Z = 0x40000000;
const N = 0x80000000;

export class CPU {
  private memory: IMemoryRegion[] = [];
  // deno-fmt-ignore
  private regs: number[] = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

  public reg(n: number) {
    return this.regs[n];
  }

  public addROM(addr: number, bytes: readonly number[]) {
    this.memory.push({
      addr,
      size: bytes.length,
      rom: bytes,
    });
  }

  public addRAM(addr: number, size: number) {
    this.memory.push({ addr, size });
  }

  public read8(addr: number): number {
    for (const m of this.memory) {
      if (addr >= m.addr && addr < m.addr + m.size) {
        if (m.ram) {
          return m.ram[addr - m.addr];
        } else if (m.rom) {
          return m.rom[addr - m.addr];
        } else {
          return 0;
        }
      }
    }
    return 0;
  }

  public read16(addr: number): number {
    return (
      this.read8(addr) +
      this.read8(addr + 1) * (1 << 8)
    );
  }

  public read32(addr: number): number {
    return (
      this.read8(addr) +
      this.read8(addr + 1) * (1 << 8) +
      this.read8(addr + 2) * (1 << 16) +
      this.read8(addr + 3) * (1 << 24)
    );
  }

  public write8(addr: number, value: number) {
    for (const m of this.memory) {
      if (addr >= m.addr && addr < m.addr + m.size) {
        if (m.rom) {
          return;
        }
        let ram = m.ram;
        if (!ram) {
          ram = Array.from({ length: m.size }).map(() => 0);
          m.ram = ram;
        }
        ram[addr - m.addr] = value & 0xff;
        return;
      }
    }
  }

  public write16(addr: number, value: number) {
    this.write8(addr, value & 0xff);
    this.write8(addr + 2, (value >>> 8) & 0xff);
  }

  public write32(addr: number, value: number) {
    this.write8(addr, value & 0xff);
    this.write8(addr + 2, (value >>> 8) & 0xff);
    this.write8(addr + 4, (value >>> 16) & 0xff);
    this.write8(addr + 6, (value >>> 24) & 0xff);
  }

  public bx(addr: number) {
    this.regs[16] = (this.regs[16] & 0xffffffdf) | ((addr & 1) << 5);
    this.regs[15] = addr & 0xfffffffe;
    this.regs[15] += this.isARM() ? 8 : 4;
  }

  public isARM(): boolean {
    return !((this.regs[16] >> 5) & 1);
  }

  public test(cond: number): boolean {
    const status = this.regs[16];
    switch (cond) {
      case 0: // eq
        return !!(status & Z);
      case 1: // ne
        return !(status & Z);
      case 2: // cs
        return !!(status & C);
      case 3: // cc
        return !(status & C);
      case 4: // mi
        return !!(status & N);
      case 5: // pl
        return !(status & N);
      case 6: // vs
        return !!(status & V);
      case 7: // vc
        return !(status & V);
      case 8: // hi
        return !!(status & C) && !(status & Z);
      case 9: // ls
        return !(status & C) && !!(status & Z);
      case 10: // ge
        return !(status & N) === !(status & V);
      case 11: // lt
        return !(status & N) !== !(status & V);
      case 12: // gt
        return !(status & Z) && !(status & N) === !(status & V);
      case 13: // le
        return !!(status & Z) || !(status & N) !== !(status & V);
      case 14:
        return true;
      default:
        throw `Invalid condition`;
    }
  }

  public pc(): number {
    return this.regs[15];
  }

  public setV(flag: boolean): CPU {
    if (flag) this.regs[16] |= V;
    else this.regs[16] = this.regs[16] & ~V;
    return this;
  }

  public setC(flag: boolean): CPU {
    if (flag) this.regs[16] |= C;
    else this.regs[16] = this.regs[16] & ~C;
    return this;
  }

  public setZ(flag: boolean): CPU {
    if (flag) this.regs[16] |= Z;
    else this.regs[16] = this.regs[16] & ~Z;
    return this;
  }

  public setN(flag: boolean): CPU {
    if (flag) this.regs[16] |= N;
    else this.regs[16] = this.regs[16] & ~N;
    return this;
  }

  public setZNFromReg(reg: number) {
    this.setZ(this.regs[reg] === 0).setN(this.regs[reg] < 0);
  }

  public setZNFromValue(v: number) {
    this.setZ(v === 0).setN(v < 0);
  }

  public mov(reg: number, value: number) {
    this.regs[reg] = value;
  }

  public next() {
    this.regs[15] += this.isARM() ? 4 : 2;
  }

  public add(a: number, b: number, setStatus: boolean): number {
    const result = (a + b) | 0;
    if (setStatus) {
      this.setZNFromValue(result);
      this.setC(result < a);
      this.setV(!!((~(a ^ b) & (b ^ result)) >>> 31));
    }
    return result;
  }

  public sub(a: number, b: number, setStatus: boolean): number {
    const result = (a - b) | 0;
    if (setStatus) {
      this.setZNFromValue(result);
      this.setC(a >= b);
      this.setV(!!(((a ^ b) & (a ^ result)) >>> 31));
    }
    return result;
  }
}

export function runResult(
  _bytes: readonly number[],
  _base: number,
  _arm: boolean,
  _debug: IDebugStatement[],
  _log: (str: string) => void,
) {
  /*
  const cpu = new CPU();
  cpu.addROM(base, bytes);
  cpu.addRAM(0x02000000, 0x40000); // EWRAM
  cpu.addRAM(0x03000000, 0x8000); // IWRAM
  cpu.addRAM(0x04000000, 0x400); // IO
  cpu.addRAM(0x05000000, 0x400); // palette
  cpu.addRAM(0x06000000, 0x18000); // VRAM
  cpu.addRAM(0x07000000, 0x400); // OAM

  cpu.bx(base + (arm ? 0 : 1));

  let done = false;
  while (!done) {
    const pc = cpu.isARM() ? cpu.pc() - 8 : cpu.pc() - 4;

    // run debug statements here
    for (const dbg of debug) {
      if (dbg.addr === pc) {
        switch (dbg.kind) {
          case 'log': {
            /* TODO:
            const args = dbg.args.map((arg) => {
              const v = arg.value(cpu);
              if (v === false) {
                throw `Unknown value at run-time`;
              }
              return v;
            });
            log(printf(dbg.format, ...args));
            * /
            break;
          }
          case 'exit':
            done = true;
            break;
          default:
            assertNever(dbg);
        }
      }
      if (done) break;
    }

    if (pc === base + bytes.length) {
      done = true;
    }

    if (done) break;

    // run code here
    const opcode16 = cpu.read16(pc);
    const opcode32 = cpu.read32(pc);
    if (cpu.isARM()) {
      const dis = parseARM(opcode32, true);
      if (!dis) {
        throw `Failed to disassemble ARM op at ${hex32(pc)}: ${hex32(opcode32)}`;
      }
      const { op, syms } = dis;
      if (!op.run) {
        throw new Error('parseARM must return op with run function');
      }
      op.run(cpu, (name: string): number => {
        if (name in syms) {
          return syms[name].v;
        }
        throw new Error(`Unknown symbol: ${name}`);
      });
    } else {
      const dis = parseThumb(opcode16, opcode32, true);
      if (!dis) {
        throw `Failed to disassemble Thumb op at ${hex32(pc)}: ${hex16(opcode16)}`;
      }
      const { op, syms } = dis;
      if (!op.run) {
        throw new Error('parseThumb must return op with run function');
      }
      op.run(cpu, (name: string): number => {
        if (name in syms) {
          return syms[name].v;
        }
        throw new Error(`Unknown symbol: ${name}`);
      });
    }
  }
  */
}

export async function run({ input: _input, defines: _defines }: IRunArgs): Promise<number> {
  return 1;
  /*
  try {
    const result = await makeResult(input, defines);

    if ('errors' in result) {
      for (const e of result.errors) {
        console.error(e);
      }
      throw false;
    }

    runResult(
      result.result,
      result.base,
      result.arm,
      result.debug,
      (str: string) => console.log(str),
    );

    return 0;
  } catch (e) {
    if (e !== false) {
      console.error(e);
      console.error('Unknown fatal error');
    }
    return 1;
  }
  */
}
