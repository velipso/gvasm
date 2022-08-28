//
// gvasm - Assembler and disassembler for Game Boy Advance homebrew
// by Sean Connelly (@velipso), https://sean.cm
// Project Home: https://github.com/velipso/gvasm
// SPDX-License-Identifier: 0BSD
//

import { Path } from './deps.ts';
import { IMakeResult, Project } from './project.ts';
import * as sink from './sink.ts';
import { timestamp } from './util.ts';
import { ILexKeyValue } from './lexer.ts';
export type { IMakeResult };

export interface IMakeArgs {
  input: string;
  output: string;
  defines: ILexKeyValue[];
  watch: boolean;
}

/*
interface IDotStackBegin {
  kind: 'begin';
  arm: boolean;
  base: IBase;
  regs: string[];
  flp: IFilePos;
}

interface IDotStackIf {
  kind: 'if';
  flp: IFilePos;
  isTrue: boolean;
  gotTrue: boolean;
  gotElse: boolean;
}

interface IDotStackStruct {
  kind: 'struct';
  flp: IFilePos;
}

interface IDotStackScript {
  kind: 'script';
  flp: IFilePos;
}

interface IDotStackMacro {
  kind: 'macro';
  flp: IFilePos;
}

type IDotStack =
  | IDotStackBegin
  | IDotStackIf
  | IDotStackStruct
  | IDotStackScript
  | IDotStackMacro;
*/
interface IDebugStatementLog {
  kind: 'log';
  addr: number;
  format: string;
  // TODO: args: Expression[];
}

interface IDebugStatementExit {
  kind: 'exit';
  addr: number;
}

export type IDebugStatement = IDebugStatementLog | IDebugStatementExit;
/*
interface IParseState {
  firstARM: boolean;
  arm: boolean;
  main: boolean;
  regs: string[];
  base: IBase;
  bytes: Bytes;
  debug: IDebugStatement[];
  ctable: ConstTable;
  active: boolean;
  struct: false | {
    nextByte: number;
    prefix: string[];
    defines: { name: string; value: number }[];
  };
  dotStack: IDotStack[];
  script: boolean | {
    scr: sink.scr;
    body: ILineStr[];
    startFile: string;
  };
  store: { [key: string]: string };
  onceFound: Set<string>;
  posix: boolean;
  fileType(filename: string): Promise<sink.fstype>;
  readBinaryFile(filename: string): Promise<number[] | Uint8Array>;
  log(str: string): void;
}

type ISyms = { [sym: string]: Expression | number };

function parseComma(line: ITok[], error: string) {
  if (isNextId(line, ',')) {
    line.shift();
  } else {
    throw error;
  }
}

function parseNum(state: IParseState, line: ITok[], quiet = false): number {
  const expr = ExpressionBuilder.parse(line, [], state.ctable);
  if (expr === false) {
    if (quiet) {
      return 0;
    }
    throw 'Expecting constant number';
  }
  const e = expr.build([]);
  state.bytes.addLabelsToExpression(e);
  const v = e.value();
  if (v === false) {
    if (quiet) {
      return 0;
    }
    e.validateNoLabelsNeeded('Expecting constant number');
    throw 'Expecting constant number';
  }
  return v;
}

function parseExpr(line: ITok[], ctable: ConstTable): Expression {
  const expr = ExpressionBuilder.parse(line, [], ctable);
  if (expr === false) {
    throw 'Expecting constant expression';
  }
  return expr.build([]);
}

function parseNumCommas(
  state: IParseState,
  line: ITok[],
  defaults: (number | false)[],
  error: string,
): number[] {
  const result: number[] = [];
  for (const def of defaults) {
    if (def === false || line.length > 0) {
      result.push(parseNum(state, line));
      if (isNextId(line, ',')) {
        line.shift();
      }
    } else {
      result.push(def);
    }
  }
  if (line.length > 0) {
    throw error;
  }
  return result;
}

function parseDotStatement(
  state: IParseState,
  cmd: string,
  line: ITok[],
  cmdFlp: IFilePos,
):
  | { include: string }
  | { embed: string }
  | { stdlib: true }
  | { extlib: true }
  | undefined {
  switch (cmd) {
    case '.error': {
      const format = line.shift();
      if (!format || format.kind !== TokEnum.STR) {
        throw 'Invalid .error statement';
      }
      const args: number[] = [];
      while (isNextId(line, ',')) {
        line.shift();
        args.push(parseNum(state, line));
      }
      if (line.length > 0) {
        throw 'Invalid .error statement';
      }
      throw printf(format.str, ...args);
    }
    case '.base': {
      const amount = parseNum(state, line);
      if (line.length > 0) {
        throw 'Invalid .base statement';
      }
      const base = state.bytes.makeBase(amount);
      setBase(state, base);
      state.bytes.setBase(base);
      break;
    }
    case '.arm':
      if (line.length > 0) {
        throw 'Invalid .arm statement';
      }
      state.bytes.align(4);
      setARM(state, true);
      break;
    case '.thumb':
      if (line.length > 0) {
        throw 'Invalid .thumb statement';
      }
      state.bytes.align(2);
      setARM(state, false);
      break;
    case '.regs': {
      const regs: string[] = [];
      if (line.length <= 0) {
        state.log(errorString(cmdFlp, `Registers: ${getRegs(state).join(', ')}`));
      } else {
        while (line.length > 0) {
          const name1 = parseName(line);
          if (name1 === false) {
            throw 'Invalid .regs statement; bad name';
          }
          if (isNextId(line, '-')) {
            line.shift();
            const name2 = parseName(line);
            if (name2 === false) {
              throw 'Invalid .regs statement; bad name';
            }
            const m1 = name1.match(/[0-9]+$/);
            const m2 = name2.match(/[0-9]+$/);
            if (m1 === null || m2 === null) {
              throw `Invalid range in .regs statement; names must end with numbers: ${name1}-${name2}`;
            }
            const prefix1 = name1.substr(0, name1.length - m1[0].length);
            const prefix2 = name2.substr(0, name2.length - m2[0].length);
            if (prefix1 !== prefix2) {
              throw `Invalid range in .regs statement; prefix mismatch: ${name1}-${name2}`;
            }
            const n1 = parseFloat(m1[0]);
            const n2 = parseFloat(m2[0]);
            if (n2 < n1) {
              if (n1 - n2 + 1 > 12) {
                throw `Invalid range in .regs statement; range too large: ${name1}-${name2}`;
              }
              for (let i = n1; i >= n2; i--) {
                regs.push(`${prefix1}${i}`);
              }
            } else {
              if (n2 - n1 + 1 > 12) {
                throw `Invalid range in .regs statement; range too large: ${name1}-${name2}`;
              }
              for (let i = n1; i <= n2; i++) {
                regs.push(`${prefix1}${i}`);
              }
            }
          } else {
            regs.push(name1);
          }
          if (line.length > 0) {
            parseComma(line, `Invalid ${cmd} statement`);
          }
        }
        if (regs.length !== 12) {
          if (regs.length > 0) {
            throw `Invalid .regs statement; expecting 12 names but got ${regs.length}: ${
              regs.join(', ')
            }`;
          } else {
            throw 'Invalid .regs statement; missing register names';
          }
        }
        for (let i = 0; i < regs.length; i++) {
          if (reservedRegs.indexOf(regs[i]) >= 0) {
            throw `Invalid .regs statement; can't use reserved name: ${regs[i]}`;
          }
        }
        setRegs(state, regs);
      }
      break;
    }
    case '.align': {
      const amount = parseNum(state, line);
      let fill: number | 'nop' = 0;
      if (isNextId(line, ',')) {
        line.shift();
        if (isNextId(line, 'nop')) {
          line.shift();
          fill = 'nop';
        } else {
          fill = parseNum(state, line) & 0xff;
        }
      }
      if (line.length > 0 || amount < 2 || amount > 0x02000000) {
        throw 'Invalid .align statement';
      }
      if (fill === 'nop') {
        if (isARM(state)) {
          state.bytes.alignNop32(amount, 0x00, 0x00, 0xa0, 0xe1);
        } else {
          state.bytes.alignNop16(amount, 0xc0, 0x46);
        }
      } else {
        state.bytes.align(amount, fill);
      }
      break;
    }
    case '.i8':
    case '.b8':
      while (line.length > 0) {
        const t = line[0];
        if (t.kind === TokEnum.STR) {
          line.shift();
          for (const n of new TextEncoder().encode(t.str)) {
            state.bytes.write8(n);
          }
        } else {
          state.bytes.expr8(
            errorString(t.flp, `Invalid ${cmd} statement`),
            { v: parseExpr(line, state.ctable) },
            false,
            ({ v }) => v,
          );
        }
        if (line.length > 0) {
          parseComma(line, `Invalid ${cmd} statement`);
        }
      }
      break;
    case '.i8fill':
    case '.b8fill': {
      const [amount, fill] = parseNumCommas(
        state,
        line,
        [false, 0],
        `Invalid ${cmd} statement`,
      );
      if (amount < 0) {
        throw `Invalid ${cmd} statement`;
      }
      for (let i = 0; i < amount; i++) {
        state.bytes.write8(fill);
      }
      break;
    }
    case '.i16':
    case '.b16':
      while (line.length > 0) {
        state.bytes.expr16(
          errorString(line[0].flp, `Invalid ${cmd} statement`),
          { v: parseExpr(line, state.ctable) },
          false,
          ({ v }) => {
            if (cmd === '.b16') {
              return b16(v);
            }
            return v;
          },
        );
        if (line.length > 0) {
          parseComma(line, `Invalid ${cmd} statement`);
        }
      }
      break;
    case '.i16fill':
    case '.b16fill': {
      const [amount, fill] = parseNumCommas(
        state,
        line,
        [false, 0],
        `Invalid ${cmd} statement`,
      );
      if (amount < 0) {
        throw `Invalid ${cmd} statement`;
      }
      for (let i = 0; i < amount; i++) {
        state.bytes.write16(cmd === '.b16fill' ? b16(fill) : fill);
      }
      break;
    }
    case '.i32':
    case '.b32':
      while (line.length > 0) {
        state.bytes.expr32(
          errorString(line[0].flp, `Invalid ${cmd} statement`),
          { v: parseExpr(line, state.ctable) },
          false,
          ({ v }) => {
            if (cmd === '.b32') {
              return b32(v);
            }
            return v;
          },
        );
        if (line.length > 0) {
          parseComma(line, `Invalid ${cmd} statement`);
        }
      }
      break;
    case '.i32fill':
    case '.b32fill': {
      const [amount, fill] = parseNumCommas(
        state,
        line,
        [false, 0],
        `Invalid ${cmd} statement`,
      );
      if (amount < 0) {
        throw `Invalid ${cmd} statement`;
      }
      for (let i = 0; i < amount; i++) {
        state.bytes.write32(cmd === '.b32fill' ? b32(fill) : fill);
      }
      break;
    }
    case '.include': {
      const t = line.shift();
      if (!t || t.kind !== TokEnum.STR || line.length > 0) {
        throw 'Invalid .include statement';
      }
      return { include: t.str };
    }
    case '.embed': {
      const t = line.shift();
      if (!t || t.kind !== TokEnum.STR || line.length > 0) {
        throw 'Invalid .include statement';
      }
      return { embed: t.str };
    }
    case '.stdlib':
      return { stdlib: true };
    case '.extlib':
      return { extlib: true };
    case '.logo':
      if (line.length > 0) {
        throw 'Invalid .logo statement';
      }
      state.bytes.writeLogo();
      break;
    case '.title': {
      const t = line.shift();
      if (!t || t.kind !== TokEnum.STR || line.length > 0) {
        throw 'Invalid .title statement';
      }
      const data = new TextEncoder().encode(t.str);
      if (data.length > 12) {
        throw 'Invalid .title statement: title can\'t exceed 12 bytes';
      }
      for (let i = 0; i < 12; i++) {
        state.bytes.write8(i < data.length ? data[i] : 0);
      }
      break;
    }
    case '.crc':
      if (line.length > 0) {
        throw 'Invalid .crc statement';
      }
      state.bytes.writeCRC();
      break;
    case '.printf': {
      const format = line.shift();
      if (!format || format.kind !== TokEnum.STR) {
        throw 'Invalid .printf statement';
      }
      const args: number[] = [];
      while (isNextId(line, ',')) {
        line.shift();
        args.push(parseNum(state, line));
      }
      if (line.length > 0) {
        throw 'Invalid .printf statement';
      }
      state.log(printf(format.str, ...args));
      break;
    }
    case '.pool':
      if (line.length > 0) {
        throw 'Invalid .pool statement';
      }
      if (state.bytes.writePool()) {
        state.bytes.align(isARM(state) ? 4 : 2);
      }
      break;
    case '.def': {
      if (!isNextId(line, '$')) {
        throw 'Expecting $const after .def';
      }
      line.shift();
      let prefix = '$';
      if (isNextId(line, '$')) {
        line.shift();
        prefix += '$';
      }
      const name = parseName(line);
      if (name === false) {
        throw 'Invalid constant name';
      }
      const paramNames: string[] = [];
      if (isNextId(line, '(')) {
        line.shift();
        while (!isNextId(line, ')')) {
          if (!isNextId(line, '$')) {
            throw 'Expecting $param inside .def parameter list';
          }
          line.shift();
          if (isNextId(line, '$')) {
            throw 'Use $param instead of $$param inside parameter list';
          }
          const pname = parseName(line);
          if (pname === false) {
            throw 'Expecting $param inside .def parameter list';
          }
          paramNames.push('$' + pname);
          if (isNextId(line, ',')) {
            line.shift();
          } else {
            break;
          }
        }
        if (!isNextId(line, ')')) {
          throw 'Missing `)` at end of parameter list';
        }
        line.shift();
      }
      if (!isNextId(line, '=')) {
        throw 'Missing `=` in .def statement';
      }
      line.shift();
      const expr = ExpressionBuilder.parse(line, paramNames, state.ctable);
      if (expr === false) {
        throw 'Invalid expression in .def statement';
      }
      if (line.length > 0) {
        throw 'Invalid .def statement';
      }
      state.ctable.def(prefix + name, paramNames, expr);
      break;
    }
    default:
      throw `Unknown dot statement: ${cmd}`;
  }
}

function parseDebugStatement(
  state: IParseState,
  cmd: string,
  line: ITok[],
) {
  switch (cmd) {
    case '_log': {
      const format = line.shift();
      if (!format || format.kind !== TokEnum.STR) {
        throw 'Invalid _log statement';
      }
      const args: Expression[] = [];
      const regs = getRegs(state);
      while (isNextId(line, ',')) {
        line.shift();
        const expr = ExpressionBuilder.parse(line, [], state.ctable, regs);
        if (expr === false) {
          throw 'Invalid expression in _log statement';
        }
        args.push(expr.build([]));
      }
      if (line.length > 0) {
        throw 'Invalid _log statement';
      }
      state.debug.push({
        kind: 'log',
        addr: state.bytes.nextAddress(),
        format: format.str,
        args,
      });
      break;
    }
    case '_exit':
      if (line.length > 0) {
        throw 'Invalid _exit statement';
      }
      state.debug.push({
        kind: 'exit',
        addr: state.bytes.nextAddress(),
      });
      break;
    default:
      throw `Unknown debug statement: ${cmd}`;
  }
}

function recalcActive(state: IParseState): boolean {
  return state.dotStack.every((ds) => ds.kind !== 'if' || ds.isTrue);
}

function parseBlockStatement(
  state: IParseState,
  line: ITok[],
  cmd: string,
  flp: IFilePos,
): boolean {
  const ds = state.dotStack[state.dotStack.length - 1];
  switch (cmd) {
    case '.begin':
      if (line.length > 0 && state.active) {
        throw 'Invalid .begin statement';
      }
      if (state.active) {
        state.ctable.scopeBegin();
        state.bytes.scopeBegin();
      }
      state.dotStack.push({
        kind: 'begin',
        arm: isARM(state),
        base: getBase(state),
        regs: getRegs(state),
        flp,
      });
      return true;
    case '.script':
      if (line.length > 0 && state.active) {
        throw 'Invalid .script statement';
      }
      if (state.active) {
        const body: ILineStr[] = [];
        const resolvedStartFile = pathResolve(state.posix, flp.filename);
        const startFile = pathBasename(state.posix, flp.filename);
        const scr = sink.scr_new(
          {
            f_fstype: (_scr: sink.scr, file: string): Promise<sink.fstype> => {
              if (file === resolvedStartFile) {
                return Promise.resolve(sink.fstype.FILE);
              }
              return state.fileType(file);
            },
            f_fsread: async (scr: sink.scr, file: string): Promise<boolean> => {
              if (file === resolvedStartFile) {
                await sink.scr_write(
                  scr,
                  body.map((b) => b.data).join('\n'),
                  body[0]?.line ?? 1,
                );
                return true;
              }
              try {
                const data = await state.readBinaryFile(file);
                let text = '';
                for (const b of data) {
                  text += String.fromCharCode(b);
                }
                await sink.scr_write(scr, text, body[0]?.line ?? 1);
                return true;
              } catch (_e) {
                // ignore errors
              }
              return false;
            },
          },
          pathDirname(state.posix, resolvedStartFile),
          state.posix,
          false,
        );
        sink.scr_addpath(scr, '.');
        loadLibIntoScript(scr, state.ctable);
        state.script = { scr, startFile, body };
      } else {
        state.script = true; // we're in a script, but we're ignoring it
      }
      state.dotStack.push({ kind: 'script', flp });
      return true;
    case '.once': {
      if (line.length > 0 && state.active) {
        throw 'Invalid .once statement';
      }
      const key = flpString(flp);
      const isTrue = !state.onceFound.has(key);
      state.onceFound.add(key);
      state.dotStack.push({
        kind: 'if',
        flp,
        isTrue,
        gotTrue: isTrue,
        gotElse: false,
      });
      state.active = recalcActive(state);
      return true;
    }
    case '.if': {
      const v = parseNum(state, line, !state.active);
      if (line.length > 0 && state.active) {
        throw 'Invalid .if statement';
      }
      state.dotStack.push({
        kind: 'if',
        flp,
        isTrue: v !== 0,
        gotTrue: v !== 0,
        gotElse: false,
      });
      state.active = recalcActive(state);
      return true;
    }
    case '.elseif': {
      const v = parseNum(state, line, !state.active);
      if (line.length > 0 && state.active) {
        throw 'Invalid .elseif statement';
      }
      if (!ds || ds.kind !== 'if') {
        throw 'Unexpected .elseif statement, missing .if';
      }
      if (ds.gotElse) {
        throw 'Cannot have .elseif statement after .else';
      }
      if (ds.gotTrue) {
        ds.isTrue = false;
      } else {
        ds.isTrue = v !== 0;
        ds.gotTrue = v !== 0;
      }
      state.active = recalcActive(state);
      return true;
    }
    case '.else': {
      if (line.length > 0 && state.active) {
        throw 'Invalid .else statement';
      }
      if (!ds || ds.kind !== 'if') {
        throw 'Unexpected .else statement, missing .if';
      }
      if (ds.gotElse) {
        throw 'Cannot have more than one .else statement';
      }
      ds.gotElse = true;
      ds.isTrue = !ds.gotTrue;
      ds.gotTrue = true;
      state.active = recalcActive(state);
      return true;
    }
    case '.struct': {
      let cname = '';
      let nextByte = 0;
      try {
        let prefix = '';
        if (!state.struct) {
          if (!isNextId(line, '$')) {
            throw 'Expecting $const after .struct';
          }
          line.shift();
          prefix = '$';
          if (isNextId(line, '$')) {
            line.shift();
            prefix += '$';
          }
        }
        const name = parseName(line);
        if (name === false) {
          throw 'Invalid .struct name';
        }
        if (isNextId(line, '=')) {
          line.shift();
          nextByte = parseNum(state, line);
        }
        if (line.length > 0) {
          throw 'Invalid .struct statement';
        }
        cname = prefix + name;
      } catch (e) {
        if (state.active) {
          throw e;
        }
      }
      state.dotStack.push({
        kind: 'struct',
        flp,
      });
      if (state.struct) {
        state.struct.prefix.push(cname);
      } else {
        state.struct = {
          nextByte,
          prefix: [cname],
          defines: [],
        };
      }
      return true;
    }
    case '.s0':
    case '.s8':
    case '.s16':
    case '.s32': {
      if (!state.struct) {
        if (state.active) {
          throw `Can't use ${cmd} outside of .struct`;
        } else {
          return true;
        }
      }

      const names: [string, number][] = [];
      while (line.length > 0) {
        const name = parseName(line);
        if (name === false) {
          if (state.active) {
            throw `Invalid ${cmd} name`;
          }
          return true;
        }
        let array = 1;
        if (isNextId(line, '[')) {
          line.shift();
          array = parseNum(state, line, !state.active);
          if (array < 1) {
            if (state.active) {
              throw `Invalid ${cmd} array length for "${name}"`;
            }
            return true;
          }
          if (!isNextId(line, ']')) {
            if (state.active) {
              throw `Invalid ${cmd} array for "${name}"`;
            }
            return true;
          }
          line.shift();
        }
        names.push([name, array]);
        if (!isNextId(line, ',')) {
          break;
        }
        line.shift();
      }

      if (line.length > 0 || !state.active) {
        if (state.active) {
          throw `Invalid ${cmd} statement`;
        } else {
          return true;
        }
      }

      const size = cmd === '.s0' ? 0 : cmd === '.s8' ? 1 : cmd === '.s16' ? 2 : 4;
      for (const [name, array] of names) {
        if (size > 0) {
          while ((state.struct.nextByte % size) !== 0) {
            state.struct.nextByte++;
          }
        }
        state.struct.defines.push({
          name: [...state.struct.prefix, name].join('.'),
          value: state.struct.nextByte,
        }, {
          name: [...state.struct.prefix, name, 'length'].join('.'),
          value: array,
        }, {
          name: [...state.struct.prefix, name, 'bytes'].join('.'),
          value: size * array,
        });
        state.struct.nextByte += size * array;
      }
      return true;
    }
    case '.end':
      if (line.length > 0 && state.active) {
        throw 'Invalid .end statement';
      }
      if (
        !ds ||
        (ds.kind !== 'begin' && ds.kind !== 'if' && ds.kind !== 'struct' &&
          ds.kind !== 'script')
      ) {
        throw 'Unexpected .end statement';
      }
      state.dotStack.pop();
      if (ds.kind === 'begin' && state.active) {
        state.ctable.scopeEnd();
        state.bytes.scopeEnd();
        if (ds.arm !== isARM(state)) {
          // if we're switching Thumb <-> ARM due to .end, then realign
          state.bytes.align(ds.arm ? 2 : 4);
        }
        state.bytes.setBase(getBase(state));
      } else if (ds.kind === 'if') {
        state.active = recalcActive(state);
      } else if (ds.kind === 'struct') {
        if (!state.struct) {
          throw new Error('Expecting struct in parse state');
        }
        state.struct.prefix.pop();
        if (state.struct.prefix.length <= 0) {
          // all done!
          if (state.active) {
            for (const { name, value } of state.struct.defines) {
              state.ctable.defNum(name, value);
            }
          }
          state.struct = false;
        }
      }
      return true;
    case '.macro':
    case '.endm':
      throw 'TODO: .macro/.endm';
  }
  return false;
}

function parseLine(
  state: IParseState,
  line: ITok[],
):
  | { include: string }
  | { embed: string }
  | { stdlib: true }
  | { extlib: true }
  | undefined {
  if (!state.struct) {
    // check for labels
    while (true) {
      let label;
      try {
        label = parseLabel(line);
      } catch (e) {
        if (state.active) {
          throw e;
        } else {
          return;
        }
      }
      if (label !== false) {
        if (label.startsWith('@')) {
          if (
            line.length <= 0 || line[0].kind !== TokEnum.ID || line[0].id !== ':'
          ) {
            if (state.active) {
              throw 'Missing colon after label';
            } else {
              return;
            }
          }
          line.shift();
        }
        if (state.active) {
          state.bytes.addLabel(label);
        }
      } else {
        break;
      }
    }
  }

  if (line.length <= 0) {
    return;
  }

  const cmdTok = line.shift();
  if (!cmdTok || cmdTok.kind !== TokEnum.ID) {
    if (state.active) {
      throw 'Invalid statement';
    } else {
      return;
    }
  }
  const cmd = cmdTok.id;

  // check for block-level dot statements
  if (parseBlockStatement(state, line, cmd, cmdTok.flp)) {
    return;
  }

  if (!state.active) {
    return;
  }
  if (state.struct) {
    throw 'Cannot have regular statements inside .struct';
  }

  if (cmd.startsWith('.')) {
    return parseDotStatement(state, cmd, line, cmdTok.flp);
  } else if (cmd.startsWith('_')) {
    parseDebugStatement(state, cmd, line);
    return;
  } else if (isARM(state)) {
    if (state.bytes.length() <= 0) {
      state.firstARM = true;
    }
    const pool = parsePoolStatement(state, [...line], state.ctable);
    if (pool) {
      parseARMPoolStatement(state, cmdTok.flp, cmd, pool);
    } else {
      const ops = ARM.parsedOps[cmd];
      if (!ops) {
        throw `Unknown arm statement: ${cmd}`;
      }
      let lastError = 'Failed to parse arm statement';
      if (
        !ops.some((op) => {
          try {
            return parseARMStatement(state, cmdTok.flp, op, [...line]);
          } catch (e) {
            if (typeof e === 'string') {
              lastError = e;
              return false;
            }
            throw e;
          }
        })
      ) {
        throw lastError;
      }
    }
  } else {
    if (state.bytes.length() <= 0) {
      state.firstARM = false;
    }
    const pool = parsePoolStatement(state, [...line], state.ctable);
    if (pool) {
      parseThumbPoolStatement(state, cmdTok.flp, cmd, pool);
    } else {
      const ops = Thumb.parsedOps[cmd];
      if (!ops) {
        throw `Unknown thumb statement: ${cmd}`;
      }
      let lastError = 'Failed to parse thumb statement';
      if (
        !ops.some((op) => {
          try {
            return parseThumbStatement(state, cmdTok.flp, op, [...line]);
          } catch (e) {
            if (typeof e === 'string') {
              lastError = e;
              return false;
            }
            throw e;
          }
        })
      ) {
        throw lastError;
      }
    }
  }
}
*/

export async function makeFromFile(
  input: string,
  defines: ILexKeyValue[],
  watch: boolean,
  cwd: string,
  path: Path,
  output: (result: IMakeResult) => Promise<void>,
  fileType: (filename: string) => Promise<sink.fstype>,
  readTextFile: (filename: string) => Promise<string>,
  readBinaryFile: (filename: string) => Promise<Uint8Array>,
  watchFileChanges: (filenames: string[]) => Promise<string[]>,
  log: (str: string) => void,
): Promise<void> {
  const mainFilename = path.isAbsolute(input) ? input : path.resolve(cwd, input);

  const proj = new Project(
    mainFilename,
    defines,
    cwd,
    path,
    fileType,
    (filename: string): Promise<string> => {
      console.log('  > reading:', filename);
      return readTextFile(filename);
    },
    readBinaryFile,
    log,
  );

  if (watch) {
    while (true) {
      await output(await proj.make());
      proj.invalidate(await watchFileChanges(proj.filenames()));
    }
  } else {
    await output(await proj.make());
  }

  /*
  let data;
  try {
    data = await readTextFile(fullFile);
  } catch (_) {
    return { errors: [`Failed to read file: ${fullFile}`] };
  }

  try {
    const tks = lex(data);
    const store: Map<string, string> = new Map();
    console.log(await parse(
      fullFile,
      tks,
      store,
      defines,
      posix,
      isAbsolute,
      fileType,
      readTextFile,
      readBinaryFile,
      log
    ));
  } catch (e) {
    if (e instanceof CompError) {
      return { errors: [errorString(filename, e.lc, e.message)] };
    } else {
      throw e;
    }
  }

  throw new Error('TODO: parsed file, now what?');

  const lx = lexNew();
  const bytes = new Bytes();
  const state: IParseState = {
    firstARM: true,
    arm: true,
    base: bytes.getBase(),
    main: true,
    regs: defaultRegs,
    bytes,
    debug: [],
    ctable: new ConstTable(
      [
        '$_version',
        '$_arm',
        '$_thumb',
        '$_main',
        '$_here',
        '$_pc',
        '$_base',
        '$_bytes',
      ],
      (cname) => {
        if (cname === '$_version') {
          return version;
        } else if (cname === '$_arm') {
          return isARM(state) ? 1 : 0;
        } else if (cname === '$_thumb') {
          return !isARM(state) ? 1 : 0;
        } else if (cname === '$_main') {
          return state.main ? 1 : 0;
        } else if (cname === '$_here') {
          return state.bytes.nextAddress();
        } else if (cname === '$_pc') {
          return state.bytes.nextAddress() + (isARM(state) ? 8 : 4);
        } else if (cname === '$_base') {
          return state.bytes.getBase().value;
        } else if (cname === '$_bytes') {
          return state.bytes.length();
        }
        return false;
      },
    ),
    active: true,
    struct: false,
    dotStack: [],
    script: false,
    store: {},
    onceFound: new Set(),
    posix,
    fileType,
    readBinaryFile,
    log,
  };

  for (const def of defines) {
    try {
      state.ctable.defNum(`\$${def.key.toLowerCase()}`, def.value);
    } catch (e) {
      return { errors: [e] };
    }
  }

  const alreadyIncluded = new Set<string>();
  const tokens: ITok[] = [];
  let linePut;
  while ((linePut = linePuts.shift())) {
    switch (linePut.kind) {
      case 'bytes':
        state.bytes.writeArray(linePut.data);
        break;
      case 'str': {
        const { filename, line, data } = linePut;
        state.main = linePut.main;
        if (state.script) {
          // process sink script
          const tok = lexAddLine({ ...lx }, filename, line, data).shift();
          if (tok && tok.kind === TokEnum.ID && tok.id === '.end') {
            if (state.script === true) {
              // ignored script section
              state.script = false;
              linePuts.unshift(linePut);
            } else {
              if (
                await sink.scr_loadfile(state.script.scr, state.script.startFile)
              ) {
                const put: ILinePut[] = [];
                const ctx = sink.ctx_new(state.script.scr, {
                  f_say: (_ctx: sink.ctx, str: sink.str): Promise<sink.val> => {
                    log(str);
                    return Promise.resolve(sink.NIL);
                  },
                  f_warn: () => Promise.resolve(sink.NIL),
                  f_ask: () => Promise.resolve(sink.NIL),
                });
                loadLibIntoContext(ctx, put, state.store, linePut.main, state.ctable);
                const run = await sink.ctx_run(ctx);
                if (run === sink.run.PASS) {
                  linePuts.unshift(linePut);
                  for (let i = put.length - 1; i >= 0; i--) {
                    linePuts.unshift(put[i]);
                  }
                  state.script = false;
                } else {
                  return {
                    errors: [
                      sink.ctx_geterr(ctx) ??
                        errorString({ ...linePut, chr: 1 }, 'Failed to run script'),
                    ],
                  };
                }
              } else {
                return {
                  errors: [
                    sink.scr_geterr(state.script.scr) ??
                      errorString(
                        { ...linePut, chr: 1 },
                        'Failed to compile script',
                      ),
                  ],
                };
              }
            }
          } else {
            if (state.script !== true) { // if not ignored
              state.script.body.push(linePut);
            }
          }
        } else {
          // process assembly
          tokens.push(...lexAddLine(lx, filename, line, data));

          const errors: string[] = [];
          if (
            tokens.filter((t) => {
              if (t.kind === TokEnum.ERROR) {
                errors.push(errorString(t.flp, t.msg));
                return true;
              }
            }).length > 0
          ) {
            return { errors };
          }

          if (
            tokens.length > 0 && tokens[tokens.length - 1].kind === TokEnum.NEWLINE
          ) {
            tokens.pop(); // remove newline
            if (tokens.length > 0) {
              const flp = tokens[0].flp;
              try {
                const includeEmbed = parseLine(state, tokens);
                tokens.splice(0, tokens.length); // remove all tokens

                if (includeEmbed && 'stdlib' in includeEmbed) {
                  linePuts.unshift(...splitLines('stdlib', stdlib, false));
                } else if (includeEmbed && 'extlib' in includeEmbed) {
                  linePuts.unshift(...splitLines('extlib', extlib, false));
                } else if (includeEmbed && 'include' in includeEmbed) {
                  const { include } = includeEmbed;
                  const full = isAbsolute(include)
                    ? include
                    : pathJoin(posix, pathDirname(posix, flp.filename), include);

                  const includeKey = `${flpString(flp)}:${full}`;
                  if (alreadyIncluded.has(includeKey)) {
                    return {
                      errors: [errorString(flp, `Circular include of: ${full}`)],
                    };
                  }
                  alreadyIncluded.add(includeKey);

                  let data2;
                  try {
                    data2 = await readTextFile(full);
                  } catch (_) {
                    return {
                      errors: [errorString(flp, `Failed to include file: ${full}`)],
                    };
                  }

                  linePuts.unshift(...splitLines(full, data2, false));
                } else if (includeEmbed && 'embed' in includeEmbed) {
                  const { embed } = includeEmbed;
                  const full = isAbsolute(embed)
                    ? embed
                    : pathJoin(posix, pathDirname(posix, flp.filename), embed);

                  let data2;
                  try {
                    data2 = await readBinaryFile(full);
                  } catch (_) {
                    return {
                      errors: [errorString(flp, `Failed to embed file: ${full}`)],
                    };
                  }

                  state.bytes.writeArray(data2);
                }
              } catch (e) {
                if (typeof e === 'string') {
                  return { errors: [errorString(flp, e)] };
                }
                throw e;
              }
            }
          }
        }
        break;
      }
      default:
        assertNever(linePut);
    }
  }

  // all done, verify that we don't have any open blocks
  const ds = state.dotStack[state.dotStack.length - 1];
  if (ds) {
    return {
      errors: [errorString(
        ds.flp,
        `Missing .end${ds.kind === 'macro' ? 'm' : ''} for .${ds.kind} statement`,
      )],
    };
  }

  let result;
  try {
    result = state.bytes.get();
  } catch (e) {
    if (typeof e === 'string') {
      return { errors: [e] };
    }
    throw e;
  }
  return { result, base: state.bytes.firstBase, arm: state.firstARM, debug: state.debug };
  */
}

export async function makeResult(
  input: string,
  defines: ILexKeyValue[],
  watch: boolean,
  output: (result: IMakeResult) => Promise<void>,
): Promise<void> {
  const cwd = Deno.cwd();
  const path = new Path();
  await makeFromFile(
    input,
    defines,
    watch,
    cwd,
    path,
    output,
    async (file: string) => {
      const st = await Deno.stat(file);
      if (st !== null) {
        if (st.isFile) {
          return sink.fstype.FILE;
        } else if (st.isDirectory) {
          return sink.fstype.DIR;
        }
      }
      return sink.fstype.NONE;
    },
    Deno.readTextFile,
    Deno.readFile,
    async (filenames: string[]): Promise<string[]> => {
      console.log(
        `${timestamp()} Watching ${filenames.length} file${filenames.length === 1 ? '' : 's'}`,
      );
      const watcher = Deno.watchFs(filenames);
      const iter = watcher[Symbol.asyncIterator]();
      const nextChange = async (): Promise<string[] | false> => {
        while (true) {
          const { value, done } = await iter.next();
          if (done) return false;
          if (value.kind !== 'access' && value.paths.length > 0) return value.paths;
        }
      };

      let closed = false;
      const scheduleClose = (timeout: number) =>
        setTimeout(() => {
          if (!closed) {
            closed = true;
            watcher.close();
          }
        }, timeout);

      const changedList = await nextChange();
      if (changedList === false) {
        throw new Error('Failed to watch files for changes');
      }
      const changed = new Set(changedList);
      scheduleClose(5000); // close after 5 seconds no matter what
      while (true) {
        const timer = scheduleClose(1000); // close after 1 second of inactivity
        const more = await nextChange();
        if (more === false) {
          const ch = Array.from(changed.values());
          console.log(
            `${timestamp()} Detected changes:\n  ${
              ch.map((f) => path.relative(cwd, f)).join('\n  ')
            }`,
          );
          return ch;
        }
        clearTimeout(timer);
        for (const filename of more) changed.add(filename);
      }
    },
    (str) => console.log(str),
  );
}

export async function make({ input, output, defines, watch }: IMakeArgs): Promise<number> {
  try {
    const onResult = async (result: IMakeResult) => {
      const ts = watch ? `${timestamp()} ` : '';
      if ('errors' in result) {
        console.error(`${ts}Error${result.errors.length === 1 ? '' : 's'}:`);
        for (const e of result.errors) {
          console.error(`  ${e}`);
        }
      } else {
        const file = await Deno.open(output, { write: true, create: true, truncate: true });
        for (const section of result.sections) {
          await file.write(section);
        }
        file.close();
        console.log(
          `${ts}Success! Output: ${output}`,
          result.sections.map((n) => Array.from(n)).flat().map((n) =>
            `0${n.toString(16)}`.substr(-2)
          ).join(' '),
        );
      }
    };
    await makeResult(input, defines, watch, onResult);
    return 0;
  } catch (e) {
    console.error(e);
    console.error('Unknown fatal error');
    return 1;
  }
}
