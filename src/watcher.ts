//
// gvasm - Assembler and disassembler for Game Boy Advance homebrew
// by Sean Connelly (@velipso), https://sean.fun
// Project Home: https://github.com/velipso/gvasm
// SPDX-License-Identifier: 0BSD
//

import { setDifference, setIntersection, setUnion } from './util.ts';

interface IFsw {
  id: number;
  watcher: Deno.FsWatcher;
  files: Set<string>;
}

function fileExists(filename: string) {
  try {
    Deno.statSync(filename);
    return true;
  } catch (e) {
    if (e instanceof Deno.errors.NotFound) {
      return false;
    } else {
      throw e;
    }
  }
}

// Watcher should *constantly* watch for changes, and conservatively call Deno.watchFs(...).
export class Watcher {
  fsw: IFsw[] = [];
  watchFilenames = new Set<string>();
  firstChanged = -1;
  changed = new Set<string>();
  nextId = 0;

  private addChanged(filenames: Set<string>) {
    this.changed = setIntersection(this.watchFilenames, setUnion(this.changed, filenames));
    if (this.changed.size > 0 && this.firstChanged < 0) {
      this.firstChanged = Date.now();
    }
  }

  private resetChanged() {
    const res = this.changed;
    this.changed = new Set();
    this.firstChanged = -1;
    return res;
  }

  watch(filenames: Set<string>) {
    this.watchFilenames = filenames;
    this.changed = setIntersection(this.watchFilenames, this.changed);

    let files = new Set(filenames);
    for (let i = 0; i < this.fsw.length; i++) {
      const fsw = this.fsw[i];
      const u = setUnion(fsw.files, files);
      if (u.size <= 0) {
        // no overlap, so kill watcher
        fsw.watcher.close();
        this.fsw.splice(i, 1);
        i--;
        continue;
      }
      files = setDifference(files, fsw.files);
    }
    const watchedFiles = Array.from(files).filter(fileExists);
    if (watchedFiles.length <= 0) {
      return;
    }

    const watcher = Deno.watchFs(watchedFiles);
    const iter = watcher[Symbol.asyncIterator]();
    const id = this.nextId++;
    const next = async () => {
      while (true) {
        const { value, done } = await iter.next();
        if (done) {
          for (let i = 0; i < this.fsw.length; i++) {
            const fsw = this.fsw[i];
            if (fsw.id === id) {
              fsw.watcher.close();
              this.fsw.splice(i, 1);
              break;
            }
          }
          return;
        } else if (value.kind !== 'access') {
          this.addChanged(new Set(value.paths));
        }
      }
    };
    next();
    this.fsw.push({ id, watcher, files });
  }

  async wait(): Promise<Set<string>> {
    while (true) {
      await new Promise((resolve) => {
        setTimeout(resolve, 500);
      });
      if (this.firstChanged >= 0 && this.firstChanged + 3000 <= Date.now()) {
        return this.resetChanged();
      }
    }
  }
}
