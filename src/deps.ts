//
// gvasm - Assembler and disassembler for Game Boy Advance homebrew
// by Sean Connelly (@velipso), https://sean.cm
// Project Home: https://github.com/velipso/gvasm
// SPDX-License-Identifier: 0BSD
//

import * as canvas from 'https://raw.githubusercontent.com/DjDeveloperr/deno-canvas/f6fc1f5a73dc77b991ff035ef1f7627008c6b51c/mod.ts';
import * as path from 'https://deno.land/std@0.182.0/path/mod.ts';
export { parse as argParse } from 'https://deno.land/std@0.182.0/flags/mod.ts';
export { exists as fileExists } from 'https://deno.land/std@0.182.0/fs/exists.ts';

export interface Image {
  width: number;
  height: number;
  data: Uint8Array;
}

export async function loadImage(bytes: Uint8Array): Promise<Image | null> {
  const img = await canvas.loadImage(bytes);
  if (!img) {
    return null;
  }
  const info = img.getImageInfo();
  const data = img.readPixels(0, 0, {
    ...info,
    colorSpace: img.getColorSpace(),
  });
  if (data instanceof Uint8Array) {
    return {
      width: info.width,
      height: info.height,
      data,
    };
  }
  return null;
}

export class Path {
  posix: boolean;

  constructor(posix: boolean = Path.isNativePosix()) {
    this.posix = posix;
  }

  static isNativePosix() {
    return path.sep === '/';
  }

  isAbsolute(file: string): boolean {
    return this.posix ? path.posix.isAbsolute(file) : path.win32.isAbsolute(file);
  }

  join(...paths: string[]): string {
    return this.posix ? path.posix.join(...paths) : path.win32.join(...paths);
  }

  dirname(file: string): string {
    return this.posix ? path.posix.dirname(file) : path.win32.dirname(file);
  }

  basename(file: string): string {
    return this.posix ? path.posix.basename(file) : path.win32.basename(file);
  }

  resolve(...paths: string[]): string {
    return this.posix ? path.posix.resolve(...paths) : path.win32.resolve(...paths);
  }

  relative(from: string, to: string): string {
    // TODO: this implicitly uses Deno.cwd(), which seems odd... replace eventually
    return this.posix ? path.posix.relative(from, to) : path.win32.relative(from, to);
  }

  replaceExt(filename: string, ext: string): string {
    return this.posix
      ? path.posix.format({ ...path.posix.parse(filename), base: undefined, ext })
      : path.win32.format({ ...path.win32.parse(filename), base: undefined, ext });
  }
}
