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

export interface ILineStr {
  filename: string;
  line: number;
  data: string;
  main: boolean;
}

export function splitLines(
  filename: string,
  lines: string,
  main: boolean,
  startLine = 1,
): ILineStr[] {
  return (
    lines.split("\r\n")
      .flatMap((a) => a.split("\r"))
      .flatMap((a) => a.split("\n"))
      .map((data, i) => ({ filename, line: startLine + i, data, main }))
  );
}

export function printf(format: string, ...args: number[]): string {
  let out = "";
  let lastIndex = 0;
  for (const match of format.matchAll(/%([-+0#]+)?(\d+)?([%bdiouxX])/g)) {
    const index = match.index as number;
    out += format.substr(lastIndex, index - lastIndex);
    if (match[3] === "%") {
      out += "%";
    } else {
      const flag = (f: string) => (match[1] ?? "").indexOf(f) >= 0;
      const width = parseFloat(match[2] ?? "-1");
      const format = match[3] ?? "d";

      let str;
      const arg = args.shift();
      if (arg === undefined) {
        str = match[0];
      } else {
        const v = arg | 0;
        let prefix = "";
        switch (format) {
          case "b":
            str = v.toString(2);
            if (flag("#")) {
              prefix = "0b";
            }
            break;
          case "o":
            str = v.toString(8);
            if (flag("#")) {
              prefix = "0c";
            }
            break;
          case "u":
            str = (v < 0 ? v + 4294967296 : v).toString();
            break;
          case "x":
            str = (v < 0 ? v + 4294967296 : v).toString(16).toLowerCase();
            if (flag("#")) {
              prefix = "0x";
            }
            break;
          case "X":
            str = (v < 0 ? v + 4294967296 : v).toString(16).toUpperCase();
            if (flag("#")) {
              prefix = "0x";
            }
            break;
          default:
            str = v.toString();
            break;
        }

        if (flag("+")) {
          prefix = (v < 0 ? "-" : "+") + prefix;
        }

        if (prefix) {
          if (flag("0")) {
            while (str.length < width) {
              str = "0" + str;
            }
            str = prefix + str;
          } else {
            str = prefix + str;
            while (str.length < width) {
              if (flag("-")) {
                str += " ";
              } else {
                str = " " + str;
              }
            }
          }
        } else {
          while (str.length < width) {
            if (flag("0")) {
              str = "0" + str;
            } else if (flag("-")) {
              str += " ";
            } else {
              str = " " + str;
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
