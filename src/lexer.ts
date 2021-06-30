//
// gbasm - Assembler and disassembler for Game Boy Advance homebrew
// by Sean Connelly (@velipso), https://sean.cm
// The Unlicense License
// Project Home: https://github.com/velipso/gbasm
//

import { isAlpha, isNum, isSpace } from "./util.ts";

interface IFilePos {
  filename: string;
  line: number;
  chr: number;
}

enum LexEnum {
  START,
  COMMENT_LINE,
  RETURN,
  COMMENT_BLOCK,
  SPECIAL,
  RSHIFT,
  IDENT,
  NUM_0,
  NUM_2,
  NUM_BODY,
  STR,
  STR_ESC,
  STR_HEX,
}

interface ILex {
  state: LexEnum;
  flpS: IFilePos;
  flp1: IFilePos;
  flp2: IFilePos;
  ch1: string;
  ch2: string;
  num: number;
  numBase: number;
  str: string;
  strHexval: number;
  strHexleft: number;
}

export enum TokEnum {
  NEWLINE = "NEWLINE",
  ID = "ID",
  NUM = "NUM",
  STR = "STR",
  ERROR = "ERROR",
}

interface ITokNewline {
  kind: TokEnum.NEWLINE;
  flp: IFilePos;
}

interface ITokId {
  kind: TokEnum.ID;
  flp: IFilePos;
  id: string;
  idCase: string;
}

interface ITokNum {
  kind: TokEnum.NUM;
  flp: IFilePos;
  num: number;
}

interface ITokStr {
  kind: TokEnum.STR;
  flp: IFilePos;
  str: string;
}

interface ITokError {
  kind: TokEnum.ERROR;
  flp: IFilePos;
  msg: string;
}

export type ITok =
  | ITokNewline
  | ITokId
  | ITokNum
  | ITokStr
  | ITokError;

function tokNewline(flp: IFilePos): ITokNewline {
  return { kind: TokEnum.NEWLINE, flp };
}

function tokId(flp: IFilePos, id: string): ITokId {
  return { kind: TokEnum.ID, flp, id: id.toLowerCase(), idCase: id };
}

function tokNum(flp: IFilePos, num: number): ITokNum {
  return { kind: TokEnum.NUM, flp, num: num | 0 };
}

function tokStr(flp: IFilePos, str: string): ITokStr {
  return { kind: TokEnum.STR, flp, str };
}

function tokError(flp: IFilePos, msg: string): ITokError {
  return { kind: TokEnum.ERROR, flp, msg };
}

export function isIdentStart(c: string) {
  return isAlpha(c) || c === "_";
}

function isIdentBody(c: string) {
  return isIdentStart(c) || isNum(c);
}

function isHex(c: string) {
  return isNum(c) || (c >= "a" && c <= "f") || (c >= "A" && c <= "F");
}

function toHex(c: string) {
  if (isNum(c)) {
    return c.charCodeAt(0) - 48;
  } else if (c >= "a") {
    return c.charCodeAt(0) - 87;
  }
  return c.charCodeAt(0) - 55;
}

const FILEPOS_NULL: IFilePos = Object.freeze({
  filename: "",
  line: -1,
  chr: -1,
});

export function errorString(flp: IFilePos, msg: string) {
  return `${flp.filename}:${flp.line}:${flp.chr}: ${msg}`;
}

function lexNew(): ILex {
  return {
    state: LexEnum.START,
    flpS: FILEPOS_NULL,
    flp1: FILEPOS_NULL,
    flp2: FILEPOS_NULL,
    ch1: "",
    ch2: "",
    num: 0,
    numBase: 10,
    str: "",
    strHexval: 0,
    strHexleft: 0,
  };
}

function lexFwd(lx: ILex, flp: IFilePos, ch: string) {
  lx.ch2 = lx.ch1;
  lx.ch1 = ch;
  lx.flp2 = lx.flp1;
  lx.flp1 = flp;
}

function lexProcess(lx: ILex, tks: ITok[]) {
  const ch1 = lx.ch1;
  const flp = lx.flp1;
  const flpS = lx.flpS;

  switch (lx.state) {
    case LexEnum.START:
      lx.flpS = flp;
      if ("~!@#$%^&*()-+={[}]|\\:<,>.?/".indexOf(ch1) >= 0) {
        lx.state = LexEnum.SPECIAL;
      } else if (isIdentStart(ch1)) {
        lx.str = ch1;
        lx.state = LexEnum.IDENT;
      } else if (isNum(ch1)) {
        lx.num = toHex(ch1);
        lx.numBase = 10;
        if (lx.num === 0) {
          lx.state = LexEnum.NUM_0;
        } else {
          lx.state = LexEnum.NUM_BODY;
        }
      } else if (ch1 === '"') {
        lx.str = "";
        lx.state = LexEnum.STR;
      } else if (ch1 === "\r") {
        lx.state = LexEnum.RETURN;
        tks.push(tokNewline(flp));
      } else if (ch1 === "\n") {
        tks.push(tokNewline(flp));
      } else if (!isSpace(ch1)) {
        tks.push(tokError(flp, `Unexpected character: ${ch1}`));
      }
      break;

    case LexEnum.COMMENT_LINE:
      if (ch1 === "\r") {
        lx.state = LexEnum.RETURN;
      } else if (ch1 === "\n") {
        lx.state = LexEnum.START;
      }
      break;

    case LexEnum.RETURN:
      lx.state = LexEnum.START;
      if (ch1 !== "\n") {
        lexProcess(lx, tks);
      }
      break;

    case LexEnum.COMMENT_BLOCK:
      if (lx.ch2 === "*" && ch1 === "/") {
        lx.state = LexEnum.START;
      }
      break;

    case LexEnum.SPECIAL: {
      const comb = lx.ch2 + ch1;
      if (comb === "/*") {
        lx.state = LexEnum.COMMENT_BLOCK;
      } else if (comb === "//") {
        lx.state = LexEnum.COMMENT_LINE;
        tks.push(tokNewline(flp));
      } else if (comb === ">>") {
        lx.state = LexEnum.RSHIFT;
      } else if (
        comb === "<<" ||
        comb === "==" ||
        comb === "!=" ||
        comb === "<=" ||
        comb === ">=" ||
        comb === "&&" ||
        comb === "||"
      ) {
        tks.push(tokId(flpS, comb));
        lx.state = LexEnum.START;
      } else {
        tks.push(tokId(flpS, lx.ch2));
        lx.state = LexEnum.START;
        lexProcess(lx, tks);
      }
      break;
    }

    case LexEnum.RSHIFT:
      if (ch1 === ">") {
        tks.push(tokId(flpS, ">>>"));
        lx.state = LexEnum.START;
      } else {
        tks.push(tokId(flpS, ">>"));
        lx.state = LexEnum.START;
        lexProcess(lx, tks);
      }
      break;

    case LexEnum.IDENT:
      if (!isIdentBody(ch1)) {
        tks.push(tokId(flpS, lx.str));
        lx.state = LexEnum.START;
        lexProcess(lx, tks);
      } else {
        lx.str += ch1;
        if (lx.str.length > 1024) {
          tks.push(tokError(flpS, "Identifier too long"));
        }
      }
      break;

    case LexEnum.NUM_0:
      if (ch1 === "b") {
        lx.numBase = 2;
        lx.state = LexEnum.NUM_2;
      } else if (ch1 === "c") {
        lx.numBase = 8;
        lx.state = LexEnum.NUM_2;
      } else if (ch1 === "x") {
        lx.numBase = 16;
        lx.state = LexEnum.NUM_2;
      } else if (ch1 === "_") {
        lx.state = LexEnum.NUM_BODY;
      } else if (!isIdentStart(ch1)) {
        tks.push(tokNum(flpS, 0));
        lx.state = LexEnum.START;
        lexProcess(lx, tks);
      } else {
        tks.push(tokError(flpS, "Invalid number"));
      }
      break;

    case LexEnum.NUM_2:
      if (isHex(ch1)) {
        lx.num = toHex(ch1);
        if (lx.num >= lx.numBase) {
          tks.push(tokError(flpS, "Invalid number"));
        } else {
          lx.state = LexEnum.NUM_BODY;
        }
      } else if (ch1 !== "_") {
        tks.push(tokError(flpS, "Invalid number"));
      }
      break;

    case LexEnum.NUM_BODY:
      if (isHex(ch1)) {
        const v = toHex(ch1);
        if (v >= lx.numBase) {
          tks.push(tokError(flpS, "Invalid number"));
        } else {
          lx.num = lx.num * lx.numBase + v;
        }
      } else if (ch1 === "_") {
        // do nothing
      } else if (!isAlpha(ch1)) {
        tks.push(tokNum(flpS, lx.num));
        lx.state = LexEnum.START;
        lexProcess(lx, tks);
      } else {
        tks.push(tokError(flpS, "Invalid number"));
      }
      break;

    case LexEnum.STR:
      if (ch1 === "\r" || ch1 === "\n") {
        tks.push(tokError(lx.flp2, "Missing end of string"));
      } else if (ch1 === '"') {
        lx.state = LexEnum.START;
        tks.push(tokStr(flpS, lx.str));
      } else if (ch1 === "\\") {
        lx.state = LexEnum.STR_ESC;
      } else {
        lx.str += ch1;
      }
      break;

    case LexEnum.STR_ESC:
      if (ch1 === "\r" || ch1 === "\n") {
        tks.push(tokError(lx.flp2, "Missing end of string"));
      } else if (ch1 === "x") {
        lx.strHexval = 0;
        lx.strHexleft = 2;
        lx.state = LexEnum.STR_HEX;
      } else if (ch1 === "0") {
        lx.str += String.fromCharCode(0);
        lx.state = LexEnum.STR;
      } else if (ch1 === "b") {
        lx.str += String.fromCharCode(8);
        lx.state = LexEnum.STR;
      } else if (ch1 === "t") {
        lx.str += String.fromCharCode(9);
        lx.state = LexEnum.STR;
      } else if (ch1 === "n") {
        lx.str += String.fromCharCode(10);
        lx.state = LexEnum.STR;
      } else if (ch1 === "v") {
        lx.str += String.fromCharCode(11);
        lx.state = LexEnum.STR;
      } else if (ch1 === "f") {
        lx.str += String.fromCharCode(12);
        lx.state = LexEnum.STR;
      } else if (ch1 === "r") {
        lx.str += String.fromCharCode(13);
        lx.state = LexEnum.STR;
      } else if (ch1 === "e") {
        lx.str += String.fromCharCode(27);
        lx.state = LexEnum.STR;
      } else if (ch1 === "\\" || ch1 === "'" || ch1 === '"') {
        lx.str += ch1;
        lx.state = LexEnum.STR;
      } else {
        tks.push(tokError(flp, `Invalid escape sequence: \\${ch1}`));
      }
      break;

    case LexEnum.STR_HEX:
      if (isHex(ch1)) {
        lx.strHexval = (lx.strHexval << 4) + toHex(ch1);
        lx.strHexleft--;
        if (lx.strHexleft <= 0) {
          lx.str += String.fromCharCode(lx.strHexval);
          lx.state = LexEnum.STR;
        }
      } else {
        tks.push(tokError(flp, "Invalid escape sequence; expecting hex value"));
      }
      break;
  }
}

function lexAdd(lx: ILex, flp: IFilePos, ch: string, tks: ITok[]) {
  lexFwd(lx, flp, ch);
  lexProcess(lx, tks);
}

export function lex(filename: string, data: string): ITok[] {
  const tks: ITok[] = [];
  const lx = lexNew();
  let wascr = false;
  const flp = { filename, line: 1, chr: 1 };
  for (let i = 0; i < data.length; i++) {
    const b = data.charAt(i);
    lexAdd(lx, { ...flp }, b, tks);
    if (b === "\n") {
      if (!wascr) {
        flp.line++;
        flp.chr = 1;
      }
      wascr = false;
    } else if (b === "\r") {
      flp.line++;
      flp.chr = 1;
      wascr = true;
    } else {
      flp.chr++;
      wascr = false;
    }
  }
  return tks;
}
