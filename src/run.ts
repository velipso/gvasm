//
// gvasm - Assembler and disassembler for Game Boy Advance homebrew
// by Sean Connelly (@velipso), https://sean.cm
// The Unlicense License
// Project Home: https://github.com/velipso/gvasm
//

import { IDebugStatement, makeResult } from './make.ts';
import { parseARM } from './dis.ts';
import { assertNever, printf } from './util.ts';

export interface IRunArgs {
  input: string;
  defines: { key: string; value: number }[];
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
  private regs: number[] = [
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
  ];

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

  public bx(addr: number) {
    this.regs[16] = (this.regs[16] & 0xffffffdf) | ((addr & 1) << 5);
    this.regs[15] = addr & 0xfffffffe;
    this.regs[15] += this.isARM() ? 4 : 2;
  }

  public isARM(): boolean {
    return !((this.regs[16] >> 5) & 1);
  }

  public test(cond: number): boolean {
    switch (cond) {
      case 0: // eq
        return !!(this.regs[16] & Z);
      case 1: // ne
        return !(this.regs[16] & Z);
      case 2: // cs
        return !!(this.regs[16] & C);
      case 3: // cc
        return !(this.regs[16] & C);
      case 4: // mi
        return !!(this.regs[16] & N);
      case 5: // pl
        return !(this.regs[16] & N);
      case 6: // vs
        return !!(this.regs[16] & V);
      case 7: // vc
        return !(this.regs[16] & V);
      case 8: // hi
        return !!(this.regs[16] & C) && !(this.regs[16] & Z);
      case 9: // ls
        return !(this.regs[16] & C) && !!(this.regs[16] & Z);
      case 10: // ge
        return !(this.regs[16] & N) === !(this.regs[16] & V);
      case 11: // lt
        return !(this.regs[16] & N) !== !(this.regs[16] & V);
      case 12: // gt
        return !(this.regs[16] & Z) && !(this.regs[16] & N) === !(this.regs[16] & V);
      case 13: // le
        return !!(this.regs[16] & Z) || !(this.regs[16] & N) !== !(this.regs[16] & V);
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
    if (flag) this.regs[16] = this.regs[16] & ~V;
    else this.regs[16] |= V;
    return this;
  }

  public setC(flag: boolean): CPU {
    if (flag) this.regs[16] = this.regs[16] & ~C;
    else this.regs[16] |= C;
    return this;
  }

  public setZ(flag: boolean): CPU {
    if (flag) this.regs[16] = this.regs[16] & ~Z;
    else this.regs[16] |= Z;
    return this;
  }

  public setN(flag: boolean): CPU {
    if (flag) this.regs[16] = this.regs[16] & ~N;
    else this.regs[16] |= N;
    return this;
  }

  public setZNFromReg(reg: number) {
    this.setZ(this.regs[reg] === 0).setN(this.regs[reg] < 0);
  }

  public mov(reg: number, value: number) {
    this.regs[reg] = value;
  }

  public next() {
    this.regs[15] += this.isARM() ? 4 : 2;
  }
}

function runResult(
  bytes: readonly number[],
  base: number,
  arm: boolean,
  debug: IDebugStatement[],
) {
  const cpu = new CPU();
  cpu.addROM(base, bytes);
  cpu.addRAM(0x02000000, 0x40000); // EWRAM
  cpu.addRAM(0x03000000, 0x8000); // IWRAM
  cpu.addRAM(0x04000000, 0x400); // IO
  cpu.addRAM(0x05000000, 0x400); // palette
  cpu.addRAM(0x06000000, 0x18000); // VRAM
  cpu.addRAM(0x07000000, 0x400); // OAM

  cpu.bx(base + (arm ? 0 : 1));

  while (true) {
    const pc = cpu.isARM() ? cpu.pc() - 4 : cpu.pc() - 2;

    // run debug statements here
    for (const dbg of debug) {
      if (dbg.addr === pc) {
        switch (dbg.kind) {
          case 'log': {
            const args = dbg.args.map((arg) => {
              const v = arg.value(cpu);
              if (v === false) {
                throw `Unknown value at run-time`;
              }
              return v;
            });
            console.log(printf(dbg.format, ...args));
            break;
          }
          default:
            assertNever(dbg.kind);
        }
      }
    }

    if (pc === base + bytes.length) {
      break;
    }

    // run code here
    const opcode = cpu.isARM() ? cpu.read32(pc) : cpu.read16(pc);
    if (cpu.isARM()) {
      const dis = parseARM(opcode);
      if (!dis) {
        throw `Failed to disassemble op at 0x${`0000000${pc.toString(16)}`.substr(-8)}`;
      }
      const { op, syms } = dis;
      if (op.run) {
        op.run(cpu, (name: string): number => {
          if (name in syms) {
            return syms[name].v;
          }
          throw `Unknown symbol: ${name}`;
        });
      } else {
        throw `Not implemented: ${op.category}`;
      }
    } else {
      throw 'Not implemented: Don\'t know how to run Thumb code yet :-(';
    }
  }
}

export async function run({ input, defines }: IRunArgs): Promise<number> {
  try {
    const result = await makeResult(input, defines);

    if ('errors' in result) {
      for (const e of result.errors) {
        console.error(e);
      }
      throw false;
    }

    runResult(result.result, result.base, result.arm, result.debug);

    return 0;
  } catch (e) {
    if (e !== false) {
      console.error(e);
      console.error('Unknown fatal error');
    }
    return 1;
  }
}
