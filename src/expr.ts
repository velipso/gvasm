//
// gvasm - Assembler and disassembler for Game Boy Advance homebrew
// by Sean Connelly (@velipso), https://sean.cm
// The Unlicense License
// Project Home: https://github.com/velipso/gvasm
//

import { assertNever, b16, b32 } from './util.ts';
import { ITok, TokEnum } from './lexer.ts';
import { decodeRegister, isNextId, parseName } from './make.ts';
import { ConstTable } from './const.ts';
import { CPU } from './run.ts';

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
    f: ([a, b, c]) => b <= c ? (a < b ? b : a > c ? c : a) : (a < c ? c : a > b ? b : a),
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
  kind: 'num';
  value: number;
}

interface IExprRegister {
  kind: 'register';
  index: number;
}

interface IExprLabel {
  kind: 'label';
  label: string;
}

interface IExprRead {
  kind: 'read';
  size: 'i8' | 'i16' | 'i32' | 'b8' | 'b16' | 'b32';
  addr: IExpr;
}

interface IExprParam {
  kind: 'param';
  index: number;
}

interface IExprAssert {
  kind: 'assert';
  hint: string;
  value: IExpr;
}

interface IExprReadWithParam {
  kind: 'read';
  size: 'i8' | 'i16' | 'i32' | 'b8' | 'b16' | 'b32';
  addr: IExprWithParam;
}

interface IExprAssertWithParam {
  kind: 'assert';
  hint: string;
  value: IExprWithParam;
}

interface IExprBuild {
  kind: 'build';
  expr: ExpressionBuilder;
  params: IExpr[];
}

interface IExprBuildWithParam {
  kind: 'build';
  expr: ExpressionBuilder;
  params: IExprWithParam[];
}

interface IExprFunc {
  kind: 'func';
  func: string;
  params: IExpr[];
}

interface IExprFuncWithParam {
  kind: 'func';
  func: string;
  params: IExprWithParam[];
}

type UnaryOp =
  | '-'
  | '~'
  | '!'
  | '(';

interface IExprUnary {
  kind: 'unary';
  op: UnaryOp;
  value: IExpr;
}

interface IExprUnaryWithParam {
  kind: 'unary';
  op: UnaryOp;
  value: IExprWithParam;
}

type BinaryOp =
  | '+'
  | '-'
  | '*'
  | '/'
  | '%'
  | '<<'
  | '>>'
  | '>>>'
  | '&'
  | '|'
  | '^'
  | '<'
  | '<='
  | '>'
  | '>='
  | '=='
  | '!='
  | '&&'
  | '||';

interface IExprBinary {
  kind: 'binary';
  op: BinaryOp;
  left: IExpr;
  right: IExpr;
}

interface IExprBinaryWithParam {
  kind: 'binary';
  op: BinaryOp;
  left: IExprWithParam;
  right: IExprWithParam;
}

function isBinaryOp(op: string): op is BinaryOp {
  return (
    op === '+' ||
    op === '-' ||
    op === '*' ||
    op === '/' ||
    op === '%' ||
    op === '<<' ||
    op === '>>' ||
    op === '>>>' ||
    op === '&' ||
    op === '|' ||
    op === '^' ||
    op === '<' ||
    op === '<=' ||
    op === '>' ||
    op === '>=' ||
    op === '==' ||
    op === '!=' ||
    op === '&&' ||
    op === '||'
  );
}

interface IExprTernary {
  kind: '?:';
  condition: IExpr;
  iftrue: IExpr;
  iffalse: IExpr;
}

interface IExprTernaryWithParam {
  kind: '?:';
  condition: IExprWithParam;
  iftrue: IExprWithParam;
  iffalse: IExprWithParam;
}

type IExpr =
  | IExprNum
  | IExprRegister
  | IExprLabel
  | IExprRead
  | IExprAssert
  | IExprBuild
  | IExprFunc
  | IExprUnary
  | IExprBinary
  | IExprTernary;

type IExprWithParam =
  | IExprParam
  | IExprNum
  | IExprRegister
  | IExprLabel
  | IExprReadWithParam
  | IExprAssertWithParam
  | IExprBuildWithParam
  | IExprFuncWithParam
  | IExprUnaryWithParam
  | IExprBinaryWithParam
  | IExprTernaryWithParam;

function parsePrefixName(
  prefix: '@' | '$',
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
  const exp = `${expect} parameter${expect === 1 ? '' : 's'}`;
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
    return new ExpressionBuilder({ kind: 'num', value: num }, new Set(), 0);
  }

  public static parse(
    line: ITok[],
    paramNames: string[],
    ctable: ConstTable,
    regs: false | string[] = false,
  ): ExpressionBuilder | false {
    const labelsNeed: Set<string> = new Set();
    if (
      !(
        line.length > 0 && (
          (
            line[0].kind === TokEnum.ID && (
              line[0].id in functions ||
              line[0].id === 'assert' ||
              line[0].id === 'defined' ||
              line[0].id === '(' ||
              line[0].id === '-' ||
              line[0].id === '+' ||
              line[0].id === '~' ||
              line[0].id === '@' ||
              line[0].id === '$' ||
              line[0].id === '!' ||
              (regs && (
                decodeRegister(regs, line[0].id, true) >= 0 ||
                line[0].id === '[' ||
                line[0].id === 'i8' ||
                line[0].id === 'i16' ||
                line[0].id === 'i32' ||
                line[0].id === 'b8' ||
                line[0].id === 'b16' ||
                line[0].id === 'b32'
              ))
            )
          ) ||
          line[0].kind === TokEnum.NUM
        )
      )
    ) {
      return false;
    }
    const readParams = (params: IExprWithParam[]) => {
      if (!isNextId(line, '(')) {
        throw 'Expecting \'(\' at start of call';
      }
      line.shift();
      while (!isNextId(line, ')')) {
        params.push(term());
        if (isNextId(line, ',')) {
          line.shift();
        } else {
          break;
        }
      }
      if (!isNextId(line, ')')) {
        throw 'Expecting \')\' at end of call';
      }
      line.shift();
    };
    const term = (): IExprWithParam => {
      // collect all unary operators
      const unary: ('+' | '-' | '~' | '!')[] = [];
      while (true) {
        if (isNextId(line, '+')) {
          unary.push('+');
          line.shift();
        } else if (isNextId(line, '-')) {
          unary.push('-');
          line.shift();
        } else if (isNextId(line, '~')) {
          unary.push('~');
          line.shift();
        } else if (isNextId(line, '!')) {
          unary.push('!');
          line.shift();
        } else {
          break;
        }
      }

      // get the terminal
      const t = line.shift();
      let result: IExprWithParam | undefined;
      if (t && t.kind === TokEnum.NUM) {
        result = { kind: 'num', value: t.num };
      } else if (t && t.kind === TokEnum.ID) {
        if (t.id in functions) {
          const params: IExprWithParam[] = [];
          readParams(params);
          if (functions[t.id].size >= 0) {
            checkParamSize(params.length, functions[t.id].size);
          }
          result = { kind: 'func', func: t.id, params };
        } else if (t.id === 'assert') {
          if (!isNextId(line, '(')) {
            throw 'Expecting \'(\' at start of call';
          }
          line.shift();
          const hint = line.shift();
          if (!hint || hint.kind !== TokEnum.STR) {
            throw `Expecting string as first parameter to assert()`;
          }
          if (!isNextId(line, ',')) {
            throw 'Expecting two parameters to assert()';
          }
          line.shift();
          const value = term();
          if (!isNextId(line, ')')) {
            throw 'Expecting \')\' at end of call';
          }
          line.shift();
          result = { kind: 'assert', hint: hint.str, value };
        } else if (t.id === 'defined') {
          if (!isNextId(line, '(')) {
            throw 'Expecting \'(\' at start of call';
          }
          line.shift();
          if (!isNextId(line, '$')) {
            throw `Expecting constant name inside defined()`;
          }
          line.shift();
          const cname = parsePrefixName(
            '$',
            line,
            'Invalid constant inside defined()',
          );
          if (!isNextId(line, ')')) {
            throw 'Expecting \')\' at end of call';
          }
          line.shift();
          result = { kind: 'num', value: ctable.defined(cname) ? 1 : 0 };
        } else if (t.id === '(') {
          result = { kind: 'unary', op: '(', value: term() };
          if (!isNextId(line, ')')) {
            throw 'Expecting close parenthesis';
          }
          line.shift();
        } else if (t.id === '@') {
          const label = parsePrefixName(
            '@',
            line,
            'Invalid label in expression',
          );
          labelsNeed.add(label);
          result = { kind: 'label', label };
        } else if (t.id === '$') {
          const cname = parsePrefixName(
            '$',
            line,
            'Invalid constant in expression',
          );
          if (paramNames.indexOf(cname) >= 0) {
            result = { kind: 'param', index: paramNames.indexOf(cname) };
          } else {
            const params: IExprWithParam[] = [];
            if (isNextId(line, '(')) {
              readParams(params);
            }
            const cvalue = ctable.lookup(cname);
            if (cvalue.kind === 'expr') {
              ExpressionBuilder.propagateLabels(cvalue.expr, labelsNeed);
              result = { kind: 'build', expr: cvalue.expr, params };
            } else {
              throw `Constant cannot be called as an expression: ${cname}`;
            }
          }
        } else if (regs && decodeRegister(regs, t.id, true) >= 0) {
          result = { kind: 'register', index: decodeRegister(regs, t.id, true) };
        } else if (regs && t.id === '[') {
          const addr = term();
          if (!isNextId(line, ']')) {
            throw 'Expecting \']\' at end of memory read';
          }
          line.shift();
          result = { kind: 'read', size: 'i32', addr };
        } else if (
          regs && (
            t.id === 'i8' ||
            t.id === 'i16' ||
            t.id === 'i32' ||
            t.id === 'b8' ||
            t.id === 'b16' ||
            t.id === 'b32'
          )
        ) {
          if (!isNextId(line, '[')) {
            throw 'Expecting \'[\' at start of memory read';
          }
          line.shift();
          const addr = term();
          if (!isNextId(line, ']')) {
            throw 'Expecting \']\' at end of memory read';
          }
          line.shift();
          result = { kind: 'read', size: t.id, addr };
        }
      }
      if (!result) {
        // maybe we parsed a terminal as a unary operator incorrectly...
        if (
          unary.length > 0 && (unary[unary.length - 1] === '+' || unary[unary.length - 1] === '-')
        ) {
          // interpret the tail of the unary array as an anonymous label
          let label = unary.pop() as string; // verified above
          while (unary.length > 0 && unary[unary.length - 1] === label.charAt(0)) {
            label += unary.pop();
          }
          labelsNeed.add(label);
          result = { kind: 'label', label };
        } else {
          throw 'Invalid expression';
        }
      }

      // apply unary operators to the terminal
      while (true) {
        const op = unary.pop();
        if (op && op !== '+') {
          result = { kind: 'unary', op, value: result };
        } else {
          break;
        }
      }

      const precedence = (op: BinaryOp): number => {
        switch (op) {
          case '*':
          case '/':
          case '%':
            return 0;
          case '+':
          case '-':
            return 1;
          case '<<':
          case '>>':
          case '>>>':
            return 2;
          case '&':
            return 3;
          case '^':
            return 4;
          case '|':
            return 5;
          case '<=':
          case '<':
          case '>=':
          case '>':
            return 6;
          case '==':
          case '!=':
            return 7;
          case '&&':
            return 8;
          case '||':
            return 9;
          default:
            assertNever(op);
        }
        return 10;
      };

      const checkPrecedence = (
        left: IExprWithParam,
        op: BinaryOp,
        right: IExprWithParam,
      ): IExprBinaryWithParam => {
        if (right.kind === 'binary') {
          const inner = checkPrecedence(left, op, right.left);
          if (precedence(inner.op) > precedence(right.op)) {
            // inner.left inner.op (inner.right===right.left right.op right.right)
            inner.right = right;
            return inner;
          } else {
            // (inner.left inner.op inner.right===right.left) right.op right.right
            right.left = inner;
            return right;
          }
        } else {
          // right isn't binary, so no conflict of precedence
          return { kind: 'binary', op, left, right };
        }
      };

      // look for binary operators
      if (line.length > 0 && line[0].kind === TokEnum.ID) {
        const id = line[0].id;
        if (isBinaryOp(id)) {
          line.shift();
          result = checkPrecedence(result, id, term());
        } else if (id === '?') {
          line.shift();
          const iftrue = term();
          if (
            line.length <= 0 || line[0].kind !== TokEnum.ID ||
            line[0].id !== ':'
          ) {
            throw 'Invalid operator, missing \':\'';
          }
          line.shift();
          const iffalse = term();
          result = { kind: '?:', condition: result, iftrue, iffalse };
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
        case 'param':
          // convert param to number
          return {
            kind: 'num',
            value: params[ex.index],
          };
        case 'num':
        case 'register':
        case 'label':
          return ex;
        case 'read':
          return {
            kind: 'read',
            size: ex.size,
            addr: walk(ex.addr),
          };
        case 'assert':
          return {
            kind: 'assert',
            hint: ex.hint,
            value: walk(ex.value),
          };
        case 'build':
          return {
            kind: 'build',
            expr: ex.expr,
            params: ex.params.map(walk),
          };
        case 'func':
          return {
            kind: 'func',
            func: ex.func,
            params: ex.params.map(walk),
          };
        case 'unary':
          return {
            kind: 'unary',
            op: ex.op,
            value: walk(ex.value),
          };
        case 'binary':
          return {
            kind: 'binary',
            op: ex.op,
            left: walk(ex.left),
            right: walk(ex.right),
          };
        case '?:':
          return {
            kind: '?:',
            condition: walk(ex.condition),
            iftrue: walk(ex.iftrue),
            iffalse: walk(ex.iffalse),
          };
        default:
          assertNever(ex);
      }
      throw new Error('Unknown expression');
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

  public validateNoLabelsNeeded(hint: string) {
    if (this.labelsNeed.size > 0) {
      throw `${hint}, label${this.labelsNeed.size === 1 ? '' : 's'} not defined: ${
        [...this.labelsNeed].join(', ')
      }`;
    }
  }

  public addLabel(label: string, v: number) {
    if (this.labelsNeed.has(label)) {
      this.labelsNeed.delete(label);
      this.labelsHave[label] = v;
    }
  }

  public value(cpu?: CPU): number | false {
    if (this.labelsNeed.size > 0) {
      return false;
    }
    const get = (ex: IExpr): number => {
      switch (ex.kind) {
        case 'num':
          return ex.value;
        case 'register':
          if (!cpu) {
            throw 'Cannot have register in expression at compile-time';
          }
          return cpu.reg(ex.index);
        case 'label':
          if (ex.label in this.labelsHave) {
            return this.labelsHave[ex.label];
          }
          throw new Error(`Should have label ${ex.label} but it's missing`);
        case 'read': {
          if (!cpu) {
            throw 'Cannot have memory read in expression at compile-time';
          }
          const addr = get(ex.addr);
          switch (ex.size) {
            case 'i8':
            case 'b8':
              return cpu.read8(addr);
            case 'i16':
              return cpu.read16(addr);
            case 'b16':
              return b16(cpu.read16(addr));
            case 'i32':
              return cpu.read32(addr);
            case 'b32':
              return b32(cpu.read32(addr));
            default:
              assertNever(ex.size);
          }
          return 0;
        }
        case 'assert':
          if (get(ex.value) === 0) {
            throw `Failed assertion: ${ex.hint}`;
          }
          return 1;
        case 'build': {
          const ex2 = ex.expr.build(ex.params.map(get));
          for (const [label, v] of Object.entries(this.labelsHave)) {
            ex2.addLabel(label, v);
          }
          const v = ex2.value();
          if (v === false) {
            throw new Error(
              `Missing labels: ${[...ex2.labelsNeed].join(', ')}`,
            );
          }
          return v;
        }
        case 'func': {
          const func = functions[ex.func];
          if (!func) {
            throw new Error(`Unknown function: ${func}`);
          }
          return func.f(ex.params.map(get)) | 0;
        }
        case 'unary':
          switch (ex.op) {
            case '-':
              return -get(ex.value);
            case '~':
              return ~get(ex.value);
            case '!':
              return get(ex.value) === 0 ? 1 : 0;
            case '(':
              return get(ex.value);
            default:
              assertNever(ex);
          }
          break;
        case 'binary':
          switch (ex.op) {
            case '+':
              return (get(ex.left) + get(ex.right)) | 0;
            case '-':
              return (get(ex.left) - get(ex.right)) | 0;
            case '*':
              return (get(ex.left) * get(ex.right)) | 0;
            case '/':
              return (get(ex.left) / get(ex.right)) | 0;
            case '%':
              return (get(ex.left) % get(ex.right)) | 0;
            case '<<':
              return (get(ex.left) << get(ex.right)) | 0;
            case '>>':
              return (get(ex.left) >> get(ex.right)) | 0;
            case '>>>':
              return (get(ex.left) >>> get(ex.right)) | 0;
            case '&':
              return (get(ex.left) & get(ex.right)) | 0;
            case '|':
              return (get(ex.left) | get(ex.right)) | 0;
            case '^':
              return (get(ex.left) ^ get(ex.right)) | 0;
            case '<':
              return get(ex.left) < get(ex.right) ? 1 : 0;
            case '<=':
              return get(ex.left) <= get(ex.right) ? 1 : 0;
            case '>':
              return get(ex.left) > get(ex.right) ? 1 : 0;
            case '>=':
              return get(ex.left) >= get(ex.right) ? 1 : 0;
            case '==':
              return get(ex.left) == get(ex.right) ? 1 : 0;
            case '!=':
              return get(ex.left) != get(ex.right) ? 1 : 0;
            case '&&': {
              const left = get(ex.left);
              const right = get(ex.right);
              return left === 0 ? left : right;
            }
            case '||': {
              const left = get(ex.left);
              const right = get(ex.right);
              return left !== 0 ? left : right;
            }
            default:
              assertNever(ex);
          }
          break;
        case '?:': {
          const condition = get(ex.condition);
          const iftrue = get(ex.iftrue);
          const iffalse = get(ex.iffalse);
          return condition === 0 ? iffalse : iftrue;
        }
        default:
          assertNever(ex);
      }
      throw new Error('Unknown expression');
    };
    return get(this.expr);
  }
}
