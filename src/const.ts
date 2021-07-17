//
// gvasm - Assembler and disassembler for Game Boy Advance homebrew
// by Sean Connelly (@velipso), https://sean.cm
// The Unlicense License
// Project Home: https://github.com/velipso/gvasm
//

import { ExpressionBuilder } from "./expr.ts";
import { assertNever } from "./util.ts";

interface IConstMacro {
  kind: "macro";
  // TODO: this
}

interface IConstExpr {
  kind: "expr";
  paramNames: string[];
  expr: ExpressionBuilder;
}

interface IConstTokens {
  kind: "tokens";
  // TODO: this
}

interface IConstTable {
  [cname: string]: IConstMacro | IConstExpr;
}

interface IMacroParamTable {
  [cname: string]: IConstTokens;
}

export class ConstTable {
  private globals: IConstTable = {};
  private locals: IConstTable[] = [{}];
  private macroParams: IMacroParamTable[] = [];

  public defx(cname: string, paramNames: string[], expr: ExpressionBuilder) {
    this.def(cname, { kind: "expr", paramNames, expr });
  }

  private def(cname: string, con: IConstMacro | IConstExpr) {
    const scope = cname.startsWith("$$") ? this.locals[0] : this.globals;
    if (cname in scope) {
      throw `Cannot redefine: ${cname}`;
    }
    scope[cname] = con;
  }

  public lookup(cname: string): IConstMacro | IConstExpr | IConstTokens {
    for (const mp of this.macroParams) {
      if (cname in mp) {
        return mp[cname];
      }
    }
    for (const local of this.locals) {
      if (cname in local) {
        return local[cname];
      }
    }
    if (cname in this.globals) {
      return this.globals[cname];
    }
    throw `Unknown constant: ${cname}`;
  }
}
