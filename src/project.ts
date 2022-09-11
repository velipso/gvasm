//
// gvasm - Assembler and disassembler for Game Boy Advance homebrew
// by Sean Connelly (@velipso), https://sean.cm
// Project Home: https://github.com/velipso/gvasm
// SPDX-License-Identifier: 0BSD
//

import { IFilePos, ILexKeyValue, ITok, lex } from './lexer.ts';
import { CompError, parse } from './parser.ts';
import { IDebugStatement, Import } from './import.ts';
import { loadLibIntoContext, loadLibIntoScript } from './sinklib.ts';
import * as sink from './sink.ts';
import { Path } from './deps.ts';
import { assertNever } from './util.ts';

export type IMakeResult =
  | {
    sections: readonly Uint8Array[];
    base: number;
    arm: boolean;
    debug: IDebugStatement[];
  }
  | { errors: string[] };

export interface IBase {
  addr: number;
  relativeTo: number;
}

interface IFileCache {
  used: boolean;
  imp?: Import;
  blob?: Uint8Array;
  scriptParents: Set<string>;
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
    const tks = lex(filename, txt);
    const imp = await parse(this, filename, this.mainFilename === filename, this.defines, tks);
    if (file) {
      file.used = true;
      file.imp = imp;
    } else {
      this.fileCache.set(filename, { used: true, imp, scriptParents: new Set() });
    }
    return imp;
  }

  async scriptEmbed(fromFilename: string, filename: string): Promise<Uint8Array | false> {
    this.usedFilenames.add(filename);
    const file = this.fileCache.get(filename);
    if (file && file.blob) {
      file.used = true;
      file.scriptParents.add(fromFilename);
      return file.blob;
    }
    try {
      const blob = await this.readBinaryFile(filename);
      if (file) {
        file.used = true;
        file.blob = blob;
        file.scriptParents.add(fromFilename);
      } else {
        this.fileCache.set(filename, { used: true, blob, scriptParents: new Set([fromFilename]) });
      }
      return blob;
    } catch (_) {
      return false;
    }
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
      this.fileCache.set(filename, { used: true, blob, scriptParents: new Set() });
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
        addr: 0x08000000,
        relativeTo: 0,
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
      if (crc !== false) {
        crc = crc & 0xff;
      }

      // finalize
      const unused = new Set<string>();
      let debug: IDebugStatement[] = [];
      for (const [filename, file] of this.fileCache.entries()) {
        if (!file.used) {
          unused.add(filename);
        } else if (file.imp) {
          file.imp.makeEnd(crc);
          debug = debug.concat(file.imp.debugStatements);
        }
      }

      // remove unused files
      for (const filename of unused.values()) {
        this.fileCache.delete(filename);
      }

      this.usedFilenames = new Set(this.fileCache.keys());

      const mainImp = this.fileCache.get(this.mainFilename)?.imp;
      const base = mainImp?.firstWrittenBase ?? -1;
      const arm = mainImp?.firstWrittenARM ?? true;

      return {
        sections,
        base: base < 0 ? 0x08000000 : base,
        arm,
        debug,
      };
    } catch (e) {
      if (e instanceof CompError) {
        e.mapFilenames((filename) => this.path.relative(this.cwd, filename));
        return { errors: e.toErrors() };
      }
      throw e;
    }
  }

  async include(filename: string, base: IBase, startLength: number): Promise<Uint8Array[]> {
    return await (await this.import(filename)).flatten(base, startLength);
  }

  filenames(): string[] {
    return Array.from(this.usedFilenames);
  }

  invalidate(filenames: string[]) {
    for (const filename of filenames) {
      const file = this.fileCache.get(filename);
      if (file) {
        this.fileCache.delete(filename);
        this.invalidate(Array.from(file.scriptParents));
      }
    }
  }

  async runScript(flp: IFilePos, imp: Import, body: string): Promise<ITok[]> {
    const { filename, line: startLine } = flp;
    const resolvedStartFile = this.path.resolve(filename);
    const startFile = this.path.basename(filename);
    const scr = sink.scr_new(
      {
        f_fstype: async (_scr: sink.scr, file: string): Promise<sink.fstype> => {
          if (file === resolvedStartFile) {
            return sink.fstype.FILE;
          }
          return await this.fileType(file);
        },
        f_fsread: async (scr: sink.scr, file: string): Promise<boolean> => {
          if (file === resolvedStartFile) {
            await sink.scr_write(scr, body, startLine + 1);
            return true;
          }
          const data = await this.scriptEmbed(filename, file);
          if (data === false) {
            return false;
          }
          let text = '';
          for (const b of data) {
            text += String.fromCharCode(b);
          }
          await sink.scr_write(scr, text);
          return true;
        },
      },
      this.path.dirname(resolvedStartFile),
      this.path.posix,
      false,
    );
    sink.scr_addpath(scr, '.');
    loadLibIntoScript(scr);

    if (!await sink.scr_loadfile(scr, startFile)) {
      const sinkErr = sink.scr_geterr(scr);
      if (sinkErr) {
        throw new CompError(false, sinkErr);
      }
      throw new CompError(flp, 'Failed to run script');
    }

    const ctx = sink.ctx_new(scr, {
      f_say: async (_ctx, str) => {
        this.log(str);
        return sink.NIL;
      },
      f_warn: async () => sink.NIL,
      f_ask: async () => sink.NIL,
      f_xlookup: (ctx, path) => {
        // validate path
        if (!Array.isArray(path) || path.length <= 0) {
          sink.abort(ctx, ['Invalid lookup']);
          return sink.NIL;
        }
        for (let i = 0; i < path.length; i++) {
          if (typeof path[i] !== 'number' && typeof path[i] !== 'string') {
            sink.abort(ctx, [`Invalid lookup component: ${path[i]}`]);
            return sink.NIL;
          }
        }
        const pathError = () =>
          path.map((p) => typeof p === 'string' ? `.${p}` : '[]').join('').substr(1);
        const lk = imp.lookup(
          sink.ctx_source(ctx),
          imp.expressionContext(0),
          'allow',
          path as (string | number)[],
          ctx,
        );
        if (lk === 'notfound' || lk === false) {
          sink.abort(ctx, [`Cannot find symbol: ${pathError()}`]);
          return sink.NIL;
        }
        if (typeof lk === 'number') {
          return lk;
        }
        switch (lk.kind) {
          case 'const': {
            if (lk.body.paramSize >= 0) {
              sink.abort(ctx, ['Cannot lookup function in script']);
              return sink.NIL;
            }
            const n = lk.body.value(lk.context, 'allow');
            if (n === false) {
              sink.abort(ctx, ['Can\'t calculate value']);
              return sink.NIL;
            }
            return n;
          }
          case 'scriptExport':
            return sink.pickle_val(ctx, lk.data);
          case 'lookupData':
            if (lk.value === false) {
              sink.abort(ctx, ['Can\'t calculate value']);
              return sink.NIL;
            }
            return lk.value;
          default:
            return assertNever(lk);
        }
      },
      f_xexport: (ctx, name, data) => {
        imp.scriptExport(sink.ctx_source(ctx), name, data);
      },
    });

    const put: ITok[] = [];
    loadLibIntoContext(ctx, put, imp);

    const run = await sink.ctx_run(ctx);
    if (run !== sink.run.PASS) {
      const sinkErr = sink.ctx_geterr(ctx);
      if (sinkErr) {
        throw new CompError(false, sinkErr);
      }
      throw new CompError(flp, 'Failed to run script');
    }
    return put;
  }
}
