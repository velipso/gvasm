//
// gbasm - Assembler and disassembler for Game Boy Advance homebrew
// by Sean Connelly (@velipso), https://sean.cm
// The Unlicense License
// Project Home: https://github.com/velipso/gbasm
//

import { assertNever } from "./util.ts";
import { isIdentStart, ITok, TokEnum } from "./lexer.ts";

interface IExprNum {
  kind: "num";
  value: number;
}

interface IExprLabel {
  kind: "label";
  label: string;
}

interface IExprUnary {
  kind:
    | "neg"
    | "~"
    | "(";
  value: IExpr;
}

interface IExprBinary {
  kind:
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
    | "^";
  left: IExpr;
  right: IExpr;
}

interface IExprTernary {
  kind: "?:";
  condition: IExpr;
  iftrue: IExpr;
  iffalse: IExpr;
}

type IExpr =
  | IExprNum
  | IExprLabel
  | IExprUnary
  | IExprBinary
  | IExprTernary;

export class Expression {
  private expr: IExpr;
  private labelsNeed: string[];
  private labelsHave: { [label: string]: number };

  private constructor(expr: IExpr, labelsNeed: string[]) {
    this.expr = expr;
    this.labelsNeed = labelsNeed;
    this.labelsHave = {};
  }

  public static parse(
    line: ITok[],
    labels: { [label: string]: number } = {},
  ): Expression | false {
    const labelsNeed: string[] = [];
    if (
      line.length > 0 && (
        (
          line[0].kind === TokEnum.ID && (
            line[0].id === "(" ||
            line[0].id === "-" ||
            line[0].id === "+" ||
            line[0].id === "~" ||
            line[0].id === "@" ||
            line[0].id === "$"
          )
        ) ||
        line[0].kind === TokEnum.NUM
      )
    ) {
      const term = (): IExpr => {
        const t = line.shift();
        if (!t) {
          throw "Invalid expression";
        }
        if (t.kind === TokEnum.NUM) {
          return { kind: "num", value: t.num };
        } else if (t.kind === TokEnum.ID) {
          if (t.id === "(") {
            throw "TODO: paren";
          } else if (t.id === "-") {
            throw "TODO: unary -";
          } else if (t.id === "+") {
            throw "TODO: unary +";
          } else if (t.id === "~") {
            throw "TODO: unary ~";
          } else if (t.id === "@") {
            let label = "@";
            if (
              line.length > 0 && line[0].kind === TokEnum.ID &&
              line[0].id === "@"
            ) {
              label += "@";
              line.shift();
            }
            if (
              line.length > 0 && line[0].kind === TokEnum.ID &&
              isIdentStart(line[0].id.charAt(0))
            ) {
              label += line[0].id;
              line.shift();
              labelsNeed.push(label);
              return { kind: "label", label };
            } else {
              throw "Invalid label in expression";
            }
          } else if (t.id === "$") {
            throw "TODO: $ constant";
          }
        }
        throw "Invalid expression";
      };

      return new Expression(term(), labelsNeed);
    }
    return false;
  }

  public addLabel(label: string, v: number) {
    const p = this.labelsNeed.indexOf(label);
    if (p < 0) {
      return;
    }
    this.labelsNeed.splice(p, 1);
    this.labelsHave[label] = v;
  }

  public value(): number | false {
    if (this.labelsNeed.length > 0) {
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
        case "neg":
          return -get(ex.value);
        case "~":
          return ~get(ex.value);
        case "(":
          return get(ex.value);
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
