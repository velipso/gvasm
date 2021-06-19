//
// gbasm - Assembler and disassembler for Game Boy Advance homebrew
// by Sean Connelly (@velipso), https://sean.cm
// The Unlicense License
// Project Home: https://github.com/velipso/gbasm
//

import { ICodePart, IOp, ops } from "./ops.ts";
import { assertNever } from "./util.ts";

export interface IDisArgs {
  input: string;
  format: "gba" | "bin";
  output: string;
}

interface ISyms {
  [sym: string]: {
    v: number;
    part: ICodePart;
  };
}

function parseArm(opcode: number): { op: IOp; syms: ISyms } | false {
  for (const op of ops) {
    if (!op.arm) {
      continue;
    }

    let error: string | undefined;
    let bpos = 0;
    const syms: ISyms = {};
    for (const part of op.codeParts) {
      const v = (opcode >> bpos) & ((1 << part.s) - 1);
      switch (part.k) {
        case "register":
          syms[part.sym] = { v, part };
          break;
        case "value":
          if (v !== part.v) {
            error = `value at ${bpos} doesn't match: ${v} != ${part.v}`;
            break;
          }
          if (part.sym) {
            syms[part.sym] = { v, part };
          }
          break;
        case "enum":
          if (part.enum[v] === false) {
            error = `enum at ${bpos} is false at ${v}`;
            break;
          }
          syms[part.sym] = { v, part };
          break;
        case "ignored":
        case "immediate":
        case "rotimm":
        case "offset12":
        case "offset24":
        case "offsetlow":
          if (part.sym) {
            syms[part.sym] = { v, part };
          }
          break;
        case "offsethigh":
          if (syms[part.sym]) {
            syms[part.sym].v |= v << 4;
          } else {
            throw new Error(
              "Invalid op data, offsethigh must appear after offsetlow",
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
    return { op, syms };
  }
  return false;
}

function pad(amount: number, code: string): string {
  const space = code.indexOf(" ");
  if (space >= 0) {
    let left = code.substr(0, space + 1);
    const right = code.substr(space + 1);
    while (left.length < amount) {
      left += " ";
    }
    return left + right;
  }
  return code;
}

export async function dis(
  { input, output, format }: IDisArgs,
): Promise<number> {
  try {
    const data = await Deno.readFile(input).catch((e) => {
      console.error(`${e}\nFailed to read input file: ${input}`);
      throw false;
    });
    const view = new DataView(data.buffer);

    // TODO: if format is gba, then parse the GBA header

    for (let i = 0; i < 200; i += 4) {
      const opcode = view.getUint32(i, true);
      const res = parseArm(opcode);
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
              case "register":
                if (v === 13) return "sp";
                if (v === 14) return "lr";
                if (v === 15) return "pc";
                return `r${v}`;
              case "enum":
                return (part.enum[v] || "").split("/")[0];
              case "rotimm": {
                const rot = (v >> 8) * 2;
                const imm = v & 0xff;
                return `0x${((imm >> rot) | (imm << (32 - rot))).toString(16)}`;
              }
              case "value":
              case "ignored":
              case "immediate":
              case "offset12":
              case "offset24":
              case "offsetlow":
              case "offsethigh":
                break;
              default:
                assertNever(part);
            }
            return `0x${v.toString(16)}`;
          }),
        ));
      } else {
        console.log(pad(8, `.u32 0x${opcode.toString(16)}`));
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
