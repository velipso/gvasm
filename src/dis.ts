//
// gvasm - Assembler and disassembler for Game Boy Advance homebrew
// by Sean Connelly (@velipso), https://sean.fun
// Project Home: https://github.com/velipso/gvasm
// SPDX-License-Identifier: 0BSD
//

import { ARM, Thumb } from './ops.ts';
import { assertNever, ranges } from './util.ts';

export interface IDisArgs {
  input: string;
  format: 'gba' | 'bin';
  output: string;
}

interface IARMSyms {
  [sym: string]: {
    v: number;
    part: ARM.ICodePart;
  };
}

export function parseARM(opcode: number, runOnly = false): { op: ARM.IOp; syms: IARMSyms } | false {
  for (const op of ARM.ops) {
    if (runOnly && !op.run) continue;
    let error: string | undefined;
    let bpos = 0;
    const syms: IARMSyms = {};
    for (const part of op.codeParts) {
      const v = (opcode >> bpos) & ((1 << part.s) - 1);
      switch (part.k) {
        case 'register':
          if (syms[part.sym]) {
            if (syms[part.sym].v !== v) {
              error = `register not reused correctly`;
            }
          } else {
            syms[part.sym] = { v, part };
          }
          break;
        case 'value':
          if (v !== part.v) {
            error = `value at ${bpos} doesn't match: ${v} != ${part.v}`;
            break;
          }
          if (part.sym) {
            syms[part.sym] = { v, part };
          }
          break;
        case 'enum':
          if (part.enum[v] === false) {
            error = `enum at ${bpos} is false at ${v}`;
            break;
          }
          syms[part.sym] = { v, part };
          break;
        case 'pcoffset12':
          if (part.sym) {
            if (part.sign) {
              if (v === 0) {
                // negate offset
                syms[part.sym].v = -syms[part.sym].v;
              }
            } else {
              syms[part.sym] = { v, part };
            }
          }
          break;
        case 'ignored':
        case 'immediate':
        case 'rotimm':
        case 'offset12':
        case 'reglist':
          if (part.sym) {
            syms[part.sym] = { v, part };
          }
          break;
        case 'word':
          if (v & (1 << (part.s - 1))) {
            syms[part.sym] = { v: ((-1 << part.s) + v) << 2, part };
          } else {
            syms[part.sym] = { v: v << 2, part };
          }
          break;
        case 'offsetsplit':
        case 'pcoffsetsplit':
          if (!(part.sym in syms)) {
            syms[part.sym] = { v, part };
          } else if (syms[part.sym].part.k === part.k) {
            if (part.sign) {
              if (v === 0) {
                syms[part.sym].v = -syms[part.sym].v;
              }
            } else {
              if (part.low) {
                syms[part.sym].v = (syms[part.sym].v << 4) | v;
              } else {
                syms[part.sym].v = (v << 4) | syms[part.sym].v;
              }
            }
          } else {
            throw new Error(
              'Invalid op data, offsetsplit cannot reference any other code part',
            );
          }
          break;
        default:
          assertNever(part);
      }
      bpos += part.s;
      if (error) {
        break;
      }
    }
    if (error) {
      continue;
    }
    // TODO: remove eventually: if (runOnly && !op.run){ console.log(op); continue; }
    return { op, syms };
  }
  return false;
}

interface IThumbSyms {
  [sym: string]: {
    v: number;
    part: Thumb.ICodePart;
  };
}

export function parseThumb(
  opcode16: number,
  opcode32: number,
  runOnly = false,
): { op: Thumb.IOp; syms: IThumbSyms } | false {
  for (const op of Thumb.ops) {
    if (runOnly && !op.run) continue;
    const opcode = op.doubleInstruction ? opcode32 : opcode16;
    let error: string | undefined;
    let bpos = 0;
    const syms: IThumbSyms = {};
    for (const part of op.codeParts) {
      const v = (opcode >> bpos) & ((1 << part.s) - 1);
      switch (part.k) {
        case 'register':
          if (syms[part.sym]) {
            if (syms[part.sym].v !== v) {
              error = `register not reused correctly`;
            }
          } else {
            syms[part.sym] = { v, part };
          }
          break;
        case 'registerhigh':
          syms[part.sym] = { v: v + 8, part };
          break;
        case 'value':
          if (v !== part.v) {
            error = `value at ${bpos} doesn't match: ${v} != ${part.v}`;
            break;
          }
          if (part.sym) {
            syms[part.sym] = { v, part };
          }
          break;
        case 'enum':
          if (part.enum[v] === false) {
            error = `enum at ${bpos} is false at ${v}`;
            break;
          }
          syms[part.sym] = { v, part };
          break;
        case 'ignored':
        case 'immediate':
        case 'reglist':
          if (part.sym) {
            syms[part.sym] = { v, part };
          }
          break;
        case 'word':
          if (v & (1 << (part.s - 1))) {
            syms[part.sym] = { v: ((-1 << part.s) + v) << 2, part };
          } else {
            syms[part.sym] = { v: v << 2, part };
          }
          break;
        case 'negword': {
          const vv = -v;
          if (vv & (1 << (part.s - 1))) {
            syms[part.sym] = { v: ((-1 << part.s) + vv) << 2, part };
          } else {
            syms[part.sym] = { v: vv << 2, part };
          }
          break;
        }
        case 'halfword':
          syms[part.sym] = { v: v << 1, part };
          break;
        case 'shalfword':
          if (v & (1 << (part.s - 1))) {
            syms[part.sym] = { v: ((-1 << part.s) + v) << 1, part };
          } else {
            syms[part.sym] = { v: v << 1, part };
          }
          break;
        case 'pcoffset':
          syms[part.sym] = { v: v << 2, part };
          break;
        case 'offsetsplit':
          if (!(part.sym in syms)) {
            syms[part.sym] = { v, part };
          } else if (syms[part.sym].part.k === part.k) {
            if (part.low) {
              syms[part.sym].v = (syms[part.sym].v << 11) | v;
            } else {
              syms[part.sym].v = (v << 11) | syms[part.sym].v;
            }
          } else {
            throw new Error(
              'Invalid op data, offsetsplit cannot reference any other code part',
            );
          }
          break;
        default:
          assertNever(part);
      }
      bpos += part.s;
      if (error) {
        break;
      }
    }
    if (error) {
      continue;
    }
    // TODO: remove eventually: if (runOnly && !op.run) { console.log(op); continue; }
    return { op, syms };
  }
  return false;
}

function pad(amount: number, code: string): string {
  const space = code.indexOf(' ');
  if (space >= 0) {
    let left = code.substr(0, space + 1);
    const right = code.substr(space + 1);
    while (left.length < amount) {
      left += ' ';
    }
    return left + right;
  }
  return code;
}

function registerToString(v: number): string {
  if (v === 12) return 'ip';
  if (v === 13) return 'sp';
  if (v === 14) return 'lr';
  if (v === 15) return 'pc';
  return `r${v}`;
}

export async function dis(
  // deno-lint-ignore no-unused-vars
  { input, output, format }: IDisArgs,
): Promise<number> {
  try {
    const data = await Deno.readFile(input).catch((e) => {
      console.error(`${e}\nFailed to read input file: ${input}`);
      throw false;
    });
    const view = new DataView(data.buffer);

    // TODO: if format is gba, then parse the GBA header

    for (let i = 0; i < 200 && i < view.byteLength - 3; i += 4) {
      const opcode = view.getUint32(i, true);
      const res = parseARM(opcode);
      if (res) {
        const { op, syms } = res;
        console.log(pad(
          8,
          op.syntax[0].replace(/\$[a-zA-Z0-9_]+/g, (m) => {
            const sym = m.substr(1);
            if (!syms[sym]) {
              throw new Error(
                `Invalid syntax "${op.syntax[0]}" -- missing symbol: ${sym}`,
              );
            }
            const { v, part } = syms[sym];
            switch (part.k) {
              case 'register':
                return registerToString(v);
              case 'enum':
                return (part.enum[v] || '').split('/')[0];
              case 'rotimm': {
                const rot = (v >> 8) * 2;
                const imm = v & 0xff;
                return `0x${((imm >> rot) | (imm << (32 - rot))).toString(16)}`;
              }
              case 'reglist': {
                const regs = [];
                for (let bpos = 0; bpos < 16; bpos++) {
                  if (v & (1 << bpos)) {
                    regs.push(bpos);
                  }
                }
                return ranges(regs).map(
                  (r) => r.low === r.high ? registerToString(r.low) : `r${r.low}-r${r.high}`,
                ).join(', ');
              }
              case 'value':
              case 'ignored':
              case 'immediate':
              case 'offset12':
              case 'pcoffset12':
              case 'word':
              case 'offsetsplit':
              case 'pcoffsetsplit':
                return `${v}`;
              default:
                assertNever(part);
            }
            return `0x${v.toString(16)}`;
          }),
        ));
      } else {
        console.log(pad(8, `.i32 0x${opcode.toString(16)}`));
      }
    }

    return 0;
  } catch (e) {
    if (e !== false) {
      console.error(`${e}\nUnknown fatal error`);
    }
    return 1;
  }
}
