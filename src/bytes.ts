//
// gbasm - Assembler and disassembler for Game Boy Advance homebrew
// by Sean Connelly (@velipso), https://sean.cm
// The Unlicense License
// Project Home: https://github.com/velipso/gbasm
//

import { Expression } from "./expr.ts";

interface IPendingExpr {
  hint: string;
  thisIndex: number;
  exprs: { [name: string]: Expression | number };
  build(values: { [name: string]: number }, thisIndex: number): number;
  rewrite(v: number): void;
}

export class Bytes {
  private array: number[] = [];
  private pendingRewrites: (string | false)[] = [];
  private pendingExprs: IPendingExpr[] = [];
  private labels: { [name: string]: number } = {};

  public get(): readonly number[] {
    const prw = this.pendingRewrites.filter((p) => p !== false);
    if (prw.length > 0) {
      throw prw.join("\n");
    }
    return this.array;
  }

  public size(): number {
    return this.array.length;
  }

  public write8(v: number) {
    this.array.push(v & 0xff);
  }

  public write16(v: number) {
    this.array.push(v & 0xff);
    this.array.push((v >> 8) & 0xff);
  }

  public write32(v: number) {
    this.array.push(v & 0xff);
    this.array.push((v >> 8) & 0xff);
    this.array.push((v >> 16) & 0xff);
    this.array.push((v >> 24) & 0xff);
  }

  public align(amount: number, fill: number = 0) {
    while ((this.array.length % amount) !== 0) {
      this.array.push(fill & 0xff);
    }
  }

  private rewrite8(hint: string): (v: number) => void {
    const i = this.array.length;
    const pending = this.pendingRewrites.length;
    this.pendingRewrites.push(hint);
    this.write8(0);
    return (v: number) => {
      this.pendingRewrites[pending] = false;
      this.array[i] = v & 0xff;
    };
  }

  private rewrite16(hint: string): (v: number) => void {
    const i = this.array.length;
    const pending = this.pendingRewrites.length;
    this.pendingRewrites.push(hint);
    this.write16(0);
    return (v: number) => {
      this.pendingRewrites[pending] = false;
      this.array[i] = v & 0xff;
      this.array[i + 1] = (v >> 8) & 0xff;
    };
  }

  private rewrite32(hint: string): (v: number) => void {
    const i = this.array.length;
    const pending = this.pendingRewrites.length;
    this.pendingRewrites.push(hint);
    this.write32(0);
    return (v: number) => {
      this.pendingRewrites[pending] = false;
      this.array[i] = v & 0xff;
      this.array[i + 1] = (v >> 8) & 0xff;
      this.array[i + 2] = (v >> 16) & 0xff;
      this.array[i + 3] = (v >> 24) & 0xff;
    };
  }

  public expr8(
    hint: string,
    exprs: { [name: string]: Expression | number },
    build: (values: { [name: string]: number }, thisIndex: number) => number,
  ) {
    const thisIndex = this.array.length;
    this.pushPendingExpr({
      hint,
      thisIndex,
      exprs,
      build,
      rewrite: this.rewrite8(hint),
    });
  }

  public expr16(
    hint: string,
    exprs: { [name: string]: Expression | number },
    build: (values: { [name: string]: number }, thisIndex: number) => number,
  ) {
    const thisIndex = this.array.length;
    this.pushPendingExpr({
      hint,
      thisIndex,
      exprs,
      build,
      rewrite: this.rewrite16(hint),
    });
  }

  public expr32(
    hint: string,
    exprs: { [name: string]: Expression | number },
    build: (values: { [name: string]: number }, thisIndex: number) => number,
  ) {
    const thisIndex = this.array.length;
    this.pushPendingExpr({
      hint,
      thisIndex,
      exprs,
      build,
      rewrite: this.rewrite32(hint),
    });
  }

  private pushPendingExpr(pex: IPendingExpr) {
    // inform the exprs of all known labels
    for (const expr of Object.values(pex.exprs)) {
      if (expr instanceof Expression) {
        for (const label of Object.keys(this.labels)) {
          expr.addLabel(label, this.labels[label]);
        }
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
      if (typeof ex === "number") {
        values[name] = ex;
      } else {
        const exv = ex.value();
        if (exv === false) {
          return false;
        }
        values[name] = exv;
      }
    }
    pex.rewrite(pex.build(values, pex.thisIndex));
    return true;
  }

  public addLabel(label: string) {
    if (label in this.labels) {
      throw `Cannot redefine label: ${label}`;
    }

    // add label knowledge
    const v = this.array.length;
    this.labels[label] = v;
    for (const pex of this.pendingExprs) {
      for (const expr of Object.values(pex.exprs)) {
        if (expr instanceof Expression) {
          expr.addLabel(label, v);
        }
      }
    }

    // attempt rewrites
    for (let i = 0; i < this.pendingExprs.length; i++) {
      if (this.attemptExpr(this.pendingExprs[i])) {
        this.pendingExprs.splice(i, 1);
        i--;
      }
    }
  }

  public removeLocalLabels() {
    // TODO: search for rewrites that require local labels
    for (const k of Object.keys(this.labels)) {
      if (k.startsWith("@@")) {
        delete this.labels[k];
      }
    }
  }

  public writeLogo() {
    // deno-fmt-ignore
    this.array.push(
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
      throw "Invalid .crc statement: header too small";
    }
    let crc = -0x19;
    for (let i = 0xa0; i < 0xbd; i++) {
      crc = crc - this.array[i];
    }
    this.array.push(crc & 0xff);
  }
}
