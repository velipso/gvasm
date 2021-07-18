//
// gvasm - Assembler and disassembler for Game Boy Advance homebrew
// by Sean Connelly (@velipso), https://sean.cm
// The Unlicense License
// Project Home: https://github.com/velipso/gvasm
//

import { assertNever } from "./util.ts";
import { ITok, TokEnum } from "./lexer.ts";
import { isNextId, parseName } from "./make.ts";
import { ConstTable } from "./const.ts";

interface IFunctions {
  [name: string]: {
    size: number;
    f(p: number[]): number;
  };
}

const functions: IFunctions = Object.freeze({
  abs: { size: 1, f: ([a]) => Math.abs(a) },
  clamp: {
    size: 3,
    f: ([a, b, c]) =>
      b <= c ? (a < b ? b : a > c ? c : a) : (a < c ? c : a > b ? b : a),
  },
  log2: { size: 1, f: ([a]) => Math.log2(a) },
  max: { size: -1, f: (p) => Math.max(...p) },
  min: { size: -1, f: (p) => Math.min(...p) },
  nrt: { size: 2, f: ([a, b]) => Math.pow(a, 1 / b) },
  pow: { size: 2, f: ([a, b]) => Math.pow(a, b) },
  rgb: {
    size: 3,
    f: ([r, g, b]) =>
      ((b & 0x1f) << 10) |
      ((g & 0x1f) << 5) |
      (r & 0x1f),
  },
  sign: { size: 1, f: ([a]) => Math.sign(a) },
  sqrt: { size: 1, f: ([a]) => Math.sqrt(Math.abs(a)) },
});

interface IExprNum {
  kind: "num";
  value: number;
}

interface IExprLabel {
  kind: "label";
  label: string;
}

interface IExprParam {
  kind: "param";
  index: number;
}

interface IExprAssert {
  kind: "assert";
  hint: string;
  value: IExpr;
}

interface IExprAssertWithParam {
  kind: "assert";
  hint: string;
  value: IExprWithParam;
}

interface IExprBuild {
  kind: "build";
  expr: ExpressionBuilder;
  params: IExpr[];
}

interface IExprBuildWithParam {
  kind: "build";
  expr: ExpressionBuilder;
  params: IExprWithParam[];
}

interface IExprFunc {
  kind: "func";
  func: string;
  params: IExpr[];
}

interface IExprFuncWithParam {
  kind: "func";
  func: string;
  params: IExprWithParam[];
}

type UnaryOp =
  | "neg"
  | "~"
  | "!"
  | "(";

interface IExprUnary {
  kind: "unary";
  op: UnaryOp;
  value: IExpr;
}

interface IExprUnaryWithParam {
  kind: "unary";
  op: UnaryOp;
  value: IExprWithParam;
}

type BinaryOp =
  | "+"
  | "-"
  | "*"
  | "/"
  | "%"
  | "<<"
  | ">>"
  | ">>>"
  | "&"
  | "|"
  | "^"
  | "<"
  | "<="
  | ">"
  | ">="
  | "=="
  | "!="
  | "&&"
  | "||";

interface IExprBinary {
  kind: "binary";
  op: BinaryOp;
  left: IExpr;
  right: IExpr;
}

interface IExprBinaryWithParam {
  kind: "binary";
  op: BinaryOp;
  left: IExprWithParam;
  right: IExprWithParam;
}

function isBinaryOp(op: string): op is BinaryOp {
  return (
    op === "+" ||
    op === "-" ||
    op === "*" ||
    op === "/" ||
    op === "%" ||
    op === "<<" ||
    op === ">>" ||
    op === ">>>" ||
    op === "&" ||
    op === "|" ||
    op === "^" ||
    op === "<" ||
    op === "<=" ||
    op === ">" ||
    op === ">=" ||
    op === "==" ||
    op === "!=" ||
    op === "&&" ||
    op === "||"
  );
}

interface IExprTernary {
  kind: "?:";
  condition: IExpr;
  iftrue: IExpr;
  iffalse: IExpr;
}

interface IExprTernaryWithParam {
  kind: "?:";
  condition: IExprWithParam;
  iftrue: IExprWithParam;
  iffalse: IExprWithParam;
}

type IExpr =
  | IExprNum
  | IExprLabel
  | IExprAssert
  | IExprBuild
  | IExprFunc
  | IExprUnary
  | IExprBinary
  | IExprTernary;

type IExprWithParam =
  | IExprParam
  | IExprNum
  | IExprLabel
  | IExprAssertWithParam
  | IExprBuildWithParam
  | IExprFuncWithParam
  | IExprUnaryWithParam
  | IExprBinaryWithParam
  | IExprTernaryWithParam;

function parsePrefixName(
  prefix: "@" | "$",
  line: ITok[],
  error: string,
): string {
  let p = prefix;
  if (isNextId(line, prefix)) {
    p += prefix;
    line.shift();
  }
  const name = parseName(line);
  if (name === false) {
    throw error;
  }
  return p + name;
}

function checkParamSize(got: number, expect: number) {
  if (got === expect) {
    return;
  }
  const exp = `${expect} parameter${expect === 1 ? "" : "s"}`;
  const err = `expecting ${exp}, but got ${got} instead`;
  if (got < expect) {
    throw `Too few parameters; ${err}`;
  } else {
    throw `Too many parameters; ${err}`;
  }
}

export class ExpressionBuilder {
  private expr: IExprWithParam;
  private labelsNeed: Set<string>;
  private labelsHave: { [label: string]: number };
  private paramsLength: number;

  private constructor(
    expr: IExprWithParam,
    labelsNeed: Set<string>,
    paramsLength: number,
  ) {
    this.expr = expr;
    this.labelsNeed = labelsNeed;
    this.labelsHave = {};
    this.paramsLength = paramsLength;
  }

  public static fromNum(num: number) {
    return new ExpressionBuilder({ kind: "num", value: num }, new Set(), 0);
  }

  public static parse(
    line: ITok[],
    paramNames: string[],
    ctable: ConstTable,
  ): ExpressionBuilder | false {
    const labelsNeed: Set<string> = new Set();
    if (
      !(
        line.length > 0 && (
          (
            line[0].kind === TokEnum.ID && (
              line[0].id in functions ||
              line[0].id === "assert" ||
              line[0].id === "(" ||
              line[0].id === "-" ||
              line[0].id === "+" ||
              line[0].id === "~" ||
              line[0].id === "@" ||
              line[0].id === "$" ||
              line[0].id === "!"
            )
          ) ||
          line[0].kind === TokEnum.NUM
        )
      )
    ) {
      return false;
    }
    const readParams = (params: IExprWithParam[]) => {
      if (!isNextId(line, "(")) {
        throw "Expecting '(' at start of call";
      }
      line.shift();
      while (!isNextId(line, ")")) {
        params.push(term());
        if (isNextId(line, ",")) {
          line.shift();
        } else {
          break;
        }
      }
      if (!isNextId(line, ")")) {
        throw "Expecting ')' at end of call";
      }
      line.shift();
    };
    const term = (): IExprWithParam => {
      // collect all unary operators
      const unary: ("neg" | "~" | "!")[] = [];
      while (true) {
        if (isNextId(line, "+")) {
          line.shift();
        } else if (isNextId(line, "-")) {
          unary.push("neg");
          line.shift();
        } else if (isNextId(line, "~")) {
          unary.push("~");
          line.shift();
        } else if (isNextId(line, "!")) {
          unary.push("!");
          line.shift();
        } else {
          break;
        }
      }

      // get the terminal
      const t = line.shift();
      if (!t) {
        throw "Invalid expression";
      }
      let result: IExprWithParam | undefined;
      if (t.kind === TokEnum.NUM) {
        result = { kind: "num", value: t.num };
      } else if (t.kind === TokEnum.ID) {
        if (t.id in functions) {
          const params: IExprWithParam[] = [];
          readParams(params);
          if (functions[t.id].size >= 0) {
            checkParamSize(params.length, functions[t.id].size);
          }
          result = { kind: "func", func: t.id, params };
        } else if (t.id === "assert") {
          if (!isNextId(line, "(")) {
            throw "Expecting '(' at start of call";
          }
          line.shift();
          const hint = line.shift();
          if (!hint || hint.kind !== TokEnum.STR) {
            throw `Expecting string as first parameter to assert()`;
          }
          if (!isNextId(line, ",")) {
            throw "Expecting two parameters to assert()";
          }
          line.shift();
          const value = term();
          if (!isNextId(line, ")")) {
            throw "Expecting ')' at end of call";
          }
          line.shift();
          result = { kind: "assert", hint: hint.str, value };
        } else if (t.id === "(") {
          result = { kind: "unary", op: "(", value: term() };
          if (!isNextId(line, ")")) {
            throw "Expecting close parenthesis";
          }
          line.shift();
        } else if (t.id === "@") {
          const label = parsePrefixName(
            "@",
            line,
            "Invalid label in expression",
          );
          labelsNeed.add(label);
          result = { kind: "label", label };
        } else if (t.id === "$") {
          const cname = parsePrefixName(
            "$",
            line,
            "Invalid constant in expression",
          );
          if (paramNames.indexOf(cname) >= 0) {
            result = { kind: "param", index: paramNames.indexOf(cname) };
          } else {
            const params: IExprWithParam[] = [];
            if (isNextId(line, "(")) {
              readParams(params);
            }
            const cvalue = ctable.lookup(cname);
            if (cvalue.kind === "expr") {
              ExpressionBuilder.propagateLabels(cvalue.expr, labelsNeed);
              result = { kind: "build", expr: cvalue.expr, params };
            } else {
              throw `Constant cannot be called as an expression: ${cname}`;
            }
          }
        }
      }
      if (!result) {
        throw "Invalid expression";
      }

      // apply unary operators to the terminal
      while (true) {
        const op = unary.pop();
        if (op) {
          result = { kind: "unary", op, value: result };
        } else {
          break;
        }
      }

      const precedence = (op: BinaryOp): number => {
        switch (op) {
          case "*":
          case "/":
          case "%":
            return 0;
          case "+":
          case "-":
            return 1;
          case "<<":
          case ">>":
          case ">>>":
            return 2;
          case "&":
            return 3;
          case "^":
            return 4;
          case "|":
            return 5;
          case "<=":
          case "<":
          case ">=":
          case ">":
            return 6;
          case "==":
          case "!=":
            return 7;
          case "&&":
            return 8;
          case "||":
            return 9;
          default:
            assertNever(op);
        }
        return 10;
      };

      // look for binary operators
      if (line.length > 0 && line[0].kind === TokEnum.ID) {
        const id = line[0].id;
        if (isBinaryOp(id)) {
          line.shift();
          const right = term();
          if (
            right.kind === "binary" && precedence(id) <= precedence(right.op)
          ) {
            // (result id right.left) right.kind right.right
            result = {
              kind: "binary",
              op: right.op,
              left: { kind: "binary", op: id, left: result, right: right.left },
              right: right.right,
            };
          } else {
            // result id (right.left right.kind right.right)
            result = { kind: "binary", op: id, left: result, right };
          }
        } else if (id === "?") {
          line.shift();
          const iftrue = term();
          if (
            line.length <= 0 || line[0].kind !== TokEnum.ID ||
            line[0].id !== ":"
          ) {
            throw "Invalid operator, missing ':'";
          }
          line.shift();
          const iffalse = term();
          result = { kind: "?:", condition: result, iftrue, iffalse };
        }
      }

      return result;
    };

    return new ExpressionBuilder(term(), labelsNeed, paramNames.length);
  }

  private static propagateLabels(src: ExpressionBuilder, tgt: Set<string>) {
    for (const label of src.labelsNeed) {
      tgt.add(label);
    }
  }

  public build(params: number[]): Expression {
    checkParamSize(params.length, this.paramsLength);

    // walk the tree and convert IExprParam to the finalized number
    const walk = (ex: IExprWithParam): IExpr => {
      switch (ex.kind) {
        case "param":
          // convert param to number
          return {
            kind: "num",
            value: params[ex.index],
          };
        case "num":
        case "label":
          return ex;
        case "assert":
          return {
            kind: "assert",
            hint: ex.hint,
            value: walk(ex.value),
          };
        case "build":
          return {
            kind: "build",
            expr: ex.expr,
            params: ex.params.map(walk),
          };
        case "func":
          return {
            kind: "func",
            func: ex.func,
            params: ex.params.map(walk),
          };
        case "unary":
          return {
            kind: "unary",
            op: ex.op,
            value: walk(ex.value),
          };
        case "binary":
          return {
            kind: "binary",
            op: ex.op,
            left: walk(ex.left),
            right: walk(ex.right),
          };
        case "?:":
          return {
            kind: "?:",
            condition: walk(ex.condition),
            iftrue: walk(ex.iftrue),
            iffalse: walk(ex.iffalse),
          };
        default:
          assertNever(ex);
      }
      throw new Error("Unknown expression");
    };

    return new Expression(walk(this.expr), this.labelsNeed);
  }
}

export class Expression {
  private expr: IExpr;
  private labelsNeed: Set<string>;
  private labelsHave: { [label: string]: number };

  constructor(expr: IExpr, labelsNeed: Set<string>) {
    this.expr = expr;
    this.labelsNeed = new Set(labelsNeed);
    this.labelsHave = {};
  }

  public getLabelsNeed(): Set<string> {
    return this.labelsNeed;
  }

  public addLabel(label: string, v: number) {
    if (this.labelsNeed.has(label)) {
      this.labelsNeed.delete(label);
      this.labelsHave[label] = v;
    }
  }

  public value(): number | false {
    if (this.labelsNeed.size > 0) {
      return false;
    }
    const get = (ex: IExpr): number => {
      switch (ex.kind) {
        case "num":
          return ex.value;
        case "label":
          if (ex.label in this.labelsHave) {
            return this.labelsHave[ex.label];
          }
          throw new Error(`Should have label ${ex.label} but it's missing`);
        case "assert":
          if (get(ex.value) === 0) {
            throw `Failed assertion: ${ex.hint}`;
          }
          return 1;
        case "build": {
          const ex2 = ex.expr.build(ex.params.map(get));
          for (const [label, v] of Object.entries(this.labelsHave)) {
            ex2.addLabel(label, v);
          }
          const v = ex2.value();
          if (v === false) {
            throw new Error(
              `Missing labels: ${[...ex2.getLabelsNeed()].join(", ")}`,
            );
          }
          return v;
        }
        case "func": {
          const func = functions[ex.func];
          if (!func) {
            throw new Error(`Unknown function: ${func}`);
          }
          return func.f(ex.params.map(get)) | 0;
        }
        case "unary":
          switch (ex.op) {
            case "neg":
              return -get(ex.value);
            case "~":
              return ~get(ex.value);
            case "!":
              return get(ex.value) === 0 ? 1 : 0;
            case "(":
              return get(ex.value);
            default:
              assertNever(ex);
          }
          break;
        case "binary":
          switch (ex.op) {
            case "+":
              return (get(ex.left) + get(ex.right)) | 0;
            case "-":
              return (get(ex.left) - get(ex.right)) | 0;
            case "*":
              return (get(ex.left) * get(ex.right)) | 0;
            case "/":
              return (get(ex.left) / get(ex.right)) | 0;
            case "%":
              return (get(ex.left) % get(ex.right)) | 0;
            case "<<":
              return (get(ex.left) << get(ex.right)) | 0;
            case ">>":
              return (get(ex.left) >> get(ex.right)) | 0;
            case ">>>":
              return (get(ex.left) >>> get(ex.right)) | 0;
            case "&":
              return (get(ex.left) & get(ex.right)) | 0;
            case "|":
              return (get(ex.left) | get(ex.right)) | 0;
            case "^":
              return (get(ex.left) ^ get(ex.right)) | 0;
            case "<":
              return get(ex.left) < get(ex.right) ? 1 : 0;
            case "<=":
              return get(ex.left) <= get(ex.right) ? 1 : 0;
            case ">":
              return get(ex.left) > get(ex.right) ? 1 : 0;
            case ">=":
              return get(ex.left) >= get(ex.right) ? 1 : 0;
            case "==":
              return get(ex.left) == get(ex.right) ? 1 : 0;
            case "!=":
              return get(ex.left) != get(ex.right) ? 1 : 0;
            case "&&": {
              const left = get(ex.left);
              const right = get(ex.right);
              return left === 0 ? left : right;
            }
            case "||": {
              const left = get(ex.left);
              const right = get(ex.right);
              return left !== 0 ? left : right;
            }
            default:
              assertNever(ex);
          }
          break;
        case "?:": {
          const condition = get(ex.condition);
          const iftrue = get(ex.iftrue);
          const iffalse = get(ex.iffalse);
          return condition === 0 ? iffalse : iftrue;
        }
        default:
          assertNever(ex);
      }
      throw new Error("Unknown expression");
    };
    return get(this.expr);
  }
}
