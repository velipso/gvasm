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
import { Watcher } from './watcher.ts';
export type { IMakeResult };

export interface IMakeArgs {
  input: string;
  output: string;
  defines: ILexKeyValue[];
  watch: boolean;
  execute: string | false;
}

export async function makeFromFile(
  input: string,
  defines: ILexKeyValue[],
  watch: boolean,
  cwd: string,
  path: Path,
  output: (result: IMakeResult) => Promise<void>,
  invalidated: (count: number) => void,
  fileType: (filename: string) => Promise<sink.fstype>,
  readTextFile: (filename: string) => Promise<string>,
  readBinaryFile: (filename: string) => Promise<Uint8Array>,
  watchFileChanges: (filenames: Set<string>) => Promise<Set<string> | false>,
  log: (str: string) => void,
): Promise<void> {
  const mainFullFile = path.isAbsolute(input) ? input : path.resolve(cwd, input);

  const proj = new Project(
    mainFullFile,
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
      invalidated(proj.invalidate(changes));
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
  invalidated: (count: number) => void = () => {},
): Promise<void> {
  const cwd = Deno.cwd();
  const path = new Path();
  const watcher = new Watcher();
  await makeFromFile(
    input,
    defines,
    watch,
    cwd,
    path,
    output,
    invalidated,
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
    async (filenames: Set<string>): Promise<Set<string>> => {
      console.log(
        `${timestamp()} Watching ${filenames.size} file${filenames.size === 1 ? '' : 's'}`,
      );
      watcher.watch(filenames);
      const changed = await watcher.wait();
      const ch = Array.from(changed);
      ch.sort((a, b) => a.localeCompare(b));
      console.log(
        `${timestamp()} Detected changes:\n  ${ch.map((f) => path.relative(cwd, f)).join('\n  ')}`,
      );
      return changed;
    },
    (str) => console.log(str),
  );
}

export async function make({ input, output, defines, watch, execute }: IMakeArgs): Promise<number> {
  try {
    const ts = () => watch ? `${timestamp()} ` : '';
    const onResult = async (result: IMakeResult) => {
      if ('errors' in result) {
        console.error(`${ts()}Error${result.errors.length === 1 ? '' : 's'}:`);
        for (const e of result.errors) {
          console.error(`  ${e}`);
        }
      } else {
        const file = await Deno.open(output, { write: true, create: true, truncate: true });
        for (const section of result.sections) {
          await file.write(section);
        }
        file.close();
        console.log(`${ts()}Success! Output: ${output}`);
        if (execute) {
          const cmd = execute.split(' ').map((a) => a === '{}' ? output : a);
          console.log(`${ts()}Running: ${cmd.join(' ')}`);
          Deno.run({ cmd });
        }
      }
    };
    const onInvalidated = (count: number) => {
      if (count > 0) {
        console.log(`${ts()}Invalidated ${count} file${count === 1 ? '' : 's'}`);
      }
    };
    await makeResult(input, defines, watch, onResult, onInvalidated);
    return 0;
  } catch (e) {
    console.error(e);
    console.error('Unknown fatal error');
    return 1;
  }
}
