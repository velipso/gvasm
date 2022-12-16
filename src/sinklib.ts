//
// gvasm - Assembler and disassembler for Game Boy Advance homebrew
// by Sean Connelly (@velipso), https://sean.cm
// Project Home: https://github.com/velipso/gvasm
// SPDX-License-Identifier: 0BSD
//
// deno-lint-ignore-file no-explicit-any

import * as sink from './sink.ts';
import { ITok, lex } from './lexer.ts';
import { dataTypeCreate, Import } from './import.ts';
import { loadImage } from './deps.ts';
import { loadAudio } from './audio.ts';
import { printf } from './util.ts';

export function loadLibIntoScript(scr: sink.scr) {
  sink.scr_autonative(scr, 'put');
  sink.scr_autonative(scr, 'image.load');
  sink.scr_autonative(scr, 'image.rgb');
  sink.scr_autonative(scr, 'audio.load');
  sink.scr_autonative(scr, 'error');
  sink.scr_autonative(scr, 'printf');
  sink.scr_autonative(scr, 'align');
  sink.scr_autonative(scr, 'json.load');
  sink.scr_autonative(scr, 'json.type');
  sink.scr_autonative(scr, 'json.boolean');
  sink.scr_autonative(scr, 'json.number');
  sink.scr_autonative(scr, 'json.string');
  sink.scr_autonative(scr, 'json.array');
  sink.scr_autonative(scr, 'json.object');
  sink.scr_autonative(scr, 'json.size');
  sink.scr_autonative(scr, 'json.get');
  sink.scr_autoenum(scr, [
    'json.NULL',
    'json.BOOLEAN',
    'json.NUMBER',
    'json.STRING',
    'json.ARRAY',
    'json.OBJECT',
  ]);
  for (let unsigned = 0; unsigned < 2; unsigned++) {
    for (let bigendian = 0; bigendian < 2; bigendian++) {
      for (let misaligned = 0; misaligned < 2; misaligned++) {
        for (const size of [8, 16, 32]) {
          const dataType = dataTypeCreate(!!unsigned, !!bigendian, !!misaligned, size);
          sink.scr_autonative(scr, dataType);
          sink.scr_autonative(scr, `${dataType}fill`);
        }
      }
    }
  }
}

export function loadLibIntoContext(ctx: sink.ctx, put: ITok[], imp: Import) {
  sink.ctx_autonative(ctx, 'put', null, async (ctx, args) => {
    const flp = sink.ctx_source(ctx);
    const out: string[] = [];
    for (const arg of args) {
      out.push(sink.tostr(arg));
    }
    const tks = lex(flp.filename, out.join(' '), flp.line);
    for (let i = 0; i < tks.length; i++) {
      put.push(tks[i]);
    }
    return sink.NIL;
  });
  sink.ctx_autonative(ctx, 'image.load', null, async (_ctx, args) => {
    if (args.length <= 0) {
      throw 'Expecting string or list for argument 1';
    }
    let data = args[0];
    if (typeof data === 'string') {
      data = data.split('').map((a) => a.charCodeAt(0)) as sink.list;
    }
    if (!Array.isArray(data)) {
      throw 'Expecting string or list for argument 1';
    }
    const img = await loadImage(new Uint8Array(data as number[])).catch(() => null);
    if (img === null) {
      throw 'Unknown image format';
    }
    if (
      img.width <= 0 || img.height <= 0 ||
      img.width * img.height * 4 !== img.data.length
    ) {
      throw 'Unsupported color format, please use RGBA';
    }
    const ret = new sink.list();
    for (let y = 0, k = 0; y < img.height; y++) {
      const row = new sink.list();
      ret.push(row);
      for (let x = 0; x < img.width; x++, k += 4) {
        row.push(
          new sink.list(
            img.data[k + 0],
            img.data[k + 1],
            img.data[k + 2],
            img.data[k + 3],
          ),
        );
      }
    }
    return ret;
  });
  sink.ctx_autonative(ctx, 'image.rgb', null, async (_ctx, args) => {
    if (args.length !== 3) {
      throw 'Expecting 3 arguments';
    }
    const img = args[0];
    const x = args[1];
    const y = args[2];
    if (!sink.islist(img) || img.length <= 0) {
      throw 'Expecting image as argument 1';
    }
    if (!sink.isnum(x)) {
      throw 'Expecting x coordinate (number) as argument 2';
    }
    if (!sink.isnum(y)) {
      throw 'Expecting y coordinate (number) as argument 3';
    }
    if (y < 0 || y >= img.length) {
      throw 'Y coordinate out of range';
    }
    const column = img[y];
    if (!sink.islist(column)) {
      throw 'Expecting image as argument 1';
    }
    if (x < 0 || x >= column.length) {
      throw 'X coordinate out of range';
    }
    const colors = column[x];
    if (!sink.islist(colors) || colors.length !== 4) {
      throw 'Expecting image as argument 1';
    }
    let [r, g, b, a] = colors;
    if (!sink.isnum(r) || !sink.isnum(g) || !sink.isnum(b) || !sink.isnum(a)) {
      throw 'Expecting image as argument 1';
    }
    r = Math.min(Math.max(r | 0, 0), 255);
    g = Math.min(Math.max(g | 0, 0), 255);
    b = Math.min(Math.max(b | 0, 0), 255);
    a = Math.min(Math.max(a | 0, 0), 255);
    if (a < 128) {
      return -1;
    }
    return ((r >> 3) | ((g >> 3) << 5) | ((b >> 3) << 10));
  });
  sink.ctx_autonative(ctx, 'audio.load', null, async (_ctx, args) => {
    if (args.length <= 0) {
      throw 'Expecting string or list for argument 1';
    }
    let data = args[0];
    if (typeof data === 'string') {
      data = data.split('').map((a) => a.charCodeAt(0)) as sink.list;
    }
    if (!Array.isArray(data)) {
      throw 'Expecting string or list for argument 1';
    }
    const wav = loadAudio(new Uint8Array(data as number[]));
    if (typeof wav === 'string') {
      throw `Failed to load audio: $wav`;
    }
    const ret = new sink.list();
    ret.push(wav.sampleRate);
    ret.push(wav.channels as sink.list);
    return ret;
  });
  sink.ctx_autonative(ctx, 'printf', null, async (ctx, args) => {
    if (args.length <= 0) {
      throw 'Expecting string for argument 1';
    }
    const fmt = sink.tostr(args[0]);
    const values: number[] = [];
    for (let i = 1; i < args.length; i++) {
      const arg = args[i];
      if (typeof arg !== 'number') {
        throw `Expecting number for argument ${i + 1}`;
      }
      values.push(Math.floor(arg) | 0);
    }
    return await sink.say(ctx, [printf(fmt, ...values)]);
  });
  sink.ctx_autonative(ctx, 'error', null, async (ctx, args) => {
    if (args.length <= 0) {
      throw 'Expecting string for argument 1';
    }
    const fmt = sink.tostr(args[0]);
    const values: number[] = [];
    for (let i = 1; i < args.length; i++) {
      const arg = args[i];
      if (typeof arg !== 'number') {
        throw `Expecting number for argument ${i + 1}`;
      }
      values.push(Math.floor(arg) | 0);
    }
    sink.abort(ctx, [printf(fmt, ...values)]);
    return sink.NIL;
  });
  sink.ctx_autonative(ctx, 'align', null, async (ctx, args) => {
    if (args.length <= 0 || typeof args[0] !== 'number') {
      throw `Expecting number for argument 1`;
    }
    const amount = args[0];
    let fill: number | 'nop' = 0;
    if (args.length >= 2) {
      if (typeof args[1] === 'number') {
        fill = Math.floor(args[1]) | 0;
      } else if (args[1] === 'nop') {
        fill = 'nop';
      } else {
        throw `Expecting number or 'nop' for argument 2`;
      }
    }
    if (args.length >= 3) {
      throw 'Expecting 1 or 2 arguments';
    }
    const flp = sink.ctx_source(ctx);
    put.push({
      ...flp,
      kind: 'closure',
      closure: () => {
        imp.align(flp, amount, fill);
      },
    });
    return sink.NIL;
  });

  const jsonType = sink.ctx_addusertype(ctx, 'json');
  function jsonTypeOf(v: any): string {
    switch (typeof v) {
      case 'object':
        if (v === null) {
          return 'null';
        } else if (Array.isArray(v)) {
          return 'array';
        }
        return 'object';
      case 'boolean':
      case 'number':
      case 'string':
        return typeof v;
    }
    return 'unknown';
  }
  sink.ctx_autonative(ctx, 'json.load', null, async (_ctx, args) => {
    if (args.length <= 0) {
      throw 'Expecting string for argument 1';
    }
    const data = args[0];
    if (typeof data !== 'string') {
      throw 'Expecting string for argument 1';
    }
    try {
      return sink.user_new(ctx, jsonType, JSON.parse(data));
    } catch (e) {
      throw `Invalid JSON data: ${e}`;
    }
  });
  sink.ctx_autonative(ctx, 'json.type', null, async (_ctx, args) => {
    if (args.length <= 0 || !sink.list_hasuser(ctx, args[0], jsonType)) {
      throw 'Expecting JSON object for argument 1';
    }
    const json = sink.list_getuser(ctx, args[0]);
    const type = ['null', 'boolean', 'number', 'string', 'array', 'object'].indexOf(
      jsonTypeOf(json),
    );
    if (type < 0) {
      throw `Unknown JSON type: ${typeof json}`;
    }
    return type;
  });
  sink.ctx_autonative(ctx, 'json.boolean', null, async (_ctx, args) => {
    if (args.length <= 0 || !sink.list_hasuser(ctx, args[0], jsonType)) {
      throw 'Expecting JSON object for argument 1';
    }
    const json = sink.list_getuser(ctx, args[0]);
    if (typeof json !== 'boolean') {
      throw `Expecting JSON to be boolean, but instead got ${jsonTypeOf(json)}`;
    }
    return json ? 1 : sink.NIL;
  });
  sink.ctx_autonative(ctx, 'json.number', null, async (_ctx, args) => {
    if (args.length <= 0 || !sink.list_hasuser(ctx, args[0], jsonType)) {
      throw 'Expecting JSON object for argument 1';
    }
    const json = sink.list_getuser(ctx, args[0]);
    if (typeof json !== 'number') {
      throw `Expecting JSON to be number, but instead got ${jsonTypeOf(json)}`;
    }
    return json;
  });
  sink.ctx_autonative(ctx, 'json.string', null, async (_ctx, args) => {
    if (args.length <= 0 || !sink.list_hasuser(ctx, args[0], jsonType)) {
      throw 'Expecting JSON object for argument 1';
    }
    const json = sink.list_getuser(ctx, args[0]);
    if (typeof json !== 'string') {
      throw `Expecting JSON to be string, but instead got ${jsonTypeOf(json)}`;
    }
    return json;
  });
  sink.ctx_autonative(ctx, 'json.array', null, async (_ctx, args) => {
    if (args.length <= 0 || !sink.list_hasuser(ctx, args[0], jsonType)) {
      throw 'Expecting JSON object for argument 1';
    }
    const json = sink.list_getuser(ctx, args[0]);
    if (!Array.isArray(json)) {
      throw `Expecting JSON to be array, but instead got ${jsonTypeOf(json)}`;
    }
    return json.map((v) => sink.user_new(ctx, jsonType, v)) as sink.list;
  });
  sink.ctx_autonative(ctx, 'json.object', null, async (_ctx, args) => {
    if (args.length <= 0 || !sink.list_hasuser(ctx, args[0], jsonType)) {
      throw 'Expecting JSON object for argument 1';
    }
    const json = sink.list_getuser(ctx, args[0]);
    if (jsonTypeOf(json) !== 'object') {
      throw `Expecting JSON to be object, but instead got ${jsonTypeOf(json)}`;
    }
    return Object.entries(json as Record<never, never>).map((
      [k, v],
    ) => [k as string, sink.user_new(ctx, jsonType, v)]) as sink.list;
  });
  sink.ctx_autonative(ctx, 'json.size', null, async (_ctx, args) => {
    if (args.length <= 0 || !sink.list_hasuser(ctx, args[0], jsonType)) {
      throw 'Expecting JSON object for argument 1';
    }
    const json = sink.list_getuser(ctx, args[0]);
    if (jsonTypeOf(json) === 'object') {
      return Object.keys(json as Record<never, never>).length;
    } else if (jsonTypeOf(json) === 'array') {
      return (json as Array<any>).length;
    }
    throw `Expecting JSON to be array or object, but instead got ${jsonTypeOf(json)}`;
  });
  sink.ctx_autonative(ctx, 'json.get', null, async (_ctx, args) => {
    if (args.length <= 0 || !sink.list_hasuser(ctx, args[0], jsonType)) {
      throw 'Expecting JSON object for argument 1';
    }
    if (args.length <= 1 || (typeof args[1] !== 'string' && typeof args[1] !== 'number')) {
      throw 'Expecting string or number for argument 2';
    }
    const json = sink.list_getuser(ctx, args[0]);
    let key = args[1] as number;
    if (typeof key === 'string') {
      if (jsonTypeOf(json) !== 'object') {
        throw `Expecting JSON to be object, but instead got ${jsonTypeOf(json)}`;
      }
      if (key in (json as Record<never, never>)) {
        return sink.user_new(ctx, jsonType, (json as Record<never, never>)[key]);
      }
      return sink.NIL;
    }
    // otherwise, key is number
    if (jsonTypeOf(json) !== 'array') {
      throw `Expecting JSON to be array, but instead got ${jsonTypeOf(json)}`;
    }
    if (key < 0) {
      key += (json as Array<any>).length;
    }
    if (key < 0 || key >= (json as Array<any>).length) {
      return sink.NIL;
    }
    return sink.user_new(ctx, jsonType, (json as Array<any>)[key]);
  });

  for (let unsigned = 0; unsigned < 2; unsigned++) {
    for (let bigendian = 0; bigendian < 2; bigendian++) {
      for (let misaligned = 0; misaligned < 2; misaligned++) {
        for (const size of [8, 16, 32]) {
          const dataType = dataTypeCreate(!!unsigned, !!bigendian, !!misaligned, size);
          sink.ctx_autonative(ctx, dataType, null, async (ctx, args) => {
            const data: number[] = [];
            const add = (list: sink.val[]) => {
              if ((list as { gvasmSeen?: true }).gvasmSeen) {
                throw 'Invalid circular lists';
              }
              (list as { gvasmSeen?: true }).gvasmSeen = true;
              for (let i = 0; i < list.length; i++) {
                const v = list[i];
                if (typeof v === 'number') {
                  data.push(v);
                } else if (Array.isArray(v)) {
                  add(v);
                } else {
                  throw 'Expecting number or list of numbers';
                }
              }
              delete (list as { gvasmSeen?: true }).gvasmSeen;
            };
            add(args);
            const flp = sink.ctx_source(ctx);
            put.push({
              ...flp,
              kind: 'closure',
              closure: () => {
                imp.writeData(flp, dataType, data);
              },
            });
            return sink.NIL;
          });
          sink.ctx_autonative(ctx, `${dataType}fill`, null, async (ctx, args) => {
            if (args.length <= 0 || typeof args[0] !== 'number') {
              throw `Expecting number for argument 1`;
            }
            const amount = args[0];
            let value = 0;
            if (args.length >= 2) {
              if (typeof args[1] !== 'number') {
                throw `Expecting number for argument 2`;
              }
              value = Math.floor(args[1]) | 0;
            }
            if (args.length >= 3) {
              throw 'Expecting 1 or 2 arguments';
            }
            const flp = sink.ctx_source(ctx);
            put.push({
              ...flp,
              kind: 'closure',
              closure: () => {
                imp.writeDataFill(flp, dataType, amount, value);
              },
            });
            return sink.NIL;
          });
        }
      }
    }
  }
}
