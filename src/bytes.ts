//
// gvasm - Assembler and disassembler for Game Boy Advance homebrew
// by Sean Connelly (@velipso), https://sean.cm
// The Unlicense License
// Project Home: https://github.com/velipso/gvasm
//

import { Expression } from './expr.ts';

const MAX_LENGTH = 0x02000000;

type BuildWithoutPoolFunc = (
  values: { [name: string]: number },
  address: number,
) => number | false;

type BuildWithPoolFunc = (
  values: { [name: string]: number },
  address: number,
  poolAddress: number,
) => number;

interface IPool {
  bytes: 1 | 2 | 4;
  align: 1 | 2 | 4;
  sym: string;
}

interface IPendingExpr {
  hint: string;
  address: number;
  exprs: { [name: string]: Expression | number };
  scopeLevel: number;
  pool: IPool | false;
  poolAddress: number | false;
  buildWithoutPool: BuildWithoutPoolFunc;
  buildWithPool: BuildWithPoolFunc | undefined;
  rewritePool?(v: number): void;
  rewriteInst(v: number): void;
}

export class Bytes {
  private base = 0x08000000;
  private array: number[] = [];
  private pendingExprs: IPendingExpr[] = [];
  private globalLabels: { [name: string]: number } = {};
  private localLabels: { [name: string]: number }[] = [{}];

  public get(): readonly number[] {
    for (const pex of this.pendingExprs) {
      if (pex.pool) {
        throw `${pex.hint}, missing .pool statement to hold constant`;
      }
      for (const expr of Object.values(pex.exprs)) {
        if (expr instanceof Expression) {
          expr.validateNoLabelsNeeded(pex.hint);
        }
      }
    }
    return this.array;
  }

  public getBase() {
    return this.base;
  }

  public setBase(base: number) {
    this.base = base;
  }

  public nextAddress() {
    return this.base + this.array.length;
  }

  private push(...v: number[]) {
    if (this.array.length + v.length > MAX_LENGTH) {
      throw `Program too large, exceeds maximum length of 0x${MAX_LENGTH.toString(16)} bytes`;
    }
    for (const n of v) {
      this.array.push(n & 0xff);
    }
  }

  public write8(v: number) {
    this.push(v);
  }

  public write16(v: number) {
    this.push(v, v >> 8);
  }

  public write32(v: number) {
    this.push(v, v >> 8, v >> 16, v >> 24);
  }

  public writeArray(v: number[] | Uint8Array) {
    this.push(...v);
  }

  public align(amount: number, fill = 0) {
    while ((this.nextAddress() % amount) !== 0) {
      this.push(fill);
    }
  }

  private rewrite8(): (v: number) => void {
    const i = this.array.length;
    this.write8(0);
    return (v: number) => {
      this.array[i] = v & 0xff;
    };
  }

  private rewrite16(): (v: number) => void {
    const i = this.array.length;
    this.write16(0);
    return (v: number) => {
      this.array[i] = v & 0xff;
      this.array[i + 1] = (v >> 8) & 0xff;
    };
  }

  private rewrite32(): (v: number) => void {
    const i = this.array.length;
    this.write32(0);
    return (v: number) => {
      this.array[i] = v & 0xff;
      this.array[i + 1] = (v >> 8) & 0xff;
      this.array[i + 2] = (v >> 16) & 0xff;
      this.array[i + 3] = (v >> 24) & 0xff;
    };
  }

  public expr8(
    hint: string,
    exprs: { [name: string]: Expression | number },
    pool: IPool | false,
    buildWithoutPool: BuildWithoutPoolFunc,
    buildWithPool?: BuildWithPoolFunc,
  ) {
    this.pushPendingExpr({
      hint,
      address: this.nextAddress(),
      exprs,
      scopeLevel: this.localLabels.length,
      pool,
      poolAddress: false,
      buildWithoutPool,
      buildWithPool,
      rewriteInst: this.rewrite8(),
    });
  }

  public expr16(
    hint: string,
    exprs: { [name: string]: Expression | number },
    pool: IPool | false,
    buildWithoutPool: BuildWithoutPoolFunc,
    buildWithPool?: BuildWithPoolFunc,
  ) {
    this.pushPendingExpr({
      hint,
      address: this.nextAddress(),
      exprs,
      scopeLevel: this.localLabels.length,
      pool,
      poolAddress: false,
      buildWithoutPool,
      buildWithPool,
      rewriteInst: this.rewrite16(),
    });
  }

  public expr32(
    hint: string,
    exprs: { [name: string]: Expression | number },
    pool: IPool | false,
    buildWithoutPool: BuildWithoutPoolFunc,
    buildWithPool?: BuildWithPoolFunc,
  ) {
    this.pushPendingExpr({
      hint,
      address: this.nextAddress(),
      exprs,
      scopeLevel: this.localLabels.length,
      pool,
      poolAddress: false,
      buildWithoutPool,
      buildWithPool,
      rewriteInst: this.rewrite32(),
    });
  }

  public addLabelsToExpression(expr: Expression) {
    for (const [label, v] of Object.entries(this.globalLabels)) {
      expr.addLabel(label, v);
    }
    for (const [label, v] of Object.entries(this.localLabels[0])) {
      expr.addLabel(label, v);
    }
  }

  private pushPendingExpr(pex: IPendingExpr) {
    // inform the exprs of all known labels
    for (const expr of Object.values(pex.exprs)) {
      if (expr instanceof Expression) {
        this.addLabelsToExpression(expr);
      }
    }

    // attempt rewrites
    if (!this.attemptExpr(pex)) {
      this.pendingExprs.push(pex);
    }
  }

  private attemptExpr(pex: IPendingExpr): boolean {
    const values: { [name: string]: number } = {};
    for (const name of Object.keys(pex.exprs)) {
      const ex = pex.exprs[name];
      if (typeof ex === 'number') {
        values[name] = ex;
      } else {
        const exv = ex.value();
        if (exv === false) {
          return false;
        }
        values[name] = exv;
      }
    }

    // build the final value
    const b = pex.buildWithoutPool(values, pex.address);
    if (b === false) {
      if (pex.pool && pex.buildWithPool && pex.poolAddress !== false) {
        pex.rewritePool?.(values[pex.pool.sym]);
        pex.rewriteInst(
          pex.buildWithPool(values, pex.address, pex.poolAddress),
        );
        return true;
      }
      return false;
    }
    pex.rewriteInst(b);
    return true;
  }

  public addLabel(label: string) {
    const isLocal = label.startsWith('@@');
    const scope = isLocal ? this.localLabels[0] : this.globalLabels;
    if (label in scope) {
      throw `Cannot redefine label: ${label}`;
    }

    // add label knowledge
    const v = this.nextAddress();
    scope[label] = v;
    for (const pex of this.pendingExprs) {
      // only add label to this expression if they're the same scope level
      if (!isLocal || (pex.scopeLevel === this.localLabels.length)) {
        for (const expr of Object.values(pex.exprs)) {
          if (expr instanceof Expression) {
            expr.addLabel(label, v);
          }
        }
      }
    }

    this.attemptRewrites();
  }

  private attemptRewrites() {
    for (let i = 0; i < this.pendingExprs.length; i++) {
      if (this.attemptExpr(this.pendingExprs[i])) {
        this.pendingExprs.splice(i, 1);
        i--;
      }
    }
  }

  public scopeBegin() {
    this.localLabels.unshift({});
  }

  public scopeEnd() {
    if (this.localLabels.length > 1) {
      this.localLabels.shift();
    } else {
      throw `Statement .end is missing matching .begin`;
    }
  }

  public writeLogo() {
    // deno-fmt-ignore
    this.push(
      0x24, 0xff, 0xae, 0x51, 0x69, 0x9a, 0xa2, 0x21, 0x3d, 0x84, 0x82, 0x0a, 0x84, 0xe4, 0x09,
      0xad, 0x11, 0x24, 0x8b, 0x98, 0xc0, 0x81, 0x7f, 0x21, 0xa3, 0x52, 0xbe, 0x19, 0x93, 0x09,
      0xce, 0x20, 0x10, 0x46, 0x4a, 0x4a, 0xf8, 0x27, 0x31, 0xec, 0x58, 0xc7, 0xe8, 0x33, 0x82,
      0xe3, 0xce, 0xbf, 0x85, 0xf4, 0xdf, 0x94, 0xce, 0x4b, 0x09, 0xc1, 0x94, 0x56, 0x8a, 0xc0,
      0x13, 0x72, 0xa7, 0xfc, 0x9f, 0x84, 0x4d, 0x73, 0xa3, 0xca, 0x9a, 0x61, 0x58, 0x97, 0xa3,
      0x27, 0xfc, 0x03, 0x98, 0x76, 0x23, 0x1d, 0xc7, 0x61, 0x03, 0x04, 0xae, 0x56, 0xbf, 0x38,
      0x84, 0x00, 0x40, 0xa7, 0x0e, 0xfd, 0xff, 0x52, 0xfe, 0x03, 0x6f, 0x95, 0x30, 0xf1, 0x97,
      0xfb, 0xc0, 0x85, 0x60, 0xd6, 0x80, 0x25, 0xa9, 0x63, 0xbe, 0x03, 0x01, 0x4e, 0x38, 0xe2,
      0xf9, 0xa2, 0x34, 0xff, 0xbb, 0x3e, 0x03, 0x44, 0x78, 0x00, 0x90, 0xcb, 0x88, 0x11, 0x3a,
      0x94, 0x65, 0xc0, 0x7c, 0x63, 0x87, 0xf0, 0x3c, 0xaf, 0xd6, 0x25, 0xe4, 0x8b, 0x38, 0x0a,
      0xac, 0x72, 0x21, 0xd4, 0xf8, 0x07,
    );
  }

  public writeCRC() {
    if (this.array.length < 0xbd) {
      throw 'Invalid .crc statement: header too small';
    }
    let crc = -0x19;
    for (let i = 0xa0; i < 0xbd; i++) {
      crc = crc - this.array[i];
    }
    this.push(crc & 0xff);
  }

  public writePool(): boolean {
    let result = false;
    const written: { v: number; addr: number }[] = [];
    for (let i = 0; i < this.pendingExprs.length; i++) {
      const pex = this.pendingExprs[i];
      if (pex.pool && pex.poolAddress === false) {
        const pv = pex.exprs[pex.pool.sym];
        let writev: number | false = false;
        if (typeof pv === 'number') {
          writev = pv;
        } else {
          const px = pv.value();
          if (px !== false) {
            writev = px;
          }
        }
        result = true;

        // see if we already wrote it to the pool
        const w = written.find((w) => w.v === writev);
        let poolAddress;
        if (w) {
          // we already wrote this constant, so use it again
          poolAddress = w.addr;
        } else {
          // we haven't written this constant, so write it

          // align the constant
          this.align(pex.pool.align);

          // write the constant
          poolAddress = this.nextAddress();

          if (typeof writev === 'number') {
            if (pex.pool.bytes === 1) {
              this.write8(writev);
            } else if (pex.pool.bytes === 2) {
              this.write16(writev);
            } else if (pex.pool.bytes === 4) {
              this.write32(writev);
            } else {
              throw new Error('Invalid byte size for pool value');
            }
            written.push({ v: writev, addr: poolAddress });
          } else {
            // we don't know the constant yet, so rewrite it instead
            if (pex.pool.bytes === 1) {
              pex.rewritePool = this.rewrite8();
            } else if (pex.pool.bytes === 2) {
              pex.rewritePool = this.rewrite16();
            } else if (pex.pool.bytes === 4) {
              pex.rewritePool = this.rewrite32();
            } else {
              throw new Error('Invalid byte size for pool value');
            }
          }
        }

        // rewrite the instruction with the pool address
        pex.poolAddress = poolAddress;
        if (this.attemptExpr(pex)) {
          this.pendingExprs.splice(i, 1);
          i--;
        }
      }
    }
    return result;
  }
}
