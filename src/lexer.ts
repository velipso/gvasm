//
// gvasm - Assembler and disassembler for Game Boy Advance homebrew
// by Sean Connelly (@velipso), https://sean.cm
// Project Home: https://github.com/velipso/gvasm
// SPDX-License-Identifier: 0BSD
//

import { assertNever, isAlpha, isNum, isSpace } from './util.ts';

export interface IFilePos {
  filename: string;
  line: number;
  chr: number;
}

type LexState =
  | 'start'
  | 'commentLine'
  | 'return'
  | 'continue'
  | 'continueSlash'
  | 'continueCommentBlock'
  | 'commentBlock'
  | 'punc'
  | 'rshift'
  | 'ident'
  | 'num0'
  | 'num2b'
  | 'num2'
  | 'numBody'
  | 'numFB'
  | 'consumeIdent'
  | 'str'
  | 'strEsc'
  | 'strHex';

interface ILex {
  filename: string;
  state: LexState;
  line: number;
  chrS: number;
  chr: number;
  ch1: string;
  ch2: string;
  num: number;
  numBase: number;
  quote: string;
  str: string;
  strHexval: number;
  strHexleft: number;
}

interface ITokNewline extends IFilePos {
  kind: 'newline';
}

export interface ITokPunc extends IFilePos {
  kind: 'punc';
  punc: string;
}

export interface ITokId extends IFilePos {
  kind: 'id';
  id: string;
}

interface ITokNum extends IFilePos {
  kind: 'num';
  num: number;
}

interface ITokStr extends IFilePos {
  kind: 'str';
  str: string;
}

interface ITokError extends IFilePos {
  kind: 'error';
  msg: string;
}

export type ITok =
  | ITokNewline
  | ITokPunc
  | ITokId
  | ITokNum
  | ITokStr
  | ITokError;

function tokNewline(filename: string, line: number, chr: number): ITokNewline {
  return { kind: 'newline', filename, line, chr };
}

function tokPunc(filename: string, line: number, chr: number, punc: string): ITokPunc {
  return { kind: 'punc', punc, filename, line, chr };
}

function tokId(filename: string, line: number, chr: number, id: string): ITokId {
  return { kind: 'id', id, filename, line, chr };
}

function tokNum(filename: string, line: number, chr: number, num: number): ITokNum {
  return { kind: 'num', num: num | 0, filename, line, chr };
}

function tokStr(filename: string, line: number, chr: number, str: string): ITokStr {
  return { kind: 'str', str, filename, line, chr };
}

function tokError(filename: string, line: number, chr: number, msg: string): ITokError {
  return { kind: 'error', msg, filename, line, chr };
}

export function isIdentStart(c: string) {
  return isAlpha(c) || c === '_';
}

export function isIdentBody(c: string) {
  return isIdentStart(c) || isNum(c);
}

function isHex(c: string) {
  return isNum(c) || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F');
}

function toHex(c: string) {
  if (isNum(c)) {
    return c.charCodeAt(0) - 48;
  } else if (c >= 'a') {
    return c.charCodeAt(0) - 87;
  }
  return c.charCodeAt(0) - 55;
}

function lexProcess(lx: ILex, tks: ITok[]) {
  const { filename, ch1, line, chrS, chr } = lx;

  switch (lx.state) {
    case 'start':
      lx.chrS = chr;
      if ('~!#%^&*()-+={[}]|:<,>?/.'.indexOf(ch1) >= 0) {
        lx.state = 'punc';
      } else if (isIdentStart(ch1)) {
        lx.str = ch1;
        lx.state = 'ident';
      } else if (isNum(ch1)) {
        lx.num = toHex(ch1);
        lx.numBase = 10;
        if (lx.num === 0) {
          lx.state = 'num0';
        } else {
          lx.state = 'numBody';
        }
      } else if (ch1 === '"' || ch1 === '\'') {
        lx.quote = ch1;
        lx.str = '';
        lx.state = 'str';
      } else if (ch1 === '\r') {
        lx.state = 'return';
        tks.push(tokNewline(filename, line, chr));
      } else if (ch1 === '\n') {
        tks.push(tokNewline(filename, line, chr));
      } else if (ch1 === '\\') {
        lx.state = 'continue';
      } else if (!isSpace(ch1)) {
        tks.push(tokError(filename, line, chr, `Unexpected character: ${ch1}`));
      }
      break;

    case 'commentLine':
      if (ch1 === '\r') {
        lx.state = 'return';
      } else if (ch1 === '\n') {
        lx.state = 'start';
      }
      break;

    case 'return':
      lx.state = 'start';
      if (ch1 !== '\n') {
        lexProcess(lx, tks);
      }
      break;

    case 'continue':
      if (ch1 === '\r') {
        lx.state = 'return';
      } else if (ch1 === '\n') {
        lx.state = 'start';
      } else if (ch1 === '/') {
        lx.state = 'continueSlash';
      } else if (!isSpace(ch1)) {
        lx.state = 'start';
        tks.push(tokError(filename, line, chr, `Unexpected character after backslash: ${ch1}`));
      }
      break;

    case 'continueSlash':
      if (ch1 === '/') {
        lx.state = 'commentLine';
      } else if (ch1 === '*') {
        lx.state = 'continueCommentBlock';
      } else {
        tks.push(tokError(filename, line, chrS, `Unexpected character after backslash: /`));
      }
      break;

    case 'continueCommentBlock':
      if (lx.ch2 === '*' && ch1 === '/') {
        lx.state = 'continue';
      }
      break;

    case 'commentBlock':
      if (lx.ch2 === '*' && ch1 === '/') {
        lx.state = 'start';
      }
      break;

    case 'punc': {
      const comb = lx.ch2 + ch1;
      if (comb === '/*') {
        lx.state = 'commentBlock';
      } else if (comb === '//') {
        lx.state = 'commentLine';
        tks.push(tokNewline(filename, line, chrS));
      } else if (comb === '>>') {
        lx.state = 'rshift';
      } else if (
        comb === '<<' ||
        comb === '==' ||
        comb === '!=' ||
        comb === '<=' ||
        comb === '>=' ||
        comb === '&&' ||
        comb === '||'
      ) {
        tks.push(tokPunc(filename, line, chrS, comb));
        lx.state = 'start';
      } else {
        tks.push(tokPunc(filename, line, chrS, lx.ch2));
        lx.state = 'start';
        lexProcess(lx, tks);
      }
      break;
    }

    case 'rshift':
      if (ch1 === '>') {
        tks.push(tokPunc(filename, line, chrS, '>>>'));
        lx.state = 'start';
      } else {
        tks.push(tokPunc(filename, line, chrS, '>>'));
        lx.state = 'start';
        lexProcess(lx, tks);
      }
      break;

    case 'ident':
      if (!isIdentBody(ch1)) {
        tks.push(tokId(filename, line, chrS, lx.str));
        lx.state = 'start';
        lexProcess(lx, tks);
      } else {
        lx.str += ch1;
        if (lx.str.length > 1024) {
          tks.push(tokError(filename, line, chrS, 'Identifier too long'));
          lx.state = 'consumeIdent';
        }
      }
      break;

    case 'num0':
      if (ch1 === 'b') {
        lx.numBase = 2;
        lx.state = 'num2b';
      } else if (ch1 === 'c') {
        lx.numBase = 8;
        lx.state = 'num2';
      } else if (ch1 === 'x') {
        lx.numBase = 16;
        lx.state = 'num2';
      } else if (ch1 === '_') {
        lx.state = 'numBody';
      } else if (ch1 === 'f') {
        tks.push(tokId(filename, line, chrS, '0f')); // valid label identifier
        lx.state = 'numFB';
      } else if (!isIdentStart(ch1)) {
        tks.push(tokNum(filename, line, chrS, 0));
        lx.state = 'start';
        lexProcess(lx, tks);
      } else {
        tks.push(tokError(filename, line, chrS, 'Invalid number'));
        lx.state = 'consumeIdent';
      }
      break;

    case 'num2b':
      if (ch1 === '0') {
        lx.state = 'numBody';
      } else if (ch1 === '_') {
        lx.state = 'num2';
      } else if (ch1 === '1') {
        lx.num = 1;
        lx.state = 'numBody';
      } else if (!isIdentStart(ch1)) {
        tks.push(tokId(filename, line, chrS, '0b')); // valid label identifier
        lexProcess(lx, tks);
      } else {
        tks.push(tokError(filename, line, chrS, 'Invalid number'));
        lx.state = 'consumeIdent';
      }
      break;

    case 'num2':
      if (isHex(ch1)) {
        lx.num = toHex(ch1);
        if (lx.num >= lx.numBase) {
          tks.push(tokError(filename, line, chrS, 'Invalid number'));
          lx.state = 'consumeIdent';
        } else {
          lx.state = 'numBody';
        }
      } else if (ch1 !== '_') {
        tks.push(tokError(filename, line, chrS, 'Invalid number'));
        lx.state = 'consumeIdent';
      }
      break;

    case 'numBody':
      if (
        (lx.numBase <= 10 && isNum(ch1)) ||
        (lx.numBase > 10 && isHex(ch1))
      ) {
        const v = toHex(ch1);
        if (v >= lx.numBase) {
          tks.push(tokError(filename, line, chrS, 'Invalid number'));
          lx.state = 'consumeIdent';
        } else {
          lx.num = lx.num * lx.numBase + v;
        }
      } else if (ch1 === '_') {
        // do nothing
      } else if (!isAlpha(ch1)) {
        tks.push(tokNum(filename, line, chrS, lx.num));
        lx.state = 'start';
        lexProcess(lx, tks);
      } else if (lx.numBase === 10 && (ch1 === 'f' || ch1 === 'b')) {
        // label identifier
        if (lx.num > 999999) {
          tks.push(tokError(filename, line, chrS, 'Numeric label too large (max 999999)'));
          lx.state = 'consumeIdent';
        } else {
          tks.push(tokId(filename, line, chrS, `${lx.num}${ch1}`));
          lx.state = 'numFB';
        }
      } else {
        tks.push(tokError(filename, line, chrS, 'Invalid number'));
        lx.state = 'consumeIdent';
      }
      break;

    case 'numFB':
      lx.state = 'start';
      if (isIdentBody(ch1)) {
        tks.push(tokError(filename, line, chrS, 'Invalid numeric label'));
        lx.state = 'consumeIdent';
      } else {
        lexProcess(lx, tks);
      }
      break;

    case 'consumeIdent':
      if (!isIdentBody(ch1)) {
        lx.state = 'start';
        lexProcess(lx, tks);
      }
      break;

    case 'str':
      if (ch1 === '\r' || ch1 === '\n') {
        tks.push(tokError(filename, line, chrS, 'Missing end of string'));
        lx.state = 'start';
      } else if (ch1 === lx.quote) {
        lx.state = 'start';
        tks.push(tokStr(filename, line, chrS, lx.str));
      } else if (ch1 === '\\') {
        lx.state = 'strEsc';
      } else {
        lx.str += ch1;
      }
      break;

    case 'strEsc':
      if (ch1 === '\r' || ch1 === '\n') {
        tks.push(tokError(filename, line, chrS, 'Missing end of string'));
        lx.state = 'start';
      } else if (ch1 === 'x') {
        lx.strHexval = 0;
        lx.strHexleft = 2;
        lx.state = 'strHex';
      } else if (ch1 === '0') {
        lx.str += String.fromCharCode(0);
        lx.state = 'str';
      } else if (ch1 === 'b') {
        lx.str += String.fromCharCode(8);
        lx.state = 'str';
      } else if (ch1 === 't') {
        lx.str += String.fromCharCode(9);
        lx.state = 'str';
      } else if (ch1 === 'n') {
        lx.str += String.fromCharCode(10);
        lx.state = 'str';
      } else if (ch1 === 'v') {
        lx.str += String.fromCharCode(11);
        lx.state = 'str';
      } else if (ch1 === 'f') {
        lx.str += String.fromCharCode(12);
        lx.state = 'str';
      } else if (ch1 === 'r') {
        lx.str += String.fromCharCode(13);
        lx.state = 'str';
      } else if (ch1 === 'e') {
        lx.str += String.fromCharCode(27);
        lx.state = 'str';
      } else if (ch1 === '\\' || ch1 === '\'' || ch1 === '"') {
        lx.str += ch1;
        lx.state = 'str';
      } else {
        tks.push(tokError(filename, line, chr, `Invalid escape sequence: \\${ch1}`));
        lx.state = 'str';
      }
      break;

    case 'strHex':
      if (isHex(ch1)) {
        lx.strHexval = (lx.strHexval << 4) + toHex(ch1);
        lx.strHexleft--;
        if (lx.strHexleft <= 0) {
          lx.str += String.fromCharCode(lx.strHexval);
          lx.state = 'str';
        }
      } else {
        tks.push(tokError(filename, line, chr, 'Invalid escape sequence; expecting hex value'));
        lx.state = 'str';
      }
      break;

    default:
      assertNever(lx.state);
  }
}

export function lex(filename: string, data: string, startLine = 1): ITok[] {
  const tks: ITok[] = [];
  const lx: ILex = {
    filename,
    state: 'start',
    line: startLine,
    chrS: 1,
    chr: 1,
    ch1: '',
    ch2: '',
    num: 0,
    numBase: 10,
    quote: '',
    str: '',
    strHexval: 0,
    strHexleft: 0,
  };
  let gotReturn = false;
  for (let i = 0; i < data.length + 1; i++) {
    const ch1 = i < data.length ? data.charAt(i) : '\n';
    if (gotReturn && ch1 !== '\n') {
      lx.chr = 1;
      lx.line++;
    }
    lx.ch2 = lx.ch1;
    lx.ch1 = ch1;
    lexProcess(lx, tks);
    lx.chr++;
    if (ch1 === '\r') {
      gotReturn = true;
    } else if (ch1 === '\n') {
      lx.chr = 1;
      lx.line++;
      gotReturn = false;
    }
  }
  return tks;
}

export function lexKeyValue(line: string): { key: string; value: number } | false {
  const tks = lex('', line);
  const tk1 = tks.shift();
  const tk2 = tks.shift();
  const tk3 = tks.shift();
  const tk4 = tks.shift();
  if (
    tk1 && tk2 && tk3 && tk4 && tks.length === 0 &&
    tk1.kind === 'id' &&
    tk2.kind === 'punc' && tk2.punc === '=' &&
    tk3.kind === 'num' &&
    tk4.kind === 'newline'
  ) {
    return { key: tk1.id, value: tk3.num };
  }
  return false;
}
