//
// gvasm - Assembler and disassembler for Game Boy Advance homebrew
// by Sean Connelly (@velipso), https://sean.cm
// Project Home: https://github.com/velipso/gvasm
// SPDX-License-Identifier: 0BSD
//

import { IMakeResult, makeFromFile } from './make.ts';
import * as sink from './sink.ts';
import { waitForever } from './util.ts';
import { Path } from './deps.ts';

export interface IRuntestArgs {
  file: string;
}

function hex(n: number) {
  return `${n < 16 ? '0' : ''}${n.toString(16)}`;
}

function extractBytes(data: string): Uint8Array {
  const bytes = data
    .split('\n')
    .map((line) => {
      const c = line.indexOf('///');
      if (c >= 0) {
        return ' ' + line.substr(c + 3).replace(/\s+/g, ' ').trim();
      } else {
        return '';
      }
    })
    .join('')
    .trim();
  return new Uint8Array(bytes === '' ? [] : bytes.split(' ').map((n) => parseInt(n, 16)));
}

async function testMake(
  file: string,
  expectStdout: string[],
  expectError: boolean,
  skipBytes: boolean,
): Promise<boolean> {
  const cwd = Deno.cwd();
  const path = new Path();
  const stdout: string[] = [];
  let res: IMakeResult | undefined;
  await makeFromFile(
    file,
    [{ key: 'DEFINED123', value: 123 }, { key: 'DEFINEDXYZ', value: 'XYZ' }],
    false,
    cwd,
    path,
    async (result: IMakeResult) => {
      res = result;
    },
    () => {},
    async (file: string) => {
      try {
        const st = await Deno.stat(file);
        if (st !== null) {
          if (st.isFile) {
            return sink.fstype.FILE;
          } else if (st.isDirectory) {
            return sink.fstype.DIR;
          }
        }
      } catch (_) {
        // result is NONE
      }
      return sink.fstype.NONE;
    },
    Deno.readTextFile,
    Deno.readFile,
    waitForever,
    (str) => {
      for (const line of str.split('\n')) {
        stdout.push(line.replace(path.join(cwd, file), path.basename(file)));
      }
    },
  );
  if (!res) {
    throw new Error('No result?');
  }
  if ('errors' in res) {
    if (expectError) {
      return true;
    }
    console.error('');
    for (const err of res.errors) {
      console.error(err);
    }
    return false;
  }

  if (expectError) {
    console.error(`\nExpecting error in test, but no error was reported`);
    return false;
  }

  for (let i = 0; i < Math.max(expectStdout.length, stdout.length); i++) {
    const exp = expectStdout[i];
    const got = stdout[i];
    if (exp !== got) {
      console.error(`\nStdout doesn't match as expected on line ${i + 1}`);
      console.error(`  expected: ${JSON.stringify(exp)}`);
      console.error(`  got:      ${JSON.stringify(got)}`);
      return false;
    }
  }

  if (skipBytes) {
    return true;
  }

  const actual = new Uint8Array(res.sections.map((b) => Array.from(b)).flat());
  const expected = extractBytes(await Deno.readTextFile(file));
  if (expected.length !== actual.length) {
    console.error(
      `\nExpected length is ${expected.length} bytes, but got ${actual.length} bytes`,
    );
    return false;
  }
  for (let i = 0; i < expected.length; i++) {
    if (expected[i] !== actual[i]) {
      console.error(`\nResult doesn't match expected:`);
      for (
        let s = Math.max(0, i - 5);
        s < Math.min(expected.length, i + 6);
        s++
      ) {
        if (actual[s] === expected[s]) {
          console.error(` result[${s}] = ${hex(actual[s])} // match`);
        } else {
          console.error(
            ` actual[${s}] = ${hex(actual[s])} // expected[${s}] = ${hex(expected[s])}`,
          );
        }
      }
      return false;
    }
  }
  return true;
}

async function testInit(): Promise<boolean> {
  console.error('TODO: implement testInit');
  return true;
}

async function testSink(
  file: string,
  expectStdout: string[],
  expectError: boolean,
): Promise<boolean> {
  const path = new Path();
  const scr = sink.scr_new(
    {
      f_fstype: async (_scr: sink.scr, file: string): Promise<sink.fstype> => {
        try {
          const st = await Deno.stat(file);
          if (st !== null) {
            if (st.isFile) {
              return sink.fstype.FILE;
            } else if (st.isDirectory) {
              return sink.fstype.DIR;
            }
          }
        } catch (_) {
          // result is NONE
        }
        return sink.fstype.NONE;
      },
      f_fsread: async (scr: sink.scr, file: string): Promise<boolean> => {
        try {
          const data = await Deno.readFile(file);
          let text = '';
          for (const b of data) {
            text += String.fromCharCode(b);
          }
          await sink.scr_write(scr, text);
          return true;
        } catch (_err) {
          return false;
        }
      },
    },
    path.dirname(file),
    path.posix,
    false,
  );
  sink.scr_addpath(scr, '.');
  sink.scr_autonative(scr, 'testnative');
  const res = await sink.scr_loadfile(scr, path.basename(file));
  if (res) {
    let stdout = '';
    const ctx = sink.ctx_new(scr, {
      f_say: async (_ctx: sink.ctx, str: sink.str) => {
        stdout += `${str}\n`;
        return sink.NIL;
      },
      f_warn: async () => sink.NIL,
      f_ask: async () => sink.NIL,
      f_xlookup: () => {
        throw new Error('lookup not supported in itests');
      },
      f_xexport: () => {
        throw new Error('export not supported in itests');
      },
    });
    sink.ctx_autonative(ctx, 'testnative', null, () => Promise.resolve('test'));
    const run = await sink.ctx_run(ctx);
    if (run !== sink.run.PASS) {
      if (expectError) {
        return true;
      }
      console.error(`\nFailed to run script: ${sink.ctx_geterr(ctx)}`);
      return false;
    }
    if (expectError) {
      console.error('\nScript succeeded but expected it to fail');
      return false;
    }
    if (stdout === expectStdout.join('\n')) {
      return true;
    }
    let done = 0;
    stdout.split('\n').forEach((line, i) => {
      if (done >= 3) {
        return;
      }
      const correctLine = expectStdout[i];
      if (correctLine !== line) {
        console.error(
          `\nLine ${
            i +
            1
          } mismatch:\n  expected:    ${correctLine}\n  instead got: ${line}`,
        );
        done++;
      }
    });
    return false;
  } else {
    if (expectError) {
      return true;
    }
    console.log(`\nFailed to load script: ${sink.scr_geterr(scr)}`);
    return false;
  }
}

export async function runtest({ file }: IRuntestArgs): Promise<number> {
  const lines = (await Deno.readTextFile(file)).trim().split('\n')
    .map((line) => line.trim()).filter((line) => line && !line.startsWith('#'));
  let name = '';
  let _desc = '';
  let kind = '';
  let error = false;
  let skipBytes = false;
  const stdout: string[] = [];
  for (const line of lines) {
    if (line.startsWith('$ ')) {
      stdout.push(line.substr(2));
    } else if (line === '$') {
      stdout.push('');
    } else if (line.startsWith('name: ')) {
      name = line.substr(6);
    } else if (line.startsWith('desc: ')) {
      _desc = line.substr(6);
    } else if (line.startsWith('kind: ')) {
      kind = line.substr(6);
    } else if (line === 'error: true') {
      error = true;
    } else if (line === 'skipBytes: true') {
      skipBytes = true;
    } else {
      console.error(`Cannot parse line:\n${line}`);
      return 1;
    }
  }
  if (!name) {
    console.error('Missing name');
    return 1;
  }
  if (!kind) {
    console.error('Missing kind');
    return 1;
  }
  let result = false;
  try {
    switch (kind) {
      case 'make':
        result = await testMake(file.replace(/\.txt$/, '.gvasm'), stdout, error, skipBytes);
        break;
      case 'init':
        result = await testInit();
        break;
      case 'sink':
        result = await testSink(file.replace(/\.txt$/, '.sink'), stdout, error);
        break;
      default:
        console.error(`Unknown kind: ${kind}`);
        return 1;
    }
  } catch (err) {
    console.error(err);
    result = false;
  }
  console.log(`${result ? 'pass' : 'FAIL'}   ${name}`);
  return result ? 0 : 1;
}
