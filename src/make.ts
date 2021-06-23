//
// gbasm - Assembler and disassembler for Game Boy Advance homebrew
// by Sean Connelly (@velipso), https://sean.cm
// The Unlicense License
// Project Home: https://github.com/velipso/gbasm
//

import { ITok, lex, TokEnum } from "./lexer.ts";
import { assertNever } from "./util.ts";
import { Arm, Thumb } from "./ops.ts";

export interface IMakeArgs {
  input: string;
  output: string;
}

interface IParseState {
  arm: boolean;
  armOps: Arm.IParsedOp[];
  thumbOps: Thumb.IParsedOp[];
  tks: ITok[];
  pos: number;
  output: number[];
}

function parseLine(state: IParseState) {
  const nextLine = state.tks.findIndex((tk, i) =>
    i >= state.pos && tk.kind === TokEnum.NEWLINE
  );
  if (nextLine === state.pos) {
    state.pos++;
    return;
  }

  const line = nextLine < 0
    ? state.tks.slice(state.pos)
    : state.tks.slice(state.pos, nextLine);
  state.pos = nextLine < 0 ? state.tks.length : nextLine + 1;

  // check for dot commands
  if (
    line[0].kind === TokEnum.LITERAL && line[0].literal === "." &&
    line.length >= 2
  ) {
    if (line[1].kind === TokEnum.LITERAL) {
      if (line[1].literal === "arm") {
        if (line.length > 2) {
          throw "Invalid .arm command";
        }
        while ((state.output.length % 4) !== 0) { // align 4
          state.output.push(0);
        }
        state.arm = true;
        return;
      } else if (line[1].literal === "thumb") {
        if (line.length > 2) {
          throw "Invalid .thumb command";
        }
        while ((state.output.length % 2) !== 0) { // align 2
          state.output.push(0);
        }
        state.arm = false;
        return;
      } else if (line[1].literal === "align2") {
        if (line.length > 2) {
          throw "Invalid .align2 command";
        }
        while ((state.output.length % 2) !== 0) {
          state.output.push(0);
        }
        return;
      } else if (line[1].literal === "align4") {
        if (line.length > 2) {
          throw "Invalid .align4 command";
        }
        while ((state.output.length % 4) !== 0) {
          state.output.push(0);
        }
        return;
      } else if (line[1].literal === "u8") {
        for (let i = 2; i < line.length; i++) {
          const tok = line[i];
          if (tok.kind === TokEnum.NUM) {
            state.output.push(tok.num & 0xff);
          } else {
            throw "Expecting constant number in .u8";
          }
        }
        return;
      } else if (line[1].literal === "u16") {
        for (let i = 2; i < line.length; i++) {
          const tok = line[i];
          if (tok.kind === TokEnum.NUM) {
            state.output.push(tok.num & 0xff);
            state.output.push((tok.num >> 8) & 0xff);
          } else {
            throw "Expecting constant number in .u16";
          }
        }
        return;
      } else if (line[1].literal === "u32") {
        for (let i = 2; i < line.length; i++) {
          const tok = line[i];
          if (tok.kind === TokEnum.NUM) {
            state.output.push(tok.num & 0xff);
            state.output.push((tok.num >> 8) & 0xff);
            state.output.push((tok.num >> 16) & 0xff);
            state.output.push((tok.num >> 24) & 0xff);
          } else {
            throw "Expecting constant number in .u32";
          }
        }
        return;
      } else {
        throw "Invalid dot command";
      }
    } else {
      throw "Invalid dot command";
    }
  }

  if (state.arm) {
    // align arm ops to 4 bytes
    while ((state.output.length % 4) !== 0) {
      state.output.push(0);
    }

    for (const parsedOp of Arm.parsedOps) {
      // attempt to parse line as parsedOp
      const syms: { [sym: string]: number } = {};
      let i = 0;
      let found = true;
      for (const part of parsedOp.parts) {
        switch (part.kind) {
          case "join": {
            if (i >= line.length) {
              found = false;
            } else {
              const here = line[i++];
              if (here.kind !== TokEnum.LITERAL) {
                // HERE
                console.log("looking for", part, "but here is not a literal");
                found = false;
              } else {
                let literal = here.literal.toLowerCase();
                for (const join of part.joins) {
                  switch (join.kind) {
                    case "str": {
                      if (literal.startsWith(join.str)) {
                        literal = literal.substr(join.str.length);
                      } else {
                        found = false;
                      }
                      break;
                    }
                    case "sym": {
                      const codePart = join.codeParts[0];
                      switch (codePart.k) {
                        case "enum": {
                          let foundEnum = -1;
                          let stop = false;
                          for (let e = 0; e < codePart.enum.length; e++) {
                            const esf = codePart.enum[e];
                            if (esf === false) {
                              continue;
                            }
                            for (const es of esf.split("/")) {
                              if (es === "") {
                                foundEnum = e;
                              } else if (literal.startsWith(es)) {
                                stop = true;
                                foundEnum = e;
                                literal = literal.substr(es.length);
                                break;
                              }
                            }
                            if (stop) {
                              break;
                            }
                          }
                          if (foundEnum >= 0) {
                            syms[join.sym] = foundEnum;
                          } else {
                            found = false;
                          }
                          break;
                        }
                        case "register":
                        case "value":
                        case "ignored":
                        case "immediate":
                        case "rotimm":
                        case "offset12":
                        case "reglist":
                        case "word":
                        case "offsetsplit":
                          console.error(
                            "1 Don't know how to interpret",
                            codePart.k,
                          );
                          found = false;
                          break;
                        default:
                          assertNever(codePart);
                      }
                      break;
                    }
                    default:
                      assertNever(join);
                  }
                  if (!found) {
                    break;
                  }
                }
                if (literal !== "") {
                  found = false;
                }
              }
            }
            break;
          }
          case "sym": {
            const codePart = part.codeParts[0];
            switch (codePart.k) {
              case "immediate":
              case "rotimm":
                if (i >= line.length) {
                  found = false;
                } else {
                  const here = line[i++];
                  if (here.kind === TokEnum.NUM) {
                    syms[part.sym] = here.num;
                  } else {
                    found = false;
                  }
                }
                break;
              case "register": {
                if (i >= line.length) {
                  found = false;
                } else {
                  const here = line[i++];
                  if (here.kind === TokEnum.LITERAL) {
                    const literal = here.literal;
                    let reg = -1;
                    if (literal === "sp") {
                      reg = 13;
                    } else if (literal === "lr") {
                      reg = 14;
                    } else if (literal === "pc") {
                      reg = 15;
                    } else if (/^[rR]([0-9]|(1[0-5]))$/.test(literal)) {
                      reg = parseInt(literal.substr(1), 10);
                    }
                    if (reg >= 0 && reg <= 15) {
                      syms[part.sym] = reg;
                    } else {
                      found = false;
                    }
                  } else {
                    found = false;
                  }
                }
                break;
              }
              case "enum":
              case "value":
              case "ignored":
              case "offset12":
              case "reglist":
              case "word":
              case "offsetsplit":
                console.error("2 Don't know how to interpret", codePart.k);
                found = false;
                break;
              default:
                assertNever(codePart);
            }
            break;
          }
          case "str":
            if (i >= line.length) {
              found = false;
            } else {
              const here = line[i++];
              if (here.kind !== TokEnum.LITERAL || here.literal !== part.str) {
                found = false;
              }
            }
            break;
          case "num":
            if (i >= line.length) {
              found = false;
            } else {
              const here = line[i++];
              if (here.kind !== TokEnum.NUM || here.num !== part.num) {
                found = false;
              }
            }
            break;
          default:
            assertNever(part);
        }
        if (!found) {
          break;
        }
      }
      if (found && i === line.length) {
        // found the op!
        let opcode = 0;
        let bpos = 0;
        const push = (size: number, v: number) => {
          opcode |= v << bpos;
          bpos += size;
          while (bpos >= 8) {
            state.output.push(opcode & 0xff);
            opcode >>= 8;
            bpos -= 8;
          }
        };
        for (const codePart of parsedOp.op.codeParts) {
          switch (codePart.k) {
            case "immediate":
            case "enum":
            case "register":
              push(codePart.s, syms[codePart.sym]);
              break;
            case "value":
            case "ignored":
              push(codePart.s, codePart.v);
              break;
            case "rotimm": {
              // calculate rotate immediate form of v
              let v = syms[codePart.sym];
              let r = 0;
              while (v > 0 && (v & 3) === 0) {
                v >>= 2;
                r++;
              }
              if (v > 255) {
                throw new Error(
                  `Can't generate rotimm from ${syms[codePart.sym]}`,
                );
              }
              push(12, (((16 - r) & 0xf) << 8) | (v & 0xff));
              break;
            }
            case "offset12":
            case "reglist":
            case "word":
            case "offsetsplit":
              throw new Error(`TODO: push with ${codePart.k}`);
            default:
              assertNever(codePart);
          }
        }
        return;
      }
    }

    throw "todo";
  } else {
    // align thumb ops to 2 bytes
    while ((state.output.length % 2) !== 0) {
      state.output.push(0);
    }
  }
}

export async function make({ input, output }: IMakeArgs): Promise<number> {
  try {
    const data = await Deno.readTextFile(input).catch((e) => {
      console.error(`${e}\nFailed to read input file: ${input}`);
      throw false;
    });

    const tokens = lex(input, data);

    const errors = tokens.filter((t) => t.kind === TokEnum.ERROR);
    if (errors.length > 0) {
      console.error(errors);
      throw false;
    }

    const state: IParseState = {
      arm: true,
      armOps: [],
      thumbOps: [],
      tks: tokens,
      pos: 0,
      output: [],
    };

    if (state.tks.length > 0) {
      let flp = state.tks[0].flp;
      try {
        while (state.pos < state.tks.length) {
          flp = state.tks[state.pos].flp;
          parseLine(state);
        }
      } catch (e) {
        console.error(`${flp.filename}:${flp.line}:${flp.chr}: ${e}`);
        throw false;
      }
    }

    await Deno.writeFile(output, new Uint8Array(state.output));

    return 0;
  } catch (e) {
    if (e !== false) {
      console.error(`${e}\nUnknown fatal error`);
    }
    return 1;
  }
}
