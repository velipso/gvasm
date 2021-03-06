//
// gvasm - Assembler and disassembler for Game Boy Advance homebrew
// by Sean Connelly (@velipso), https://sean.cm
// The Unlicense License
// Project Home: https://github.com/velipso/gvasm
//

import { ExpressionBuilder } from './expr.ts';

interface IConstMacro {
  kind: 'macro';
  // TODO: this
}

interface IConstExpr {
  kind: 'expr';
  paramNames: string[];
  expr: ExpressionBuilder;
}

interface IConstTokens {
  kind: 'tokens';
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
  private macroParams: IMacroParamTable[] = [{}];
  private nativeConsts: string[];
  private lookupNative: (cname: string) => number | false;

  constructor(nativeConsts: string[], lookupNative: (cname: string) => number | false) {
    this.nativeConsts = nativeConsts;
    this.lookupNative = lookupNative;
  }

  public scopeBegin() {
    this.locals.unshift({});
  }

  public scopeEnd() {
    if (this.locals.length > 1) {
      this.locals.shift();
    } else {
      throw 'Statement .end is missing matching .begin';
    }
  }

  public def(cname: string, paramNames: string[], expr: ExpressionBuilder) {
    paramNames.forEach(this.checkName);
    this.defConst(cname, { kind: 'expr', paramNames, expr });
  }

  public defNum(cname: string, num: number) {
    this.defConst(cname, {
      kind: 'expr',
      paramNames: [],
      expr: ExpressionBuilder.fromNum(num),
    });
  }

  private checkName(cname: string) {
    if (cname.startsWith('$_')) {
      throw `Cannot define name starting with "$_" (reserved): ${cname}`;
    }
  }

  private defConst(cname: string, con: IConstMacro | IConstExpr) {
    this.checkName(cname);
    const scope = cname.startsWith('$$') ? this.locals[0] : this.globals;
    if (cname in scope) {
      throw `Cannot redefine: ${cname}`;
    }
    scope[cname] = con;
  }

  public defined(cname: string): boolean {
    if (cname.startsWith('$_')) {
      return this.lookupNative(cname.toLowerCase()) !== false;
    } else {
      if (cname in this.macroParams[0]) {
        return true;
      }
      const scope = cname.startsWith('$$') ? this.locals[0] : this.globals;
      return cname in scope;
    }
  }

  public lookup(cname: string): IConstMacro | IConstExpr | IConstTokens {
    if (cname.startsWith('$_')) {
      const num = this.lookupNative(cname.toLowerCase());
      if (num !== false) {
        return {
          kind: 'expr',
          paramNames: [],
          expr: ExpressionBuilder.fromNum(num),
        };
      }
    } else {
      if (cname in this.macroParams[0]) {
        return this.macroParams[0][cname];
      }
      const scope = cname.startsWith('$$') ? this.locals[0] : this.globals;
      if (cname in scope) {
        return scope[cname];
      }
    }
    throw `Unknown constant: ${cname}`;
  }

  public listScope(): string[] {
    return [
      ...this.nativeConsts,
      ...Object.keys(this.globals),
      ...Object.keys(this.locals[0]),
    ];
  }
}
