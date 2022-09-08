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
  watchFileChanges: (filenames: string[]) => Promise<string[] | false>,
  log: (str: string) => void,
): Promise<void> {
  const mainFilename = path.isAbsolute(input) ? input : path.resolve(cwd, input);

  const proj = new Project(
    mainFilename,
    defines,
    cwd,
    path,
    fileType,
    readTextFile,
    readBinaryFile,
    log,
  );

  if (watch) {
    while (true) {
      await output(await proj.make());
      const changes = await watchFileChanges(proj.filenames());
      if (changes === false) {
        break;
      }
      proj.invalidate(changes);
    }
  } else {
    await output(await proj.make());
  }
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
