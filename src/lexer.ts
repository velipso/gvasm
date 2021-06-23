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

interface INumInfo {
  sign: number;
  val: number;
  base: number;
  frac: number;
  flen: number;
  esign: number;
  eval: number;
}

enum LexEnum {
  START,
  COMMENT_LINE,
  BACKSLASH,
  RETURN,
  COMMENT_BLOCK,
  SPECIAL1,
  SPECIAL2,
  IDENT,
  NUM_0,
  NUM_2,
  NUM_BODY,
  NUM_FRAC,
  NUM_EXP,
  NUM_EXP_BODY,
  STR_BASIC,
  STR_BASIC_ESC,
  STR_INTERP,
  STR_INTERP_DLR,
  STR_INTERP_DLR_ID,
  STR_INTERP_ESC,
  STR_INTERP_ESC_HEX,
}

interface ILex {
  str: string;
  braces: number[];
  state: LexEnum;
  npi: INumInfo;
  flpS: IFilePos;
  flpR: IFilePos;
  flp1: IFilePos;
  flp2: IFilePos;
  flp3: IFilePos;
  flp4: IFilePos;
  chR: string;
  ch1: string;
  ch2: string;
  ch3: string;
  ch4: string;
  strHexval: number;
  strHexleft: number;
  numexp: boolean;
}

export enum TokEnum {
  NEWLINE = "NEWLINE",
  LITERAL = "LITERAL",
  NUM = "NUM",
  STR = "STR",
  ERROR = "ERROR",
}

interface ITokNewline {
  kind: TokEnum.NEWLINE;
  flp: IFilePos;
  soft: boolean;
}

interface ITokLiteral {
  kind: TokEnum.LITERAL;
  flp: IFilePos;
  literal: string;
  unary: boolean;
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
  | ITokLiteral
  | ITokNum
  | ITokStr
  | ITokError;

function tokNewline(flp: IFilePos, soft: boolean): ITokNewline {
  return { kind: TokEnum.NEWLINE, flp, soft };
}

function tokLiteral(
  flp: IFilePos,
  literal: string,
  unary: boolean = false,
): ITokLiteral {
  return { kind: TokEnum.LITERAL, flp, literal, unary };
}

function tokNum(flp: IFilePos, num: number): ITokNum {
  return { kind: TokEnum.NUM, flp, num };
}

function tokStr(flp: IFilePos, str: string): ITokStr {
  return { kind: TokEnum.STR, flp, str };
}

function tokError(flp: IFilePos, msg: string): ITokError {
  return { kind: TokEnum.ERROR, flp, msg };
}

function isIdentStart(c: string) {
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

function toNibble(n: number) {
  return n.toString(16).toUpperCase();
}

const FILEPOS_NULL: IFilePos = Object.freeze({
  filename: "",
  line: -1,
  chr: -1,
});

const SPECIAL = new Set<string>([
  "+",
  "-",
  "%",
  "*",
  "/",
  "^",
  "&",
  "<",
  ">",
  "!",
  "=",
  "~",
  ":",
  ",",
  ".",
  "|",
  "(",
  "[",
  "{",
  ")",
  "]",
  "}",
  "#",
  "<=",
  ">=",
  "!=",
  "==",
  "&&",
  "||",
]);

function numInfoNew(info: Partial<INumInfo>): INumInfo {
  info.sign = 1;
  info.val = 0;
  info.base = 10;
  info.frac = 0;
  info.flen = 0;
  info.esign = 1;
  info.eval = 0;
  return info as INumInfo;
}

function numInfoCalc(info: INumInfo): number {
  let val = info.val;
  let e = 1;
  if (info.eval > 0) {
    e = Math.pow(info.base == 10 ? 10 : 2, info.esign * info.eval);
    val *= e;
  }
  if (info.flen > 0) {
    let d = Math.pow(info.base, info.flen);
    val = (val * d + info.frac * e) / d;
  }
  return info.sign * val;
}

function lexNew(): ILex {
  return {
    str: "",
    braces: [0],
    state: LexEnum.START,
    npi: numInfoNew({}),
    flpS: FILEPOS_NULL,
    flpR: FILEPOS_NULL,
    flp1: FILEPOS_NULL,
    flp2: FILEPOS_NULL,
    flp3: FILEPOS_NULL,
    flp4: FILEPOS_NULL,
    chR: "",
    ch1: "",
    ch2: "",
    ch3: "",
    ch4: "",
    strHexval: 0,
    strHexleft: 0,
    numexp: false,
  };
}

function lexFwd(lx: ILex, flp: IFilePos, ch: string) {
  lx.ch4 = lx.ch3;
  lx.ch3 = lx.ch2;
  lx.ch2 = lx.ch1;
  lx.ch1 = ch;
  lx.flp4 = lx.flp3;
  lx.flp3 = lx.flp2;
  lx.flp2 = lx.flp1;
  lx.flp1 = flp;
}

function lexRev(lx: ILex) {
  lx.chR = lx.ch1;
  lx.ch1 = lx.ch2;
  lx.ch2 = lx.ch3;
  lx.ch3 = lx.ch4;
  lx.ch4 = "";
  lx.flpR = lx.flp1;
  lx.flp1 = lx.flp2;
  lx.flp2 = lx.flp3;
  lx.flp3 = lx.flp4;
  lx.flp4 = FILEPOS_NULL;
}

function lexProcess(lx: ILex, tks: ITok[]) {
  let ch1 = lx.ch1;
  let flp = lx.flp1;
  let flpS = lx.flpS;

  switch (lx.state) {
    case LexEnum.START:
      lx.flpS = flp;
      if (SPECIAL.has(ch1)) {
        if (ch1 === "{") {
          lx.braces[lx.braces.length - 1]++;
        } else if (ch1 === "}") {
          if (lx.braces[lx.braces.length - 1] > 0) {
            lx.braces[lx.braces.length - 1]--;
          } else if (lx.braces.length > 1) {
            lx.braces.pop();
            lx.str = "";
            lx.state = LexEnum.STR_INTERP;
            tks.push(tokLiteral(flp, "("));
            tks.push(tokLiteral(flp, "~"));
            break;
          } else {
            tks.push(tokError(flp, "Mismatched brace"));
          }
        }
        lx.state = LexEnum.SPECIAL1;
      } else if (isIdentStart(ch1)) {
        lx.str = ch1;
        lx.state = LexEnum.IDENT;
      } else if (isNum(ch1)) {
        numInfoNew(lx.npi);
        lx.npi.val = toHex(ch1);
        if (lx.npi.val === 0) {
          lx.state = LexEnum.NUM_0;
        } else {
          lx.state = LexEnum.NUM_BODY;
        }
      } else if (ch1 === "'") {
        lx.str = "";
        lx.state = LexEnum.STR_BASIC;
      } else if (ch1 === '"') {
        lx.str = "";
        lx.state = LexEnum.STR_INTERP;
        tks.push(tokLiteral(flp, "("));
      } else if (ch1 === "\\") {
        lx.state = LexEnum.BACKSLASH;
      } else if (ch1 === "\r") {
        lx.state = LexEnum.RETURN;
        tks.push(tokNewline(flp, false));
      } else if (ch1 === "\n" || ch1 === ";") {
        tks.push(tokNewline(flp, ch1 === ";"));
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

    case LexEnum.BACKSLASH:
      if (ch1 === "#") {
        lx.state = LexEnum.COMMENT_LINE;
      } else if (ch1 === "\r") {
        lx.state = LexEnum.RETURN;
      } else if (ch1 === "\n") {
        lx.state = LexEnum.START;
      } else if (!isSpace(ch1)) {
        tks.push(tokError(flp, "Invalid character after backslash"));
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

    case LexEnum.SPECIAL1:
      if (SPECIAL.has(ch1)) {
        if (lx.ch2 === "/" && ch1 === "*") {
          lx.state = LexEnum.COMMENT_BLOCK;
        } else if (lx.ch2 === "/" && ch1 === "/") {
          lx.state = LexEnum.COMMENT_LINE;
          tks.push(tokNewline(flp, false));
        } else {
          lx.state = LexEnum.SPECIAL2;
        }
      } else {
        // hack to detect difference between binary and unary +/-
        const unary = (lx.ch2 === "+" || lx.ch2 === "-") &&
          !isSpace(ch1) && isSpace(lx.ch3);
        tks.push(tokLiteral(lx.flp2, lx.ch2, unary));
        lx.state = LexEnum.START;
        lexProcess(lx, tks);
      }
      break;

    case LexEnum.SPECIAL2:
      {
        const literal3 = `${lx.ch3}${lx.ch2}${lx.ch1}`;
        const literal2 = `${lx.ch2}${lx.ch1}`;
        if (SPECIAL.has(literal3)) {
          lx.state = LexEnum.START;
          tks.push(tokLiteral(lx.flp3, literal3));
        } else if (SPECIAL.has(literal2)) {
          tks.push(tokLiteral(lx.flp3, literal2));
          lx.state = LexEnum.START;
          lexProcess(lx, tks);
        } else {
          // hack to detect difference between binary and unary +/-
          const unary = (lx.ch3 === "+" || lx.ch3 === "-") && isSpace(lx.ch4);
          tks.push(tokLiteral(lx.flp3, lx.ch3, unary));
          lx.state = LexEnum.START;
          lexRev(lx);
          lexProcess(lx, tks);
          lexFwd(lx, lx.flpR, lx.chR);
          lexProcess(lx, tks);
        }
      }
      break;

    case LexEnum.IDENT:
      if (!isIdentBody(ch1)) {
        tks.push(tokLiteral(flpS, lx.str));
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
        lx.npi.base = 2;
        lx.state = LexEnum.NUM_2;
      } else if (ch1 === "c") {
        lx.npi.base = 8;
        lx.state = LexEnum.NUM_2;
      } else if (ch1 === "x") {
        lx.npi.base = 16;
        lx.state = LexEnum.NUM_2;
      } else if (ch1 === "_") {
        lx.state = LexEnum.NUM_BODY;
      } else if (ch1 === ".") {
        lx.state = LexEnum.NUM_FRAC;
      } else if (ch1 === "e" || ch1 === "E") {
        lx.state = LexEnum.NUM_EXP;
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
        lx.npi.val = toHex(ch1);
        if (lx.npi.val >= lx.npi.base) {
          tks.push(tokError(flpS, "Invalid number"));
        } else {
          lx.state = LexEnum.NUM_BODY;
        }
      } else if (ch1 !== "_") {
        tks.push(tokError(flpS, "Invalid number"));
      }
      break;

    case LexEnum.NUM_BODY:
      if (ch1 === ".") {
        lx.state = LexEnum.NUM_FRAC;
      } else if (
        (lx.npi.base === 10 && (ch1 === "e" || ch1 === "E")) ||
        (lx.npi.base !== 10 && (ch1 === "p" || ch1 === "P"))
      ) {
        lx.state = LexEnum.NUM_EXP;
      } else if (isHex(ch1)) {
        let v = toHex(ch1);
        if (v >= lx.npi.base) {
          tks.push(tokError(flpS, "Invalid number"));
        } else {
          lx.npi.val = lx.npi.val * lx.npi.base + v;
        }
      } else if (!isAlpha(ch1)) {
        tks.push(tokNum(flpS, numInfoCalc(lx.npi)));
        lx.state = LexEnum.START;
        lexProcess(lx, tks);
      } else if (ch1 !== "_") {
        tks.push(tokError(flpS, "Invalid number"));
      }
      break;

    case LexEnum.NUM_FRAC:
      if (
        (lx.npi.base === 10 && (ch1 === "e" || ch1 === "E")) ||
        (lx.npi.base !== 10 && (ch1 === "p" || ch1 === "P"))
      ) {
        lx.state = LexEnum.NUM_EXP;
      } else if (isHex(ch1)) {
        let v = toHex(ch1);
        if (v >= lx.npi.base) {
          tks.push(tokError(flpS, "Invalid number"));
        } else {
          lx.npi.frac = lx.npi.frac * lx.npi.base + v;
          lx.npi.flen++;
        }
      } else if (!isAlpha(ch1)) {
        if (lx.npi.flen <= 0) {
          tks.push(tokError(flpS, "Invalid number"));
        } else {
          tks.push(tokNum(flpS, numInfoCalc(lx.npi)));
          lx.state = LexEnum.START;
          lexProcess(lx, tks);
        }
      } else if (ch1 !== "_") {
        tks.push(tokError(flpS, "Invalid number"));
      }
      break;

    case LexEnum.NUM_EXP:
      if (ch1 !== "_") {
        lx.npi.esign = ch1 === "-" ? -1 : 1;
        lx.state = LexEnum.NUM_EXP_BODY;
        lx.numexp = false;
        if (ch1 !== "+" && ch1 !== "-") {
          lexProcess(lx, tks);
        }
      }
      break;

    case LexEnum.NUM_EXP_BODY:
      if (isNum(ch1)) {
        lx.npi.eval = lx.npi.eval * 10.0 + toHex(ch1);
        lx.numexp = true;
      } else if (!isAlpha(ch1)) {
        if (!lx.numexp) {
          tks.push(tokError(flpS, "Invalid number"));
        } else {
          tks.push(tokNum(flpS, numInfoCalc(lx.npi)));
          lx.state = LexEnum.START;
          lexProcess(lx, tks);
        }
      } else if (ch1 !== "_") {
        tks.push(tokError(flpS, "Invalid number"));
      }
      break;

    case LexEnum.STR_BASIC:
      if (ch1 === "\r" || ch1 === "\n") {
        tks.push(tokError(lx.flp2, "Missing end of string"));
      } else if (ch1 === "'") {
        lx.state = LexEnum.STR_BASIC_ESC;
      } else {
        lx.str += ch1;
      }
      break;

    case LexEnum.STR_BASIC_ESC:
      if (ch1 === "'") {
        lx.str += ch1;
        lx.state = LexEnum.STR_BASIC;
      } else {
        lx.state = LexEnum.START;
        tks.push(tokLiteral(flpS, "("));
        tks.push(tokStr(flpS, lx.str));
        tks.push(tokLiteral(lx.flp2, ")"));
        lexProcess(lx, tks);
      }
      break;

    case LexEnum.STR_INTERP:
      if (ch1 === "\r" || ch1 === "\n") {
        tks.push(tokError(lx.flp2, "Missing end of string"));
      } else if (ch1 === '"') {
        lx.state = LexEnum.START;
        tks.push(tokStr(flpS, lx.str));
        tks.push(tokLiteral(flp, ")"));
      } else if (ch1 === "$") {
        lx.state = LexEnum.STR_INTERP_DLR;
        tks.push(tokStr(flpS, lx.str));
        tks.push(tokLiteral(flp, "~"));
      } else if (ch1 === "\\") {
        lx.state = LexEnum.STR_INTERP_ESC;
      } else {
        lx.str += ch1;
      }
      break;

    case LexEnum.STR_INTERP_DLR:
      if (ch1 === "{") {
        lx.braces.push(0);
        lx.state = LexEnum.START;
        tks.push(tokLiteral(flp, "("));
      } else if (isIdentStart(ch1)) {
        lx.str = ch1;
        lx.state = LexEnum.STR_INTERP_DLR_ID;
        lx.flpS = flp; // save start position of ident
      } else {
        tks.push(tokError(flp, "Invalid substitution"));
      }
      break;

    case LexEnum.STR_INTERP_DLR_ID:
      if (!isIdentBody(ch1)) {
        tks.push(tokLiteral(flpS, lx.str));
        if (ch1 === '"') {
          lx.state = LexEnum.START;
          tks.push(tokLiteral(flp, ")"));
        } else {
          lx.str = "";
          lx.state = LexEnum.STR_INTERP;
          tks.push(tokLiteral(flp, "~"));
          lexProcess(lx, tks);
        }
      } else {
        lx.str += ch1;
        if (lx.str.length > 1024) {
          tks.push(tokError(flpS, "Identifier too long"));
        }
      }
      break;

    case LexEnum.STR_INTERP_ESC:
      if (ch1 === "\r" || ch1 === "\n") {
        tks.push(tokError(lx.flp2, "Missing end of string"));
      } else if (ch1 === "x") {
        lx.strHexval = 0;
        lx.strHexleft = 2;
        lx.state = LexEnum.STR_INTERP_ESC_HEX;
      } else if (ch1 === "0") {
        lx.str += String.fromCharCode(0);
        lx.state = LexEnum.STR_INTERP;
      } else if (ch1 === "b") {
        lx.str += String.fromCharCode(8);
        lx.state = LexEnum.STR_INTERP;
      } else if (ch1 === "t") {
        lx.str += String.fromCharCode(9);
        lx.state = LexEnum.STR_INTERP;
      } else if (ch1 === "n") {
        lx.str += String.fromCharCode(10);
        lx.state = LexEnum.STR_INTERP;
      } else if (ch1 === "v") {
        lx.str += String.fromCharCode(11);
        lx.state = LexEnum.STR_INTERP;
      } else if (ch1 === "f") {
        lx.str += String.fromCharCode(12);
        lx.state = LexEnum.STR_INTERP;
      } else if (ch1 === "r") {
        lx.str += String.fromCharCode(13);
        lx.state = LexEnum.STR_INTERP;
      } else if (ch1 === "e") {
        lx.str += String.fromCharCode(27);
        lx.state = LexEnum.STR_INTERP;
      } else if (ch1 === "\\" || ch1 === "'" || ch1 === '"' || ch1 === "$") {
        lx.str += ch1;
        lx.state = LexEnum.STR_INTERP;
      } else {
        tks.push(tokError(flp, "Invalid escape sequence: \\" + ch1));
      }
      break;

    case LexEnum.STR_INTERP_ESC_HEX:
      if (isHex(ch1)) {
        lx.strHexval = (lx.strHexval << 4) + toHex(ch1);
        lx.strHexleft--;
        if (lx.strHexleft <= 0) {
          lx.str += String.fromCharCode(lx.strHexval);
          lx.state = LexEnum.STR_INTERP;
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
    let b = data.charAt(i);
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
