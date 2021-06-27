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
    | "!"
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

function isBinary(ex: IExpr): ex is IExprBinary {
  return (
    ex.kind === "+" ||
    ex.kind === "-" ||
    ex.kind === "*" ||
    ex.kind === "/" ||
    ex.kind === "%" ||
    ex.kind === "<<" ||
    ex.kind === ">>" ||
    ex.kind === ">>>" ||
    ex.kind === "&" ||
    ex.kind === "|" ||
    ex.kind === "^"
  );
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

  public getLabelsNeed(): readonly string[] {
    return this.labelsNeed;
  }

  public static parse(line: ITok[]): Expression | false {
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
            line[0].id === "$" ||
            line[0].id === "!"
          )
        ) ||
        line[0].kind === TokEnum.NUM
      )
    ) {
      const term = (): IExpr => {
        // collect all unary operators
        const unary: ("neg" | "~" | "!")[] = [];
        while (line.length > 0 && line[0].kind === TokEnum.ID) {
          if (line[0].id === "+") {
            line.shift();
          } else if (line[0].id === "-") {
            unary.push("neg");
            line.shift();
          } else if (line[0].id === "~") {
            unary.push("~");
            line.shift();
          } else if (line[0].id === "!") {
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
        let result: IExpr | undefined;
        if (t.kind === TokEnum.NUM) {
          result = { kind: "num", value: t.num };
        } else if (t.kind === TokEnum.ID) {
          if (t.id === "(") {
            result = { kind: "(", value: term() };
            if (
              line.length <= 0 || line[0].kind !== TokEnum.ID ||
              line[0].id !== ")"
            ) {
              throw "Expecting close parenthesis";
            }
            line.shift();
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
              result = { kind: "label", label };
            } else {
              throw "Invalid label in expression";
            }
          } else if (t.id === "$") {
            throw "TODO: $ constant";
          }
        }
        if (!result) {
          throw "Invalid expression";
        }

        // apply unary operators to the terminal
        while (true) {
          const kind = unary.pop();
          if (kind) {
            result = { kind, value: result };
          } else {
            break;
          }
        }

        const precedence = (op: IExprBinary["kind"]): number => {
          switch (op) {
            case "+":
            case "-":
              return 1;
            case "*":
            case "/":
            case "%":
              return 0;
            case "<<":
            case ">>":
            case ">>>":
              return 2;
            case "&":
              return 3;
            case "|":
              return 5;
            case "^":
              return 4;
            default:
              assertNever(op);
          }
          return 6;
        };

        // look for binary operators
        if (line.length > 0 && line[0].kind === TokEnum.ID) {
          const id = line[0].id;
          if (
            id === "+" ||
            id === "-" ||
            id === "*" ||
            id === "/" ||
            id === "%" ||
            id === "<<" ||
            id === ">>" ||
            id === ">>>" ||
            id === "&" ||
            id === "|" ||
            id === "^"
          ) {
            line.shift();
            const right = term();
            if (isBinary(right) && precedence(id) <= precedence(right.kind)) {
              // (result id right.left) right.kind right.right
              result = {
                kind: right.kind,
                left: { kind: id, left: result, right: right.left },
                right: right.right,
              };
            } else {
              // result id (right.left right.kind right.right)
              result = { kind: id, left: result, right };
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
        case "!":
          return get(ex.value) === 0 ? 1 : 0;
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
