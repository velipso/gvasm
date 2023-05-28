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
    makeTime: number;
  }
  | { errors: string[]; makeTime: number };

export interface IBase {
  addr: number;
  relativeTo: number;
}

export interface IMemory {
  iwram: number;
  ewram: number;
}

interface IFileCache {
  flp: IFilePos | false;
  used: boolean;
  imp?: Import;
  blob?: Uint8Array;
  importReplay: boolean;
  imports: { flp: IFilePos; fullFile: string }[];
  scriptParents: Set<string>;
  scriptEmbed: Set<string>;
}

export class Project {
  private fileCache = new Map<string, IFileCache>();
  private usedFilenames = new Set<string>();
  private failedImports: CompError[] = [];
  private parentIncludes = new Map<string, Set<string>>();
  private mainFullFile: string;
  private defines: ILexKeyValue[];
  private cwd: string;
  private path: Path;
  private fileType: (filename: string) => Promise<sink.fstype>;
  private readTextFile: (filename: string) => Promise<string>;
  private readBinaryFile: (filename: string) => Promise<Uint8Array>;
  private log: (str: string) => void;

  constructor(
    mainFullFile: string,
    defines: ILexKeyValue[],
    cwd: string,
    path: Path,
    fileType: (filename: string) => Promise<sink.fstype>,
    readTextFile: (filename: string) => Promise<string>,
    readBinaryFile: (filename: string) => Promise<Uint8Array>,
    log: (str: string) => void,
  ) {
    this.mainFullFile = mainFullFile;
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

  readFileCacheImport(
    filename: string,
    failNotFound: boolean,
    fromFilename: string | false,
  ): Import | false {
    const file = this.fileCache.get(filename);
    if (file && file.imp) {
      if (fromFilename) {
        file.scriptParents.add(fromFilename);
      }
      file.used = true;
      return file.imp;
    }
    if (failNotFound) {
      throw new CompError(file?.flp ?? false, `Failed to import file: ${filename}`);
    }
    return false;
  }

  resolveFile(filename: string, fromFilename: string) {
    if (this.path.isAbsolute(filename)) {
      return filename;
    }
    return this.path.resolve(this.path.dirname(fromFilename), filename);
  }

  private getOrCreateFileCache(flp: IFilePos | false, fullFile: string): IFileCache {
    const file = this.fileCache.get(fullFile) ?? {
      flp,
      used: true,
      importReplay: false,
      imports: [],
      scriptParents: new Set(),
      scriptEmbed: new Set(),
    };
    this.fileCache.set(fullFile, file);
    file.used = true;
    return file;
  }

  async import(flp: IFilePos | false, fullFile: string): Promise<CompError | Import> {
    this.usedFilenames.add(fullFile);

    if (flp) {
      const fromFile = this.fileCache.get(flp.filename);
      if (
        fromFile &&
        !fromFile.importReplay &&
        !fromFile.imports.some((f) => f.fullFile === fullFile)
      ) {
        fromFile.imports.push({ flp, fullFile });
      }
    }

    const file = this.getOrCreateFileCache(flp, fullFile);
    if (file.importReplay) {
      file.importReplay = false;
      for (const transImp of file.imports) {
        await this.import(transImp.flp, transImp.fullFile);
      }
    }
    if (file.imp) {
      return file.imp;
    }

    // check failed imports
    const alreadyFailed = this.failedImports.find(({ errors }) =>
      errors.some(({ flp }) => flp && flp.filename === fullFile)
    );
    if (alreadyFailed) {
      return alreadyFailed;
    }

    try {
      const txt = await this.readTextFile(fullFile).catch(() => {
        // swallow i/o errors
        throw false;
      });
      const tks = lex(fullFile, txt);
      file.imp = new Import(this, fullFile, this.mainFullFile === fullFile);
      const defFlp = { filename: fullFile, line: 1, chr: 1 };
      for (const d of this.defines) {
        if (typeof d.value === 'number') {
          file.imp.addSymNum(defFlp, d.key, d.value);
        } else {
          file.imp.scriptExport(defFlp, d.key, sink.pickle_binstr(d.value));
        }
      }
      await parse(file.imp, tks);
      return file.imp;
    } catch (e) {
      delete file.imp;
      const err = CompError.extend(e, flp, `Failed to import file: ${fullFile}`);
      this.failedImports.push(err);
      return err;
    }
  }

  async embed(
    flp: IFilePos | false,
    fullFile: string,
    fromScript: string | false,
  ): Promise<Uint8Array | false> {
    this.usedFilenames.add(fullFile);
    const file = this.getOrCreateFileCache(flp, fullFile);
    if (fromScript) {
      this.fileCache.get(fromScript)?.scriptEmbed.add(fullFile);
      file.scriptParents.add(fromScript);
    }
    try {
      if (!file.blob) {
        file.blob = await this.readBinaryFile(fullFile);
      }
      return file.blob;
    } catch (_) {
      return false;
    }
  }

  async make(): Promise<IMakeResult> {
    const startTime = Date.now();
    try {
      for (const file of this.fileCache.values()) {
        // mark all files as unused
        file.used = false;
        // since the file is cached, replay imports
        file.importReplay = true;
        file.imp?.makeStart();
      }

      // generate the sections
      this.usedFilenames = new Set([this.mainFullFile]);
      this.failedImports = [];
      this.parentIncludes = new Map();
      const sections = await this.include(
        false,
        this.mainFullFile,
        { addr: 0x08000000, relativeTo: 0 },
        { iwram: 0x03000000, ewram: 0x02000000 },
        0,
      );

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

      // propagate script embed
      const used = new Set<string>();
      const addUsed = (filename: string) => {
        if (used.has(filename)) {
          return;
        }
        used.add(filename);
        const file = this.fileCache.get(filename);
        if (file) {
          for (const se of file.scriptEmbed) {
            addUsed(se);
          }
        }
      };
      for (const [filename, file] of this.fileCache.entries()) {
        if (file.used) {
          addUsed(filename);
        }
      }

      // finalize
      const unused = new Set<string>();
      let debug: IDebugStatement[] = [];
      for (const [filename, file] of this.fileCache.entries()) {
        if (!used.has(filename)) {
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

      // if we have any failed imports that aren't actually used, then we should still error on them
      if (this.failedImports.length > 0) {
        return {
          errors: this.failedImports.map((e) => {
            e.mapFilenames((filename) => this.path.relative(this.cwd, filename));
            return e.toErrors();
          }).flat(),
          makeTime: Date.now() - startTime,
        };
      }

      const mainImp = this.fileCache.get(this.mainFullFile)?.imp;
      const base = mainImp?.firstWrittenBase ?? -1;
      const arm = mainImp?.firstWrittenARM ?? true;
      return {
        sections,
        base: base < 0 ? 0x08000000 : base,
        arm,
        debug,
        makeTime: Date.now() - startTime,
      };
    } catch (e) {
      if (e instanceof CompError) {
        e.mapFilenames((filename) => this.path.relative(this.cwd, filename));
        return { errors: e.toErrors(), makeTime: Date.now() - startTime };
      }
      throw e;
    }
  }

  async include(
    flp: IFilePos | false,
    fullFile: string,
    base: IBase,
    memory: IMemory,
    startLength: number,
  ): Promise<Uint8Array[]> {
    if (flp) {
      // check for circular includes
      let parents = this.parentIncludes.get(fullFile);
      if (!parents) {
        parents = new Set();
        this.parentIncludes.set(fullFile, parents);
      }
      parents.add(flp.filename);
      const seen = new Set<string>();
      const queue = [fullFile];
      while (true) {
        const s = queue.shift();
        if (!s) {
          break;
        }
        if (seen.has(s)) {
          throw new CompError(flp, `Cannot have circular include: ${fullFile}`);
        }
        seen.add(s);
        const parents = this.parentIncludes.get(s);
        if (parents) {
          for (const p of parents) {
            queue.push(p);
          }
        }
      }
    }

    const imp = await this.import(flp, fullFile);
    if (imp instanceof CompError) {
      throw imp;
    }
    return await imp.flatten(base, memory, startLength);
  }

  filenames(): Set<string> {
    return this.usedFilenames;
  }

  invalidate(filenames: Set<string>) {
    let total = 0;
    for (const filename of filenames) {
      const file = this.fileCache.get(filename);
      if (file) {
        total++;
        this.fileCache.delete(filename);
        total += this.invalidate(file.scriptParents);
      }
    }
    return total;
  }

  async runScript(flp: IFilePos, imp: Import, body: string): Promise<ITok[]> {
    const { filename, line: startLine } = flp;
    const resolvedStartFile = this.path.resolve(filename);
    const rootDir = this.path.dirname(this.mainFullFile);
    const startFile = this.path.relative(rootDir, resolvedStartFile);
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
          const data = await this.embed(flp, file, filename);
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
      rootDir,
      this.path.posix,
      false,
    );
    sink.scr_addpath(scr, '.');
    loadLibIntoScript(scr);

    if (!await sink.scr_loadfile(scr, startFile)) {
      const sinkErr = sink.scr_geterr(scr);
      if (sinkErr) {
        throw new CompError(flp, sinkErr.replace(/^Error: /, ''));
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
          false,
          imp.fullFile,
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
            const n = lk.body.value(lk.context, false, imp.fullFile);
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
        put.push({
          ...sink.ctx_source(ctx),
          kind: 'closure',
          closure: () => {
            imp.scriptExport(sink.ctx_source(ctx), name, data);
          },
        });
      },
    });

    const put: ITok[] = [];
    loadLibIntoContext(ctx, put, imp);

    const run = await sink.ctx_run(ctx);
    if (run !== sink.run.PASS) {
      const sinkErr = sink.ctx_geterr(ctx);
      if (sinkErr) {
        throw new CompError(flp, sinkErr);
      }
      throw new CompError(flp, 'Failed to run script');
    }
    return put;
  }
}
