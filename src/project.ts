//
// gvasm - Assembler and disassembler for Game Boy Advance homebrew
// by Sean Connelly (@velipso), https://sean.cm
// Project Home: https://github.com/velipso/gvasm
// SPDX-License-Identifier: 0BSD
//

import { ILexKeyValue, lex } from './lexer.ts';
import { CompError, parse } from './parser.ts';
import { Import } from './import.ts';
import * as sink from './sink.ts';
import { Path } from './deps.ts';

export type IMakeResult =
  | {
    sections: readonly Uint8Array[];
    /*
    TODO:
      base: number;
      arm: boolean;
      debug: IDebugStatement[]
    */
  }
  | { errors: string[] };

export interface IFileState {
  base: {
    addr: number;
    relativeTo: number;
  };
}

interface IFileCache {
  used: boolean;
  imp?: Import;
  blob?: Uint8Array;
}

export class Project {
  private fileCache = new Map<string, IFileCache>();
  private usedFilenames = new Set<string>();
  private mainFilename: string;
  private defines: ILexKeyValue[];
  private cwd: string;
  private path: Path;
  private fileType: (filename: string) => Promise<sink.fstype>;
  private readTextFile: (filename: string) => Promise<string>;
  private readBinaryFile: (filename: string) => Promise<Uint8Array>;
  private log: (str: string) => void;

  constructor(
    mainFilename: string,
    defines: ILexKeyValue[],
    cwd: string,
    path: Path,
    fileType: (filename: string) => Promise<sink.fstype>,
    readTextFile: (filename: string) => Promise<string>,
    readBinaryFile: (filename: string) => Promise<Uint8Array>,
    log: (str: string) => void,
  ) {
    this.mainFilename = mainFilename;
    this.defines = defines;
    this.cwd = cwd;
    this.path = path;
    this.fileType = fileType;
    this.readTextFile = readTextFile;
    this.readBinaryFile = readBinaryFile;
    this.log = log;
  }

  getLog() {
    return this.log;
  }

  readFileCacheImport(filename: string): Import | false {
    const file = this.fileCache.get(filename);
    if (file && file.imp) {
      file.used = true;
      return file.imp;
    }
    return false;
  }

  resolveFile(filename: string, fromFilename: string) {
    if (this.path.isAbsolute(filename)) return filename;
    return this.path.resolve(this.path.dirname(fromFilename), filename);
  }

  async import(filename: string): Promise<Import> {
    this.usedFilenames.add(filename);
    const file = this.fileCache.get(filename);
    if (file && file.imp) {
      file.used = true;
      return file.imp;
    }
    const txt = await this.readTextFile(filename);
    const tks = await lex(filename, txt);
    const imp = await parse(this, filename, this.mainFilename === filename, this.defines, tks);
    if (file) {
      file.used = true;
      file.imp = imp;
    } else {
      this.fileCache.set(filename, { used: true, imp });
    }
    return imp;
  }

  async embed(filename: string): Promise<Uint8Array> {
    this.usedFilenames.add(filename);
    const file = this.fileCache.get(filename);
    if (file && file.blob) {
      file.used = true;
      return file.blob;
    }
    const blob = await this.readBinaryFile(filename);
    if (file) {
      file.used = true;
      file.blob = blob;
    } else {
      this.fileCache.set(filename, { used: true, blob });
    }
    return blob;
  }

  async make(): Promise<IMakeResult> {
    try {
      // mark all files as unused
      for (const file of this.fileCache.values()) {
        file.used = false;
        file.imp?.makeStart();
      }

      // generate the sections
      this.usedFilenames = new Set([this.mainFilename]);
      const sections = await this.include(this.mainFilename, {
        base: {
          addr: 0x08000000,
          relativeTo: 0,
        },
      }, 0);

      // calculate CRC
      let crc: number | false = -0x19;
      for (let i = 0xa0; i < 0xbd; i++) {
        let offset = 0;
        let v = -1;
        for (const sect of sections) {
          if (i - offset < sect.length) {
            v = sect[i - offset];
            break;
          }
          offset += sect.length;
        }
        if (v < 0) {
          crc = false;
          break;
        }
        crc -= v;
      }
      if (crc !== false) crc = crc & 0xff;

      // finalize
      const unused = new Set<string>();
      for (const [filename, file] of this.fileCache.entries()) {
        if (file.used) {
          file.imp?.makeEnd(crc);
        } else {
          unused.add(filename);
        }
      }

      // remove unused files
      for (const filename of unused.values()) {
        this.fileCache.delete(filename);
      }

      this.usedFilenames = new Set(this.fileCache.keys());

      return { sections };
    } catch (e) {
      if (e instanceof CompError) {
        if (e.filename) e.filename = this.path.relative(this.cwd, e.filename);
        return { errors: [e.toString()] };
      }
      throw e;
    }
  }

  async include(filename: string, state: IFileState, startLength: number): Promise<Uint8Array[]> {
    return await (await this.import(filename)).flatten(state, startLength);
  }

  filenames(): string[] {
    return Array.from(this.usedFilenames);
  }

  invalidate(filenames: string[]) {
    for (const filename of filenames) this.fileCache.delete(filename);
  }
}
