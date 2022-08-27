//
// gvasm - Assembler and disassembler for Game Boy Advance homebrew
// by Sean Connelly (@velipso), https://sean.cm
// Project Home: https://github.com/velipso/gvasm
// SPDX-License-Identifier: 0BSD
//

import { lex } from './lexer.ts';
import { CompError, parse, ParsedFile } from './parser.ts';
import * as sink from './sink.ts';
import { pathDirname, pathRelative, pathResolve } from './deps.ts';

export type IMakeResult =
  | {
    sections: readonly (readonly number[])[];
    /*
    TODO:
      base: number;
      arm: boolean;
      debug: IDebugStatement[]
    */
  }
  | { errors: string[] };

type Mode = 'none' | 'arm' | 'thumb';

export interface IFileState {
  base: {
    addr: number;
    relativeTo: number;
  };
}

interface IImportCache {
  used: boolean;
  pf: ParsedFile;
}

export class Project {
  private defines: { key: string; value: number }[];
  private cwd: string;
  private posix: boolean;
  private isAbsolute: (filename: string) => boolean;
  private fileType: (filename: string) => Promise<sink.fstype>;
  private readTextFile: (filename: string) => Promise<string>;
  private readBinaryFile: (filename: string) => Promise<number[] | Uint8Array>;
  private log: (str: string) => void;
  private importCache = new Map<string, IImportCache>();
  private mainFilename: string;
  private lastFilenames = new Set<string>();

  constructor(
    mainFilename: string,
    defines: { key: string; value: number }[],
    cwd: string,
    posix: boolean,
    isAbsolute: (filename: string) => boolean,
    fileType: (filename: string) => Promise<sink.fstype>,
    readTextFile: (filename: string) => Promise<string>,
    readBinaryFile: (filename: string) => Promise<number[] | Uint8Array>,
    log: (str: string) => void,
  ) {
    this.mainFilename = mainFilename;
    this.defines = defines;
    this.cwd = cwd;
    this.posix = posix;
    this.isAbsolute = isAbsolute;
    this.fileType = fileType;
    this.readTextFile = readTextFile;
    this.readBinaryFile = readBinaryFile;
    this.log = log;
  }

  readCache(filename: string): ParsedFile | false {
    const imp = this.importCache.get(filename);
    if (imp) {
      imp.used = true;
      return imp.pf;
    }
    return false;
  }

  resolveFile(filename: string, fromFilename: string) {
    if (this.isAbsolute(filename)) return filename;
    return pathResolve(this.posix, pathDirname(this.posix, fromFilename), filename);
  }

  async import(filename: string): Promise<ParsedFile> {
    this.lastFilenames.add(filename);
    const imp = this.importCache.get(filename);
    if (imp) {
      imp.used = true;
      return imp.pf;
    }
    const tx = await this.readTextFile(filename);
    const tk = await lex(filename, tx);
    const pf = await parse(this, filename, this.defines, tk);
    this.importCache.set(filename, { used: true, pf });
    return pf;
  }

  isMain(filename: string): boolean {
    return this.mainFilename === filename;
  }

  async make(): Promise<IMakeResult> {
    try {
      // mark all files as unused
      for (const imp of this.importCache.values()) {
        imp.used = false;
        imp.pf.makeStart();
      }

      // generate the sections
      this.lastFilenames = new Set([this.mainFilename]);
      const sections = await this.include(this.mainFilename, {
        base: {
          addr: 0x08000000,
          relativeTo: 0,
        },
      }, 0);

      // finalize
      const unused = new Set<string>();
      for (const [filename, imp] of this.importCache.entries()) {
        if (imp.used) {
          imp.pf.makeEnd();
        } else {
          unused.add(filename);
        }
      }

      // remove unused files
      for (const filename of unused.values()) {
        this.importCache.delete(filename);
      }

      this.lastFilenames = new Set(this.importCache.keys());

      return { sections };
    } catch (e) {
      if (e instanceof CompError) {
        if (e.filename) e.filename = pathRelative(this.posix, this.cwd, e.filename);
        return { errors: [e.toString()] };
      }
      throw e;
    }
  }

  async include(filename: string, state: IFileState, startLength: number): Promise<number[][]> {
    return await (await this.import(filename)).flatten(state, startLength);
  }

  filenames(): string[] {
    return Array.from(this.lastFilenames);
  }

  invalidate(filenames: string[]) {
    for (const filename of filenames) this.importCache.delete(filename);
  }
}
