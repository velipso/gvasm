//
// gvasm - Assembler and disassembler for Game Boy Advance homebrew
// by Sean Connelly (@velipso), https://sean.fun
// Project Home: https://github.com/velipso/gvasm
// SPDX-License-Identifier: 0BSD
//

import { load as basicLoad } from './itests/basic.ts';
import { load as exprLoad } from './itests/expr.ts';
import { load as filesLoad } from './itests/files.ts';
import { load as armLoad } from './itests/arm.ts';
import { load as thumbLoad } from './itests/thumb.ts';
import { load as poolLoad } from './itests/pool.ts';
import { load as constLoad } from './itests/const.ts';
import { load as scopeLoad } from './itests/scope.ts';
import { load as printfLoad } from './itests/printf.ts';
import { load as ifLoad } from './itests/if.ts';
import { load as structLoad } from './itests/struct.ts';
import { load as scriptLoad } from './itests/script.ts';
import { load as sinkLoad } from './itests/sink.ts';
import { load as stdlibLoad } from './itests/stdlib.ts';
import { load as regsLoad } from './itests/regs.ts';
import { load as runLoad } from './itests/run.ts';
import { load as watchLoad } from './itests/watch.ts';
import { load as memoryLoad } from './itests/memory.ts';
import { IMakeResult, makeFromFile } from './make.ts';
import { runResult } from './run.ts';
import * as sink from './sink.ts';
import { assertNever, waitForever } from './util.ts';
import { Path } from './deps.ts';

export interface IItestArgs {
  filters: string[];
}

interface ITestMake {
  name: string;
  desc: string;
  kind: 'make';
  error?: true;
  skipBytes?: true;
  stdout?: string[];
  rawInclude?: true;
  files: { [filename: string]: string };
}

interface ITestWatch {
  name: string;
  desc: string;
  kind: 'watch';
  logBytes?: true;
  stdout: string[];
  rawInclude?: true;
  history: [
    { [filename: string]: string },
    ...{ [filename: string]: string | false }[],
  ];
}

interface ITestRun {
  name: string;
  desc: string;
  kind: 'run';
  stdout: string[];
  files: { [filename: string]: string };
}

interface ITestSink {
  name: string;
  kind: 'sink';
  stdout?: string;
  files: { [fiename: string]: string };
}

export type ITest =
  | ITestMake
  | ITestWatch
  | ITestRun
  | ITestSink;

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

function hex(n: number) {
  return `${n < 16 ? '0' : ''}${n.toString(16)}`;
}

async function itestMake(test: ITestMake): Promise<boolean> {
  const stdout: string[] = [];
  let res: IMakeResult | undefined;
  await makeFromFile(
    '/root/main',
    [{ key: 'DEFINED123', value: 123 }, { key: 'DEFINEDXYZ', value: 'XYZ' }],
    false,
    '/',
    new Path(true),
    async (result: IMakeResult) => {
      res = result;
    },
    () => {},
    async (filename) => {
      if (filename in test.files) {
        return sink.fstype.FILE;
      } else if (
        Object.keys(test.files).some((f) => f.startsWith(`${filename}/`))
      ) {
        return sink.fstype.DIR;
      }
      return sink.fstype.NONE;
    },
    async (filename) => {
      if (filename in test.files) {
        return test.files[filename];
      } else {
        throw new Error(`Not found: ${filename}`);
      }
    },
    async (filename) => {
      if (filename in test.files) {
        if (test.rawInclude) {
          return new TextEncoder().encode(test.files[filename]);
        } else {
          return extractBytes(test.files[filename]);
        }
      } else {
        throw new Error(`Not found: ${filename}`);
      }
    },
    waitForever,
    (str) => stdout.push(str),
  );
  if (!res) {
    throw new Error('No result?');
  }
  if ('errors' in res) {
    if (test.error) {
      return true;
    }
    console.error('');
    for (const err of res.errors) {
      console.error(err);
    }
    return false;
  }

  if (test.error) {
    console.error(`\nExpecting error in test, but no error was reported`);
    return false;
  }

  const testStdout = test.stdout ?? [];
  for (let i = 0; i < Math.max(testStdout.length, stdout.length); i++) {
    const exp = testStdout[i];
    const got = stdout[i];
    if (exp !== got) {
      console.error(`\nStdout doesn't match as expected on line ${i + 1}`);
      console.error(`  expected: ${JSON.stringify(exp)}`);
      console.error(`  got:      ${JSON.stringify(got)}`);
      return false;
    }
  }

  if (test.skipBytes) {
    return true;
  }

  const actual = new Uint8Array(res.sections.map((b) => Array.from(b)).flat());
  const expected = extractBytes(test.files['/root/main']);
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

async function itestWatch(test: ITestWatch): Promise<boolean> {
  const stdout: string[] = [];
  let historyIndex = 0;
  const files = { ...test.history[0] };

  await makeFromFile(
    '/root/main',
    [{ key: 'DEFINED123', value: 123 }, { key: 'DEFINEDXYZ', value: 'XYZ' }],
    true,
    '/',
    new Path(true),
    async (result: IMakeResult) => {
      if ('sections' in result) {
        let bytes: number[] = [];
        for (const sect of result.sections) {
          bytes = bytes.concat(Array.from(sect));
        }
        if (test.logBytes) {
          if (bytes.length <= 0) {
            stdout.push('> empty');
          } else {
            for (let i = 0; i < bytes.length; i++) {
              if ((i % 8) === 0) {
                stdout.push('>');
              }
              stdout[stdout.length - 1] += ` ${hex(bytes[i])}`;
            }
          }
        } else {
          stdout.push(`# ${bytes.length} byte${bytes.length === 1 ? '' : 's'}`);
        }
      } else if ('errors' in result) {
        for (const err of result.errors) {
          stdout.push(`! ${err}`);
        }
      }
    },
    () => {},
    async (filename) => {
      if (filename in files) {
        return sink.fstype.FILE;
      } else if (
        Object.keys(files).some((f) => f.startsWith(`${filename}/`))
      ) {
        return sink.fstype.DIR;
      }
      return sink.fstype.NONE;
    },
    async (filename) => {
      if (filename in files) {
        stdout.push(`read: ${filename}`);
        return files[filename];
      } else {
        throw new Error(`Not found: ${filename}`);
      }
    },
    async (filename) => {
      if (filename in files) {
        stdout.push(`read: ${filename}`);
        if (test.rawInclude) {
          return new TextEncoder().encode(files[filename]);
        } else {
          return extractBytes(files[filename]);
        }
      } else {
        throw new Error(`Not found: ${filename}`);
      }
    },
    async (filenames: Set<string>): Promise<Set<string> | false> => {
      const filenamesList = Array.from(filenames);
      filenamesList.sort((a, b) => a.localeCompare(b));
      stdout.push(`watch: ${filenamesList.join(' ')}`);
      historyIndex++;
      if (historyIndex >= test.history.length) {
        return false;
      }
      const changed = new Set<string>();
      for (const [filename, body] of Object.entries(test.history[historyIndex])) {
        if (body === false) {
          delete files[filename];
        } else {
          files[filename] = body;
        }
        changed.add(filename);
      }
      return changed;
    },
    (str) => stdout.push(str),
  );

  for (let i = 0; i < Math.max(test.stdout.length, stdout.length); i++) {
    const exp = test.stdout[i];
    const got = stdout[i];
    if (exp !== got) {
      console.error(`\nStdout doesn't match as expected on line ${i + 1}`);
      console.error(`  expected: ${JSON.stringify(exp)}`);
      console.error(`  got:      ${JSON.stringify(got)}`);
      console.error(`Full stdout:\n  ${stdout.join('\n  ')}`);
      return false;
    }
  }
  return true;
}

async function itestRun(test: ITestRun): Promise<boolean> {
  const stdout: string[] = [];
  let res: IMakeResult | undefined;
  await makeFromFile(
    '/root/main',
    [{ key: 'DEFINED123', value: 123 }, { key: 'DEFINEDXYZ', value: 'XYZ' }],
    false,
    '/',
    new Path(true),
    async (result: IMakeResult) => {
      res = result;
    },
    () => {},
    async (filename) => {
      if (filename in test.files) {
        return sink.fstype.FILE;
      } else if (
        Object.keys(test.files).some((f) => f.startsWith(`${filename}/`))
      ) {
        return sink.fstype.DIR;
      }
      return sink.fstype.NONE;
    },
    async (filename) => {
      if (filename in test.files) {
        return test.files[filename];
      } else {
        throw new Error(`Not found: ${filename}`);
      }
    },
    async (filename) => {
      if (filename in test.files) {
        return extractBytes(test.files[filename]);
      } else {
        throw new Error(`Not found: ${filename}`);
      }
    },
    waitForever,
    () => {},
  );

  if (!res) {
    throw new Error('No result?');
  }

  if ('errors' in res) {
    console.error('');
    for (const err of res.errors) {
      console.error(err);
    }
    return false;
  }

  runResult(
    res.sections.map((a) => Array.from(a)).flat(),
    res.base,
    res.arm,
    res.debug,
    (str: string) => stdout.push(str),
  );

  for (let i = 0; i < Math.max(test.stdout.length, stdout.length); i++) {
    const exp = test.stdout[i];
    const got = stdout[i];
    if (exp !== got) {
      console.error(`\nStdout doesn't match as expected on line ${i + 1}`);
      console.error(`  expected: ${JSON.stringify(exp)}`);
      console.error(`  got:      ${JSON.stringify(got)}`);
      return false;
    }
  }

  return true;
}

async function itestSink(test: ITestSink): Promise<boolean> {
  const scr = sink.scr_new(
    {
      f_fstype: async (_scr: sink.scr, file: string) => {
        if (file in test.files) {
          return sink.fstype.FILE;
        } else if (
          Object.keys(test.files).some((f) => f.startsWith(`${file}/`))
        ) {
          return sink.fstype.DIR;
        }
        return sink.fstype.NONE;
      },
      f_fsread: async (_scr: sink.scr, file: string) => {
        const data = test.files[file];
        if (typeof data === 'undefined') {
          return false;
        }
        await sink.scr_write(scr, data);
        return true;
      },
    },
    '/root',
    true,
    false,
  );
  sink.scr_addpath(scr, '.');
  sink.scr_autonative(scr, 'testnative');
  const res = await sink.scr_loadfile(scr, 'main.sink');
  const { stdout: correctStdout } = test;
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
      if (typeof correctStdout === 'undefined') {
        return true;
      }
      console.error(`\nFailed to run script: ${sink.ctx_geterr(ctx)}`);
      return false;
    }
    if (typeof correctStdout === 'undefined') {
      console.error('\nScript succeeded but expected it to fail');
      return false;
    }
    if (stdout === test.stdout) {
      return true;
    }
    let done = 0;
    stdout.split('\n').forEach((line, i) => {
      if (done >= 3) {
        return;
      }
      const correctLine = correctStdout.split('\n')[i];
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
    if (typeof correctStdout === 'undefined') {
      return true;
    }
    console.log(`\nFailed to load script: ${sink.scr_geterr(scr)}`);
    return false;
  }
}

export async function itest({ filters }: IItestArgs): Promise<number> {
  const tests: { index: number; test: ITest }[] = [];
  const def = (test: ITest) => {
    tests.push({
      index: tests.length,
      test,
    });
  };

  // load the tests
  basicLoad(def);
  exprLoad(def);
  filesLoad(def);
  armLoad(def);
  thumbLoad(def);
  poolLoad(def);
  constLoad(def);
  scopeLoad(def);
  printfLoad(def);
  ifLoad(def);
  structLoad(def);
  scriptLoad(def);
  sinkLoad(def);
  stdlibLoad(def);
  regsLoad(def);
  runLoad(def);
  watchLoad(def);
  memoryLoad(def);

  // execute the tests that match any filter
  const indexDigits = Math.ceil(Math.log10(tests.length));
  let passed = 0;
  let failed = 0;
  let skipped = 0;
  for (const test of tests) {
    const { index, test: { name } } = test;
    if (
      filters.length > 0 &&
      !filters.some((filter) => name.toLowerCase().indexOf(filter.toLowerCase()) >= 0)
    ) {
      // skip test
      skipped++;
      continue;
    }

    let indexStr = `${index}`;
    while (indexStr.length < indexDigits) {
      indexStr = `0${indexStr}`;
    }

    try {
      let pass;
      switch (test.test.kind) {
        case 'make':
          pass = await itestMake(test.test);
          break;
        case 'watch':
          pass = await itestWatch(test.test);
          break;
        case 'run':
          pass = await itestRun(test.test);
          break;
        case 'sink':
          pass = await itestSink(test.test);
          break;
        default:
          assertNever(test.test);
      }

      if (pass) {
        console.log(`pass     [${indexStr}] ${name}`);
        passed++;
      } else {
        console.log(`FAIL     [${indexStr}] ${name}\n`);
        failed++;
      }
    } catch (e) {
      console.error(e);
      console.log(`ERR      [${indexStr}] ${name}\n`);
      failed++;
    }
  }

  console.log(`-------------------------------
Skipped: ${skipped}
Passed:  ${passed}
Failed:  ${failed}
TOTAL:   ${skipped + passed + failed}

${failed > 0 ? 'FAILED!' : passed > 0 ? 'All good!' : 'No results'}`);
  return failed > 0 ? 1 : 0;
}
