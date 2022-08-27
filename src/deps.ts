//
// gvasm - Assembler and disassembler for Game Boy Advance homebrew
// by Sean Connelly (@velipso), https://sean.cm
// Project Home: https://github.com/velipso/gvasm
// SPDX-License-Identifier: 0BSD
//

import * as canvas from 'https://raw.githubusercontent.com/DjDeveloperr/deno-canvas/f6fc1f5a73dc77b991ff035ef1f7627008c6b51c/mod.ts';
import * as path from 'https://deno.land/std@0.152.0/path/mod.ts';
export { path };
export { parse as argParse } from 'https://deno.land/std@0.144.0/flags/mod.ts';
export { exists as fileExists } from 'https://deno.land/std@0.152.0/fs/exists.ts';

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

export function pathJoin(posix: boolean, ...paths: string[]): string {
  return posix ? path.posix.join(...paths) : path.win32.join(...paths);
}

export function pathDirname(posix: boolean, file: string): string {
  return posix ? path.posix.dirname(file) : path.win32.dirname(file);
}

export function pathBasename(posix: boolean, file: string): string {
  return posix ? path.posix.basename(file) : path.win32.basename(file);
}

export function pathResolve(posix: boolean, ...paths: string[]): string {
  return posix ? path.posix.resolve(...paths) : path.win32.resolve(...paths);
}

export function pathRelative(posix: boolean, from: string, to: string): string {
  return posix ? path.posix.relative(from, to) : path.win32.resolve(from, to);
}
