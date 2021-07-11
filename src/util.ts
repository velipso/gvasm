//
// gvasm - Assembler and disassembler for Game Boy Advance homebrew
// by Sean Connelly (@velipso), https://sean.cm
// The Unlicense License
// Project Home: https://github.com/velipso/gvasm
//

export function assertNever(value: never) {
  throw new Error(`Unexpected value: ${value}`);
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
  return c === " " || c === "\n" || c === "\r" || c === "\t";
}

export function isAlpha(c: string) {
  return (c >= "a" && c <= "z") || (c >= "A" && c <= "Z");
}

export function isNum(c: string) {
  return c >= "0" && c <= "9";
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
