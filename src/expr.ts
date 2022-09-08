//
// gvasm - Assembler and disassembler for Game Boy Advance homebrew
// by Sean Connelly (@velipso), https://sean.cm
// Project Home: https://github.com/velipso/gvasm
// SPDX-License-Identifier: 0BSD
//

import { assertNever } from './util.ts';
import { CompError, Parser } from './parser.ts';
import { Import, IPendingWriteContext } from './import.ts';
import { IFilePos, ITok } from './lexer.ts';
import { version } from './main.ts';

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

export const reservedNames = Object.freeze([
  ...Object.keys(functions),
  'assert',
  'defined',
  '_arm',
  '_base',
  '_bytes',
  '_here',
  '_main',
  '_pc',
  '_thumb',
  '_version',
]);

interface IExprNum {
  kind: 'num';
  value: number;
}

interface IExprReserved {
  kind: 'reserved';
  flp: IFilePos;
  name:
    | '_arm'
    | '_base'
    | '_bytes'
    | '_here'
    | '_main'
    | '_pc'
    | '_thumb'
    | '_version';
}

interface IExprParam {
  kind: 'param';
  param: number;
}

export interface IExprLookup {
  kind: 'lookup';
  flp: IFilePos;
  idPath: (string | Expression)[];
  params: IExpr[] | false;
}

interface IExprRead {
  kind: 'read';
  size: 'i8' | 'i16' | 'i32' | 'b8' | 'b16' | 'b32';
  addr: IExpr;
}

interface IExprAssert {
  kind: 'assert';
  flp: IFilePos;
  hint: string;
  value: IExpr;
}

interface IExprDefined {
  kind: 'defined';
  value: IExpr;
}

interface IExprFunc {
  kind: 'func';
  func: string;
  params: IExpr[];
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

type IExpr =
  | IExprNum
  | IExprReserved
  | IExprLookup
  | IExprParam
  | IExprRead
  | IExprAssert
  | IExprDefined
  | IExprFunc
  | IExprUnary
  | IExprBinary
  | IExprTernary;

function checkParamSize(flp: IFilePos, got: number, expect: number) {
  if (got === expect) {
    return;
  }
  const exp = `${expect} parameter${expect === 1 ? '' : 's'}`;
  const err = `expecting ${exp}, but got ${got} instead`;
  if (got < expect) {
    throw new CompError(flp, `Too few parameters; ${err}`);
  } else {
    throw new CompError(flp, `Too many parameters; ${err}`);
  }
}

interface ITokUnary extends IFilePos {
  kind: 'punc';
  punc: UnaryOp | '+';
}

function isTokUnary(t: ITok): t is ITokUnary {
  return t.kind === 'punc' && (
    t.punc === '+' ||
    t.punc === '-' ||
    t.punc === '~' ||
    t.punc === '!'
  );
}

// 'allow'      - allow lookups to fail
// 'unresolved' - fail if lookup isn't found
// 'deny'       - fail if lookup isn't found, or doesn't have a value
export type LookupFailMode = 'allow' | 'unresolved' | 'deny';

export class Expression {
  private expr: IExpr;
  paramSize: number;

  private constructor(expr: IExpr, paramSize: number) {
    this.expr = expr;
    this.paramSize = paramSize;
  }

  static fromNum(num: number) {
    return new Expression({ kind: 'num', value: num }, -1);
  }

  static parse(parser: Parser, imp: Import, paramNames?: string[]): Expression {
    const readParams = (): IExpr[] => {
      const params: IExpr[] = [];
      if (!parser.isNext('(')) {
        throw new CompError(parser.here(), 'Expecting \'(\' at start of call');
      }
      parser.nextTok();
      while (!parser.isNext(')')) {
        params.push(term());
        if (parser.isNext(',')) {
          parser.nextTok();
        } else {
          break;
        }
      }
      if (!parser.isNext(')')) {
        throw new CompError(parser.here(), 'Expecting \')\' at end of call');
      }
      parser.nextTok();
      return params;
    };

    const term = (): IExpr => {
      // collect all unary operators
      let t = parser.nextTokOptional();
      const unary: ITokUnary[] = [];
      while (t) {
        if (t && isTokUnary(t)) {
          unary.push(t);
          t = parser.nextTokOptional();
        } else {
          break;
        }
      }

      // get the terminal
      let value: IExpr | undefined;
      if (t && t.kind === 'num') {
        value = { kind: 'num', value: t.num };
      } else if (t && t.kind === 'punc' && t.punc === '(') {
        value = { kind: 'unary', op: '(', value: term() };
        if (!parser.isNext(')')) {
          throw 'Expecting close parenthesis';
        }
        parser.nextTok();
      } else if (t && t.kind === 'id') {
        if (t.id in functions) {
          const params = readParams();
          if (functions[t.id].size >= 0) {
            checkParamSize(t, params.length, functions[t.id].size);
          }
          value = { kind: 'func', func: t.id, params };
        } else if (t.id === 'assert') {
          if (!parser.isNext('(')) {
            throw 'Expecting \'(\' at start of call';
          }
          parser.nextTok();
          const hint = parser.nextTokOptional();
          if (!hint || hint.kind !== 'str') {
            throw `Expecting string as first parameter to assert()`;
          }
          if (!parser.isNext(',')) {
            throw 'Expecting two parameters to assert()';
          }
          parser.nextTok();
          const v = term();
          if (!parser.isNext(')')) {
            throw 'Expecting \')\' at end of call';
          }
          parser.nextTok();
          value = { kind: 'assert', flp: t, hint: hint.str, value: v };
        } else if (t.id === 'defined') {
          const params = readParams();
          checkParamSize(t, params.length, 1);
          value = { kind: 'defined', value: params[0] };
        } else if (!imp.isRegister(t.id)) {
          const idPath: (string | Expression)[] = [t.id];
          while (true) {
            if (parser.isNext('.')) {
              const tp = parser.nextTok();
              const t2 = parser.nextTokOptional();
              if (!t2) throw new CompError(tp, 'Invalid expression');
              if (t2.kind !== 'id') throw new CompError(t2, 'Invalid expression');
              idPath.push(t2.id);
            } else if (parser.isNext('[')) {
              const tp = parser.nextTok();
              if (!parser.hasTok()) throw new CompError(tp, 'Invalid expression');
              idPath.push(new Expression(term(), -1));
              if (!parser.isNext(']')) throw new CompError(tp, 'Invalid expression');
              parser.nextTok();
            } else {
              break;
            }
          }
          const idPath0 = t.id;
          if (paramNames && paramNames.indexOf(idPath0) >= 0) {
            if (idPath.length > 1) {
              throw new CompError(t, 'Cannot index into parameter');
            }
            value = { kind: 'param', param: paramNames.indexOf(idPath0) };
          } else {
            switch (idPath0) {
              case '_arm':
              case '_base':
              case '_bytes':
              case '_here':
              case '_main':
              case '_pc':
              case '_thumb':
              case '_version':
                if (idPath.length > 1) {
                  throw new CompError(t, 'Cannot index into number');
                }
                if (parser.isNext('(')) {
                  throw new CompError(parser.here(), 'Reserved identifier cannot be called');
                }
                value = { kind: 'reserved', flp: t, name: idPath0 };
                break;
              default:
                value = { kind: 'lookup', flp: t, idPath, params: false };
                if (parser.isNext('(')) {
                  const pexpr: IExpr[] = [];
                  parser.nextTok();
                  while (!parser.isNext(')')) {
                    pexpr.push(term());
                    if (parser.isNext(',')) {
                      parser.nextTok();
                      continue;
                    } else if (parser.isNext(')')) {
                      break;
                    } else {
                      throw new CompError(parser.here(), 'Expecting parameters in call');
                    }
                  }
                  parser.nextTok();
                  value.params = pexpr;
                }
                break;
            }
          }
          /*
        } else if (regs && t.id === '[') {
          const addr = term();
          if (!isNextId(line, ']')) {
            throw 'Expecting \']\' at end of memory read';
          }
          line.shift();
          value = { kind: 'read', size: 'i32', addr };
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
          value = { kind: 'read', size: t.id, addr };
          */
        }
      }
      if (!value) {
        // maybe we parsed a terminal as a unary operator incorrectly...
        if (
          unary.length > 0 && (
            unary[unary.length - 1].punc === '+' ||
            unary[unary.length - 1].punc === '-'
          )
        ) {
          // interpret the tail of the unary array as an anonymous label
          let flp = unary.pop();
          if (!flp) throw new Error('Expecting unary token');
          let label = flp.punc;
          while (unary.length > 0 && unary[unary.length - 1].punc === label.charAt(0)) {
            flp = unary.pop();
            if (!flp) throw new Error('Expecting unary token');
            label += flp.punc;
          }
          value = { kind: 'lookup', flp, idPath: [label], params: false };
        } else {
          throw new CompError(parser.here(), 'Invalid expression');
        }
      }

      // apply unary operators to the terminal
      while (true) {
        const op = unary.pop();
        if (op && op.punc !== '+') {
          value = { kind: 'unary', op: op.punc, value };
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
        left: IExpr,
        op: BinaryOp,
        right: IExpr,
      ): IExprBinary => {
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
      const binOp = parser.peekTokOptional();
      if (binOp && binOp.kind === 'punc') {
        const id = binOp.punc;
        if (isBinaryOp(id)) {
          parser.nextTok();
          value = checkPrecedence(value, id, term());
        } else if (id === '?') {
          parser.nextTok();
          const iftrue = term();
          if (!parser.isNext(':')) {
            throw 'Invalid operator, missing \':\'';
          }
          parser.nextTok();
          const iffalse = term();
          value = { kind: '?:', condition: value, iftrue, iffalse };
        }
      }

      return value;
    };

    return new Expression(term(), paramNames?.length ?? -1);
  }

  value(
    context: IPendingWriteContext,
    lookupFailMode: LookupFailMode,
    params?: number[],
  ): number | false {
    const get = (ex: IExpr): number | false => {
      switch (ex.kind) {
        case 'num':
          return ex.value;
        case 'reserved':
          switch (ex.name) {
            case '_arm':
              return context.mode === 'arm' ? 1 : 0;
            case '_base':
              return context.base;
            case '_bytes':
              return context.bytes ? context.bytes - context.hereOffset : false;
            case '_here':
              return context.addr ? context.addr - context.hereOffset : false;
            case '_main':
              return context.imp.main ? 1 : 0;
            case '_pc':
              switch (context.mode) {
                case 'none':
                  throw new CompError(ex.flp, 'Unknown assembler mode (`.arm` or `.thumb`)');
                case 'arm':
                  return context.addr ? context.addr - context.hereOffset + 8 : false;
                case 'thumb':
                  return context.addr ? context.addr - context.hereOffset + 4 : false;
                default:
                  return assertNever(context.mode);
              }
            case '_thumb':
              return context.mode === 'thumb' ? 1 : 0;
            case '_version':
              return version;
            default:
              return assertNever(ex.name);
          }
        case 'lookup': {
          const v = context.imp.lookup(ex.flp, context.defHere, ex.idPath);
          const pathError = () =>
            ex.idPath.map((p) => typeof p === 'string' ? `.${p}` : '[]').join('').substr(1);
          if (typeof v === 'number') {
            return v;
          }
          if (v === false) {
            if (lookupFailMode === 'deny') {
              throw new CompError(ex.flp, `Missing symbol: ${pathError()}`);
            }
            return false;
          }
          if (v === 'notfound') {
            if (lookupFailMode !== 'allow') {
              throw new CompError(ex.flp, `Can't find symbol: ${pathError()}`);
            }
            return false;
          }
          switch (v.kind) {
            case 'const':
              if (ex.params) {
                if (v.body.paramSize < 0) {
                  throw new CompError(ex.flp, 'Constant cannot be called');
                }
                checkParamSize(ex.flp, ex.params.length, v.body.paramSize);
                const pvalues: number[] = [];
                for (const p of ex.params) {
                  const pv = get(p);
                  if (pv === false) {
                    return false;
                  }
                  pvalues.push(pv);
                }
                return v.body.value(v.context, lookupFailMode, pvalues);
              } else {
                if (v.body.paramSize >= 0) {
                  throw new CompError(ex.flp, 'Constant expecting to be called with parameters');
                }
                return v.body.value(v.context, lookupFailMode);
              }
            case 'scriptExport':
              throw new CompError(ex.flp, `Can't access exported values unless they are numbers`);
            default:
              return assertNever(v);
          }
        }
        case 'param':
          return params?.[ex.param] ?? false;
        case 'read': {
          //if (!cpu) {
          throw 'Cannot have memory read in expression at compile-time';
          /*}
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
          return 0;*/
        }
        case 'assert': {
          const a = get(ex.value);
          if (a === false) return false;
          if (a === 0) {
            throw new CompError(ex.flp, `Failed assertion: ${ex.hint}`);
          }
          return 1;
        }
        case 'defined':
          throw 'TODO: defined';
        case 'func': {
          const func = functions[ex.func];
          if (!func) {
            throw new Error(`Unknown function: ${func}`);
          }
          const a: number[] = [];
          for (const px of ex.params) {
            const p = get(px);
            if (p === false) return false;
            a.push(p);
          }
          return func.f(a) | 0;
        }
        case 'unary': {
          const a = get(ex.value);
          if (a === false) return false;
          switch (ex.op) {
            case '-':
              return -a;
            case '~':
              return ~a;
            case '!':
              return a === 0 ? 1 : 0;
            case '(':
              return a;
            default:
              assertNever(ex);
          }
          break;
        }
        case 'binary': {
          const a = get(ex.left);
          if (a === false) return false;
          const b = get(ex.right);
          if (b === false) return false;
          switch (ex.op) {
            case '+':
              return (a + b) | 0;
            case '-':
              return (a - b) | 0;
            case '*':
              return (a * b) | 0;
            case '/':
              return (a / b) | 0;
            case '%':
              return (a % b) | 0;
            case '<<':
              return (a << b) | 0;
            case '>>':
              return (a >> b) | 0;
            case '>>>':
              return (a >>> b) | 0;
            case '&':
              return (a & b) | 0;
            case '|':
              return (a | b) | 0;
            case '^':
              return (a ^ b) | 0;
            case '<':
              return a < b ? 1 : 0;
            case '<=':
              return a <= b ? 1 : 0;
            case '>':
              return a > b ? 1 : 0;
            case '>=':
              return a >= b ? 1 : 0;
            case '==':
              return a == b ? 1 : 0;
            case '!=':
              return a != b ? 1 : 0;
            case '&&':
              return a === 0 ? a : b;
            case '||':
              return a !== 0 ? a : b;
            default:
              assertNever(ex);
          }
          break;
        }
        case '?:': {
          const condition = get(ex.condition);
          if (condition === false) return false;
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
