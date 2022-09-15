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
  execute: string | false;
}

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

export async function make({ input, output, defines, watch, execute }: IMakeArgs): Promise<number> {
  try {
    const onResult = async (result: IMakeResult) => {
      const ts = () => watch ? `${timestamp()} ` : '';
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
    await makeResult(input, defines, watch, onResult);
    return 0;
  } catch (e) {
    console.error(e);
    console.error('Unknown fatal error');
    return 1;
  }
}
