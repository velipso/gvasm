//
// gbasm - Assembler and disassembler for Game Boy Advance homebrew
// by Sean Connelly (@velipso), https://sean.cm
// The Unlicense License
// Project Home: https://github.com/velipso/gbasm
//

export function assertNever(value: never) {
  throw new Error(`Unexpected value: ${value}`);
}

export interface IRange {
  low: number;
  high: number;
}

export function ranges(list: number[]): IRange[] {
  list.sort((a, b) => a - b);
  const result: IRange[] = [];
  let start = 0;
  for (let i = 1; i < list.length; i++) {
    if (list[i] !== list[start] + i) {
      result.push({ low: list[start], high: list[i - 1] });
      start = i;
    }
  }
  if (list.length > 0) {
    result.push({ low: list[start], high: list[list.length - 1] });
  }
  return result;
}
