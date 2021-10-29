//
// gvasm - Assembler and disassembler for Game Boy Advance homebrew
// by Sean Connelly (@velipso), https://sean.cm
// The Unlicense License
// Project Home: https://github.com/velipso/gvasm
//

export * as path from 'https://deno.land/std@0.106.0/path/mod.ts';
export { parse as argParse } from 'https://deno.land/std@0.106.0/flags/mod.ts';
export { exists as fileExists } from 'https://deno.land/std@0.106.0/fs/exists.ts';

import * as canvas from 'https://raw.githubusercontent.com/DjDeveloperr/deno-canvas/f6fc1f5a73dc77b991ff035ef1f7627008c6b51c/mod.ts';

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
