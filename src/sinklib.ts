//
// gvasm - Assembler and disassembler for Game Boy Advance homebrew
// by Sean Connelly (@velipso), https://sean.cm
// The Unlicense License
// Project Home: https://github.com/velipso/gvasm
//

// deno-lint-ignore-file no-explicit-any

import { b16, b32, ILineStr, printf, splitLines } from './util.ts';
import { loadImage } from './deps.ts';
import * as sink from './sink.ts';
import { ConstTable } from './const.ts';

export interface ILineBytes {
  kind: 'bytes';
  data: number[];
}

export type ILinePut = ILineStr | ILineBytes;

export function loadLibIntoScript(scr: sink.scr, ctable: ConstTable) {
  sink.scr_autonative(scr, 'put');
  sink.scr_autonative(scr, 'i8');
  sink.scr_autonative(scr, 'i16');
  sink.scr_autonative(scr, 'i32');
  sink.scr_autonative(scr, 'i8fill');
  sink.scr_autonative(scr, 'i16fill');
  sink.scr_autonative(scr, 'i32fill');
  sink.scr_autonative(scr, 'b8');
  sink.scr_autonative(scr, 'b16');
  sink.scr_autonative(scr, 'b32');
  sink.scr_autonative(scr, 'b8fill');
  sink.scr_autonative(scr, 'b16fill');
  sink.scr_autonative(scr, 'b32fill');
  sink.scr_autonative(scr, 'error');
  sink.scr_autonative(scr, 'printf');
  sink.scr_autonative(scr, 'store.set');
  sink.scr_autonative(scr, 'store.get');
  sink.scr_autonative(scr, 'store.has');
  sink.scr_autonative(scr, 'image.load');
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
  for (const c of ctable.listScope()) {
    sink.scr_autonative(scr, c);
  }
}

export function loadLibIntoContext(
  ctx: sink.ctx,
  put: ILinePut[],
  store: { [key: string]: string },
  main: boolean,
  ctable: ConstTable,
) {
  sink.ctx_autonative(
    ctx,
    'put',
    null,
    (ctx: sink.ctx, args: sink.val[]) => {
      const flp = sink.ctx_source(ctx);
      const out: string[] = [];
      for (const arg of args) {
        out.push(sink.tostr(arg));
      }
      put.push(...splitLines(flp.filename, out.join(' '), main, flp.line));
      return Promise.resolve(sink.NIL);
    },
  );
  const i8 = async (ctx: sink.ctx, args: sink.val[]) => {
    const data: number[] = [];
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      if (typeof arg === 'number') {
        data.push(Math.floor(arg) | 0);
      } else if (typeof arg === 'string') {
        for (const n of new TextEncoder().encode(arg)) {
          data.push(n);
        }
      } else if (sink.islist(arg)) {
        if ((arg as { gvasmSeen?: true }).gvasmSeen) {
          throw 'Invalid circular lists';
        }
        (arg as { gvasmSeen?: true }).gvasmSeen = true;
        put.push({ kind: 'bytes', data });
        data.splice(0, data.length);
        await i8(ctx, arg);
        delete (arg as { gvasmSeen?: true }).gvasmSeen;
      } else {
        throw `Expecting number or string for argument ${i + 1}`;
      }
    }
    put.push({ kind: 'bytes', data });
    return sink.NIL;
  };
  const ib16 = (isB: boolean) =>
    async (ctx: sink.ctx, args: sink.val[]) => {
      const data: number[] = [];
      for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (typeof arg === 'number') {
          const v = isB ? b16(arg) : arg;
          data.push(v & 0xff);
          data.push((v >>> 8) & 0xff);
        } else if (sink.islist(arg)) {
          if ((arg as { gvasmSeen?: true }).gvasmSeen) {
            throw 'Invalid circular lists';
          }
          (arg as { gvasmSeen?: true }).gvasmSeen = true;
          put.push({ kind: 'bytes', data });
          data.splice(0, data.length);
          await ib16(isB)(ctx, arg);
          delete (arg as { gvasmSeen?: true }).gvasmSeen;
        } else {
          throw `Expecting number for argument ${i + 1}`;
        }
      }
      put.push({ kind: 'bytes', data });
      return sink.NIL;
    };
  const ib32 = (isB: boolean) =>
    async (ctx: sink.ctx, args: sink.val[]) => {
      const data: number[] = [];
      for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (typeof arg === 'number') {
          const v = isB ? b32(arg) : arg;
          data.push(v & 0xff);
          data.push((v >>> 8) & 0xff);
          data.push((v >>> 16) & 0xff);
          data.push((v >>> 24) & 0xff);
        } else if (sink.islist(arg)) {
          if ((arg as { gvasmSeen?: true }).gvasmSeen) {
            throw 'Invalid circular lists';
          }
          (arg as { gvasmSeen?: true }).gvasmSeen = true;
          put.push({ kind: 'bytes', data });
          data.splice(0, data.length);
          await ib32(isB)(ctx, arg);
          delete (arg as { gvasmSeen?: true }).gvasmSeen;
        } else {
          throw `Expecting number for argument ${i + 1}`;
        }
      }
      put.push({ kind: 'bytes', data });
      return sink.NIL;
    };
  const parseFill = (args: sink.val[]) => {
    if (args.length <= 0 || typeof args[0] !== 'number') {
      return Promise.reject(`Expecting number for argument 1`);
    }
    const amount = args[0];
    let value = 0;
    if (args.length >= 2) {
      if (typeof args[1] !== 'number') {
        return Promise.reject(`Expecting number for argument 2`);
      }
      value = Math.floor(args[1]) | 0;
    }
    if (args.length >= 3) {
      return Promise.reject('Expecting 1 or 2 arguments');
    }
    return Promise.resolve({ amount, value });
  };
  const i8fill = async (_ctx: sink.ctx, args: sink.val[]) => {
    const { amount, value } = await parseFill(args);
    const data: number[] = [];
    for (let i = 0; i < amount; i++) {
      data.push(value);
    }
    put.push({ kind: 'bytes', data });
    return sink.NIL;
  };
  const ib16fill = (isB: boolean) =>
    async (_ctx: sink.ctx, args: sink.val[]) => {
      const { amount, value } = await parseFill(args);
      const v = isB ? b16(value) : value;
      const v1 = v & 0xff;
      const v2 = (v >>> 8) & 0xff;
      const data: number[] = [];
      for (let i = 0; i < amount; i++) {
        data.push(v1);
        data.push(v2);
      }
      put.push({ kind: 'bytes', data });
      return sink.NIL;
    };
  const ib32fill = (isB: boolean) =>
    async (_ctx: sink.ctx, args: sink.val[]) => {
      const { amount, value } = await parseFill(args);
      const v = isB ? b32(value) : value;
      const v1 = v & 0xff;
      const v2 = (v >>> 8) & 0xff;
      const v3 = (v >>> 16) & 0xff;
      const v4 = (v >>> 24) & 0xff;
      const data: number[] = [];
      for (let i = 0; i < amount; i++) {
        data.push(v1);
        data.push(v2);
        data.push(v3);
        data.push(v4);
      }
      put.push({ kind: 'bytes', data });
      return sink.NIL;
    };
  sink.ctx_autonative(ctx, 'i8', null, i8);
  sink.ctx_autonative(ctx, 'b8', null, i8);
  sink.ctx_autonative(ctx, 'i16', null, ib16(false));
  sink.ctx_autonative(ctx, 'b16', null, ib16(true));
  sink.ctx_autonative(ctx, 'i32', null, ib32(false));
  sink.ctx_autonative(ctx, 'b32', null, ib32(true));
  sink.ctx_autonative(ctx, 'i8fill', null, i8fill);
  sink.ctx_autonative(ctx, 'b8fill', null, i8fill);
  sink.ctx_autonative(ctx, 'i16fill', null, ib16fill(false));
  sink.ctx_autonative(ctx, 'b16fill', null, ib16fill(true));
  sink.ctx_autonative(ctx, 'i32fill', null, ib32fill(false));
  sink.ctx_autonative(ctx, 'b32fill', null, ib32fill(true));
  sink.ctx_autonative(ctx, 'printf', null, (ctx: sink.ctx, args: sink.val[]) => {
    if (args.length <= 0) {
      return Promise.reject('Expecting string for argument 1');
    }
    const fmt = sink.tostr(args[0]);
    const values: number[] = [];
    for (let i = 1; i < args.length; i++) {
      const arg = args[i];
      if (typeof arg !== 'number') {
        return Promise.reject(`Expecting number for argument ${i + 1}`);
      }
      values.push(Math.floor(arg) | 0);
    }
    return sink.say(ctx, [printf(fmt, ...values)]);
  });
  sink.ctx_autonative(ctx, 'error', null, (ctx: sink.ctx, args: sink.val[]) => {
    if (args.length <= 0) {
      return Promise.reject('Expecting string for argument 1');
    }
    const fmt = sink.tostr(args[0]);
    const values: number[] = [];
    for (let i = 1; i < args.length; i++) {
      const arg = args[i];
      if (typeof arg !== 'number') {
        return Promise.reject(`Expecting number for argument ${i + 1}`);
      }
      values.push(Math.floor(arg) | 0);
    }
    sink.abort(ctx, [printf(fmt, ...values)]);
    return Promise.resolve(sink.NIL);
  });
  sink.ctx_autonative(
    ctx,
    'store.set',
    null,
    (_ctx: sink.ctx, args: sink.val[]) => {
      if (args.length <= 0 || !sink.isstr(args[0])) {
        return Promise.reject('Expecting string for argument 1');
      }
      const key = args[0] as string;
      const val = args.length < 1 ? sink.NIL : args[1];
      if (val === sink.NIL) {
        delete store[key];
      } else {
        store[key] = sink.pickle_binstr(val);
      }
      return Promise.resolve(val);
    },
  );
  sink.ctx_autonative(
    ctx,
    'store.get',
    null,
    (_ctx: sink.ctx, args: sink.val[]) => {
      if (args.length <= 0 || !sink.isstr(args[0])) {
        return Promise.reject('Expecting string for argument 1');
      }
      const key = args[0] as string;
      const def = args.length < 1 ? sink.NIL : args[1];
      if (key in store) {
        const res = sink.pickle_valstr(store[key]);
        return Promise.resolve(res === false ? def : res);
      }
      return Promise.resolve(def);
    },
  );
  sink.ctx_autonative(
    ctx,
    'store.has',
    null,
    (_ctx: sink.ctx, args: sink.val[]) => {
      if (args.length <= 0 || !sink.isstr(args[0])) {
        return Promise.reject('Expecting string for argument 1');
      }
      const key = args[0] as string;
      return Promise.resolve(sink.bool(key in store));
    },
  );
  sink.ctx_autonative(
    ctx,
    'image.load',
    null,
    async (_ctx: sink.ctx, args: sink.val[]) => {
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
    },
  );
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
  sink.ctx_autonative(
    ctx,
    'json.load',
    null,
    (_ctx: sink.ctx, args: sink.val[]) => {
      if (args.length <= 0) {
        return Promise.reject('Expecting string for argument 1');
      }
      const data = args[0];
      if (typeof data !== 'string') {
        return Promise.reject('Expecting string for argument 1');
      }
      try {
        return Promise.resolve(sink.user_new(ctx, jsonType, JSON.parse(data)));
      } catch (e) {
        return Promise.reject('Invalid JSON data: ' + e);
      }
    },
  );
  sink.ctx_autonative(
    ctx,
    'json.type',
    null,
    (_ctx: sink.ctx, args: sink.val[]) => {
      if (args.length <= 0 || !sink.list_hasuser(ctx, args[0], jsonType)) {
        return Promise.reject('Expecting JSON object for argument 1');
      }
      const json = sink.list_getuser(ctx, args[0]);
      const type = ['null', 'boolean', 'number', 'string', 'array', 'object'].indexOf(
        jsonTypeOf(json),
      );
      if (type < 0) {
        return Promise.reject('Unknown JSON type: ' + typeof json);
      }
      return Promise.resolve(type);
    },
  );
  sink.ctx_autonative(
    ctx,
    'json.boolean',
    null,
    (_ctx: sink.ctx, args: sink.val[]) => {
      if (args.length <= 0 || !sink.list_hasuser(ctx, args[0], jsonType)) {
        return Promise.reject('Expecting JSON object for argument 1');
      }
      const json = sink.list_getuser(ctx, args[0]);
      if (typeof json !== 'boolean') {
        return Promise.reject(`Expecting JSON to be boolean, but instead got ${jsonTypeOf(json)}`);
      }
      return Promise.resolve(json ? 1 : sink.NIL);
    },
  );
  sink.ctx_autonative(
    ctx,
    'json.number',
    null,
    (_ctx: sink.ctx, args: sink.val[]) => {
      if (args.length <= 0 || !sink.list_hasuser(ctx, args[0], jsonType)) {
        return Promise.reject('Expecting JSON object for argument 1');
      }
      const json = sink.list_getuser(ctx, args[0]);
      if (typeof json !== 'number') {
        return Promise.reject(`Expecting JSON to be number, but instead got ${jsonTypeOf(json)}`);
      }
      return Promise.resolve(json);
    },
  );
  sink.ctx_autonative(
    ctx,
    'json.string',
    null,
    (_ctx: sink.ctx, args: sink.val[]) => {
      if (args.length <= 0 || !sink.list_hasuser(ctx, args[0], jsonType)) {
        return Promise.reject('Expecting JSON object for argument 1');
      }
      const json = sink.list_getuser(ctx, args[0]);
      if (typeof json !== 'string') {
        return Promise.reject(`Expecting JSON to be string, but instead got ${jsonTypeOf(json)}`);
      }
      return Promise.resolve(json);
    },
  );
  sink.ctx_autonative(
    ctx,
    'json.array',
    null,
    (_ctx: sink.ctx, args: sink.val[]) => {
      if (args.length <= 0 || !sink.list_hasuser(ctx, args[0], jsonType)) {
        return Promise.reject('Expecting JSON object for argument 1');
      }
      const json = sink.list_getuser(ctx, args[0]);
      if (!Array.isArray(json)) {
        return Promise.reject(`Expecting JSON to be array, but instead got ${jsonTypeOf(json)}`);
      }
      return Promise.resolve(json.map((v) => sink.user_new(ctx, jsonType, v)) as sink.list);
    },
  );
  sink.ctx_autonative(
    ctx,
    'json.object',
    null,
    (_ctx: sink.ctx, args: sink.val[]) => {
      if (args.length <= 0 || !sink.list_hasuser(ctx, args[0], jsonType)) {
        return Promise.reject('Expecting JSON object for argument 1');
      }
      const json = sink.list_getuser(ctx, args[0]);
      if (jsonTypeOf(json) !== 'object') {
        return Promise.reject(`Expecting JSON to be object, but instead got ${jsonTypeOf(json)}`);
      }
      return Promise.resolve(
        Object.entries(json as Record<never, never>).map((
          [k, v],
        ) => [k as string, sink.user_new(ctx, jsonType, v)]) as sink.list,
      );
    },
  );
  sink.ctx_autonative(
    ctx,
    'json.size',
    null,
    (_ctx: sink.ctx, args: sink.val[]) => {
      if (args.length <= 0 || !sink.list_hasuser(ctx, args[0], jsonType)) {
        return Promise.reject('Expecting JSON object for argument 1');
      }
      const json = sink.list_getuser(ctx, args[0]);
      if (jsonTypeOf(json) === 'object') {
        return Promise.resolve(Object.keys(json as Record<never, never>).length);
      } else if (jsonTypeOf(json) === 'array') {
        return Promise.resolve((json as Array<any>).length);
      }
      return Promise.reject(
        `Expecting JSON to be array or object, but instead got ${jsonTypeOf(json)}`,
      );
    },
  );
  sink.ctx_autonative(
    ctx,
    'json.get',
    null,
    (_ctx: sink.ctx, args: sink.val[]) => {
      if (args.length <= 0 || !sink.list_hasuser(ctx, args[0], jsonType)) {
        return Promise.reject('Expecting JSON object for argument 1');
      }
      if (args.length <= 1 || (typeof args[1] !== 'string' && typeof args[1] !== 'number')) {
        return Promise.reject('Expecting string or number for argument 2');
      }
      const json = sink.list_getuser(ctx, args[0]);
      let key = args[1] as number;
      if (typeof key === 'string') {
        if (jsonTypeOf(json) !== 'object') {
          return Promise.reject(`Expecting JSON to be object, but instead got ${jsonTypeOf(json)}`);
        }
        if (key in (json as Record<never, never>)) {
          return Promise.resolve(sink.user_new(ctx, jsonType, (json as Record<never, never>)[key]));
        }
        return Promise.resolve(sink.NIL);
      }
      // otherwise, key is number
      if (jsonTypeOf(json) !== 'array') {
        return Promise.reject(`Expecting JSON to be array, but instead got ${jsonTypeOf(json)}`);
      }
      if (key < 0) {
        key += (json as Array<any>).length;
      }
      if (key < 0 || key >= (json as Array<any>).length) {
        return Promise.resolve(sink.NIL);
      }
      return Promise.resolve(sink.user_new(ctx, jsonType, (json as Array<any>)[key]));
    },
  );
  for (const c of ctable.listScope()) {
    sink.ctx_autonative(
      ctx,
      c,
      null,
      (_ctx: sink.ctx, args: sink.val[]) => {
        if (args.some((a) => typeof a !== 'number')) {
          return Promise.reject(`Only number arguments allowed for $c`);
        }
        const params = (args as number[]).map((a) => Math.floor(a) | 0);
        const builder = ctable.lookup(c);
        if (builder.kind !== 'expr') {
          return Promise.reject(`Constant $c is not an expression`);
        }
        const v = builder.expr.build(params).value();
        if (v === false) {
          return Promise.reject(`Can't determine value of $c at this time`);
        }
        return Promise.resolve(v);
      },
    );
  }
}
