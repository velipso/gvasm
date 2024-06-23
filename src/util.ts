//
// gvasm - Assembler and disassembler for Game Boy Advance homebrew
// by Sean Connelly (@velipso), https://sean.fun
// Project Home: https://github.com/velipso/gvasm
// SPDX-License-Identifier: 0BSD
//

export function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${value}`);
}

export function hex16(n: number) {
  return `0x${`000${n.toString(16)}`.substr(-4)}`;
}

export function hex32(n: number) {
  return `0x${`0000000${n.toString(16)}`.substr(-8)}`;
}

export interface IRange {
  low: number;
  high: number;
}

export function ranges(list: number[]): IRange[] {
  const sorted = [...list].sort((a, b) => a - b);
  const result: IRange[] = [];
  let start = 0;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] !== sorted[start] + i) {
      result.push({ low: sorted[start], high: sorted[i - 1] });
      start = i;
    }
  }
  if (sorted.length > 0) {
    result.push({ low: sorted[start], high: sorted[sorted.length - 1] });
  }
  return result;
}

export function isSpace(c: string) {
  return c === ' ' || c === '\n' || c === '\r' || c === '\t';
}

export function isAlpha(c: string) {
  return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z');
}

export function isNum(c: string) {
  return c >= '0' && c <= '9';
}

// reverse byte order
export function b16(v: number) {
  const b1 = v & 0xff;
  const b2 = (v >> 8) & 0xff;
  return (b1 << 8) | b2;
}

// reverse byte order
export function b32(v: number) {
  const b1 = v & 0xff;
  const b2 = (v >> 8) & 0xff;
  const b3 = (v >> 16) & 0xff;
  const b4 = (v >> 24) & 0xff;
  return (b1 << 24) | (b2 << 16) | (b3 << 8) | b4;
}

export function i8(v: number) {
  return v >= 128 ? v - 256 : v;
}

export function i16(v: number) {
  return v >= 32768 ? v - 65536 : v;
}

export function i32(v: number) {
  return v >= 2147483648 ? v - 4294967296 : v;
}

export function u8(v: number) {
  return v < 0 ? 256 + v : v;
}

export function u16(v: number) {
  return v < 0 ? 65536 + v : v;
}

export function u32(v: number) {
  return v < 0 ? 4294967296 + v : v;
}

export function waitForever<T>(): Promise<T> {
  return new Promise(() => {
    setInterval(() => {}, 9999999);
  });
}

export function dig2(n: number) {
  return `${n < 10 ? '0' : ''}${n}`;
}

export function timestamp() {
  const now = new Date();
  return `[${dig2(now.getHours())}:${dig2(now.getMinutes())}:${dig2(now.getSeconds())}]`;
}

export function calcRotImm(v: number): number | false {
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

export function setIsSuperset<T>(set: Set<T>, subset: Set<T>) {
  for (const elem of subset) {
    if (!set.has(elem)) {
      return false;
    }
  }
  return true;
}

export function setUnion<T>(setA: Set<T>, setB: Set<T>): Set<T> {
  const union = new Set(setA);
  for (const elem of setB) {
    union.add(elem);
  }
  return union;
}

export function setIntersection<T>(setA: Set<T>, setB: Set<T>): Set<T> {
  const inter = new Set<T>();
  for (const elem of setB) {
    if (setA.has(elem)) {
      inter.add(elem);
    }
  }
  return inter;
}

export function setXor<T>(setA: Set<T>, setB: Set<T>): Set<T> {
  const diff = new Set(setA);
  for (const elem of setB) {
    if (diff.has(elem)) {
      diff.delete(elem);
    } else {
      diff.add(elem);
    }
  }
  return diff;
}

export function setDifference<T>(setA: Set<T>, setB: Set<T>): Set<T> {
  const diff = new Set(setA);
  for (const elem of setB) {
    diff.delete(elem);
  }
  return diff;
}

export function printf(format: string, ...args: number[]): string {
  let out = '';
  let lastIndex = 0;
  for (const match of format.matchAll(/%([-+0#]+)?(\d+)?([%bdiouxX])/g)) {
    const index = match.index as number;
    out += format.substr(lastIndex, index - lastIndex);
    if (match[3] === '%') {
      out += '%';
    } else {
      const flag = (f: string) => (match[1] ?? '').indexOf(f) >= 0;
      const width = parseFloat(match[2] ?? '-1');
      const format = match[3] ?? 'd';

      let str;
      const arg = args.shift();
      if (arg === undefined) {
        str = match[0];
      } else {
        const v = arg | 0;
        let prefix = '';
        switch (format) {
          case 'b':
            str = v.toString(2);
            if (flag('#')) {
              prefix = '0b';
            }
            break;
          case 'o':
            str = v.toString(8);
            if (flag('#')) {
              prefix = '0c';
            }
            break;
          case 'u':
            str = (v < 0 ? v + 4294967296 : v).toString();
            break;
          case 'x':
            str = (v < 0 ? v + 4294967296 : v).toString(16).toLowerCase();
            if (flag('#')) {
              prefix = '0x';
            }
            break;
          case 'X':
            str = (v < 0 ? v + 4294967296 : v).toString(16).toUpperCase();
            if (flag('#')) {
              prefix = '0x';
            }
            break;
          default:
            str = v.toString();
            break;
        }

        if (flag('+')) {
          prefix = (v < 0 ? '-' : '+') + prefix;
        }

        if (prefix) {
          if (flag('0')) {
            while (str.length < width) {
              str = '0' + str;
            }
            str = prefix + str;
          } else {
            str = prefix + str;
            while (str.length < width) {
              if (flag('-')) {
                str += ' ';
              } else {
                str = ' ' + str;
              }
            }
          }
        } else {
          while (str.length < width) {
            if (flag('0')) {
              str = '0' + str;
            } else if (flag('-')) {
              str += ' ';
            } else {
              str = ' ' + str;
            }
          }
        }
      }

      out += str;
    }

    lastIndex = index + match[0].length;
  }
  out += format.substr(lastIndex);
  return out;
}
