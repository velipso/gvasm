//
// gvasm - Assembler and disassembler for Game Boy Advance homebrew
// by Sean Connelly (@velipso), https://sean.cm
// The Unlicense License
// Project Home: https://github.com/velipso/gvasm
//

import { ILineStr, splitLines } from "./util.ts";
import { loadImage } from "./deps.ts";
import * as sink from "./sink.ts";

export function loadLibIntoScript(scr: sink.scr) {
  sink.scr_autonative(scr, "put");
  sink.scr_autonative(scr, "store.set");
  sink.scr_autonative(scr, "store.get");
  sink.scr_autonative(scr, "store.has");
  sink.scr_autonative(scr, "image.load");
}

export function loadLibIntoContext(
  ctx: sink.ctx,
  put: ILineStr[],
  store: { [key: string]: string },
) {
  sink.ctx_autonative(
    ctx,
    "put",
    null,
    (ctx: sink.ctx, args: sink.val[]) => {
      const flp = sink.ctx_source(ctx);
      const out: string[] = [];
      for (const arg of args) {
        out.push(sink.tostr(arg));
      }
      put.push(...splitLines(flp.filename, out.join("\n"), flp.line));
      return Promise.resolve(sink.NIL);
    },
  );
  sink.ctx_autonative(
    ctx,
    "store.set",
    null,
    (_ctx: sink.ctx, args: sink.val[]) => {
      if (args.length <= 0 || !sink.isstr(args[0])) {
        return Promise.reject("Expecting string for argument 1");
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
    "store.get",
    null,
    (_ctx: sink.ctx, args: sink.val[]) => {
      if (args.length <= 0 || !sink.isstr(args[0])) {
        return Promise.reject("Expecting string for argument 1");
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
    "store.has",
    null,
    (_ctx: sink.ctx, args: sink.val[]) => {
      if (args.length <= 0 || !sink.isstr(args[0])) {
        return Promise.reject("Expecting string for argument 1");
      }
      const key = args[0] as string;
      return Promise.resolve(sink.bool(key in store));
    },
  );
  sink.ctx_autonative(
    ctx,
    "image.load",
    null,
    async (_ctx: sink.ctx, args: sink.val[]) => {
      if (args.length <= 0) {
        return Promise.reject("Expecting string or list for argument 1");
      }
      let data = args[0];
      if (typeof data === "string") {
        data = data.split("").map((a) => a.charCodeAt(0)) as sink.list;
      }
      if (!Array.isArray(data)) {
        return Promise.reject("Expecting string or list for argument 1");
      }
      const img = await loadImage(new Uint8Array(data as number[])).catch(() =>
        null
      );
      if (img === null) {
        return sink.NIL;
      }
      if (
        img.width <= 0 || img.height <= 0 ||
        img.width * img.height * 4 !== img.data.length
      ) {
        return sink.NIL;
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
}
