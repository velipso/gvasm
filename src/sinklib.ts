//
// gvasm - Assembler and disassembler for Game Boy Advance homebrew
// by Sean Connelly (@velipso), https://sean.cm
// The Unlicense License
// Project Home: https://github.com/velipso/gvasm
//

import { ILineStr, splitLines } from './util.ts';
import { loadImage } from './deps.ts';
import * as sink from './sink.ts';
import { ConstTable } from './const.ts';

export function loadLibIntoScript(scr: sink.scr, ctable: ConstTable) {
  sink.scr_autonative(scr, 'put');
  sink.scr_autonative(scr, 'store.set');
  sink.scr_autonative(scr, 'store.get');
  sink.scr_autonative(scr, 'store.has');
  sink.scr_autonative(scr, 'image.load');
  for (const c of ctable.listScope()) {
    sink.scr_autonative(scr, c);
  }
}

export function loadLibIntoContext(
  ctx: sink.ctx,
  put: ILineStr[],
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
