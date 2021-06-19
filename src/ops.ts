//
// gbasm - Assembler and disassembler for Game Boy Advance homebrew
// by Sean Connelly (@velipso), https://sean.cm
// The Unlicense License
// Project Home: https://github.com/velipso/gbasm
//

interface ICodePartArmRegister {
  s: 4;
  k: "register";
  sym: string;
}

interface ICodePartValue {
  s: number;
  k: "value";
  v: number;
  sym?: string;
}

type IEnum = string | false;

interface ICodePartEnum1 {
  s: 1;
  k: "enum";
  enum: [IEnum, IEnum];
  sym: string;
}

interface ICodePartEnum2 {
  s: 2;
  k: "enum";
  enum: [IEnum, IEnum, IEnum, IEnum];
  sym: string;
}

interface ICodePartEnum3 {
  s: 3;
  k: "enum";
  enum: [IEnum, IEnum, IEnum, IEnum, IEnum, IEnum, IEnum, IEnum];
  sym: string;
}

interface ICodePartEnum4 {
  s: 4;
  k: "enum";
  enum: [
    IEnum,
    IEnum,
    IEnum,
    IEnum,
    IEnum,
    IEnum,
    IEnum,
    IEnum,
    IEnum,
    IEnum,
    IEnum,
    IEnum,
    IEnum,
    IEnum,
    IEnum,
    IEnum,
  ];
  sym: string;
}

interface ICodePartIgnored {
  s: number;
  k: "ignored";
  v: number;
  sym: string;
}

interface ICodePartImmediate {
  s: number;
  k: "immediate";
  sym: string;
}

interface ICodePartRotimm {
  s: 12;
  k: "rotimm";
  sym: string;
}

interface ICodePartOffset12 {
  s: 12;
  k: "offset12";
  sym: string;
}

interface ICodePartOffset24 {
  s: 24;
  k: "offset24";
  sym: string;
}

interface ICodePartOffsetLow {
  s: 4;
  k: "offsetlow";
  sym: string;
}

interface ICodePartOffsetHigh {
  s: 4;
  k: "offsethigh";
  sym: string;
}

export type ICodePart =
  | ICodePartArmRegister
  | ICodePartValue
  | ICodePartEnum1
  | ICodePartEnum2
  | ICodePartEnum3
  | ICodePartEnum4
  | ICodePartIgnored
  | ICodePartImmediate
  | ICodePartRotimm
  | ICodePartOffset12
  | ICodePartOffset24
  | ICodePartOffsetLow
  | ICodePartOffsetHigh;

export interface IOp {
  arm: boolean;
  ref: string;
  category:
    | "Branch"
    | "Data Processing"
    | "PSR Transfer"
    | "Multiply and Multiply-Accumulate"
    | "Multiply Long and Multiply-Accumulate Long"
    | "Single Data Transfer"
    | "Halfword and Signed Data Transfer";
  codeParts: ICodePart[];
  syntax: [string, ...string[]];
}

const condition: ICodePart = {
  s: 4,
  k: "enum",
  sym: "cond",
  enum: [
    "eq",
    "ne",
    "cs/hs",
    "cc/lo",
    "mi",
    "pl",
    "vs",
    "vc",
    "hi",
    "ls",
    "ge",
    "lt",
    "gt",
    "le",
    "/al",
    "nv",
  ],
};

export const ops: readonly IOp[] = Object.freeze([
  //
  // BRANCH
  //
  {
    arm: true,
    ref: "4.3",
    category: "Branch",
    codeParts: [
      { s: 4, k: "register", sym: "Rn" },
      { s: 24, k: "value", v: 0x12fff1 },
      condition,
    ],
    syntax: ["bx$cond $Rn"],
  },
  {
    arm: true,
    ref: "4.4",
    category: "Branch",
    codeParts: [
      { s: 24, k: "offset24", sym: "offset" },
      { s: 1, k: "enum", sym: "link", enum: ["", "l"] },
      { s: 3, k: "value", v: 5 },
      condition,
    ],
    syntax: ["b$link$cond $offset"],
  },

  //
  // DATA PROCESSING
  //
  // 1. mov/mvn                                     OR
  //    cmp/cmn/teq/tst                             OR
  //    and/eor/sub/rsb/add/adc/sbc/rsc/orr/bic
  // 2. Rm, (lsl/asr/ror) #0                        OR
  //    Rm, lsr #32                                 OR
  //    Rm, asr #32                                 OR
  //    Rm, rrx                                     OR
  //    Rm, <shiftname> #expression                 OR
  //    Rm, <shiftname> <register>                  OR
  //    <#expression>
  //
  // There should be 3 * 7 = 21 entries in this section

  // mov/mvn
  {
    arm: true,
    ref: "4.5,4.5.2,4.5.8.1",
    category: "Data Processing",
    codeParts: [
      { s: 4, k: "register", sym: "Rm" },
      { s: 1, k: "value", v: 0 }, // instruction specified shift amount
      { s: 2, k: "value", sym: "shift", v: 0 }, // shift = lsl
      { s: 5, k: "value", sym: "amount", v: 0 }, // amount = 0
      { s: 4, k: "register", sym: "Rd" },
      { s: 4, k: "ignored", sym: "Rn", v: 0 }, // Rn is ignored for mov/mvn
      { s: 1, k: "enum", sym: "s", enum: ["", "s"] },
      {
        s: 4,
        k: "enum",
        sym: "oper",
        enum: [
          false,
          false,
          false,
          false,
          false,
          false,
          false,
          false,
          false,
          false,
          false,
          false,
          false,
          "mov",
          false,
          "mvn",
        ],
      },
      { s: 1, k: "value", sym: "immediate", v: 0 }, // immediate = 0
      { s: 2, k: "value", v: 0 },
      condition,
    ],
    syntax: [
      "$oper$cond$s $Rd, $Rm",
      "$oper$cond$s $Rd, $Rm, lsl #0",
      "$oper$cond$s $Rd, $Rm, lsr #0",
      "$oper$cond$s $Rd, $Rm, asr #0",
      "$oper$cond$s $Rd, $Rm, ror #0",
    ],
  },
  {
    arm: true,
    ref: "4.5,4.5.2,4.5.8.1",
    category: "Data Processing",
    codeParts: [
      { s: 4, k: "register", sym: "Rm" },
      { s: 1, k: "value", v: 0 }, // instruction specified shift amount
      { s: 2, k: "value", sym: "shift", v: 1 }, // shift = lsr
      { s: 5, k: "value", sym: "amount", v: 0 }, // amount = 0
      { s: 4, k: "register", sym: "Rd" },
      { s: 4, k: "ignored", sym: "Rn", v: 0 }, // Rn is ignored for mov/mvn
      { s: 1, k: "enum", sym: "s", enum: ["", "s"] },
      {
        s: 4,
        k: "enum",
        sym: "oper",
        enum: [
          false,
          false,
          false,
          false,
          false,
          false,
          false,
          false,
          false,
          false,
          false,
          false,
          false,
          "mov",
          false,
          "mvn",
        ],
      },
      { s: 1, k: "value", sym: "immediate", v: 0 }, // immediate = 0
      { s: 2, k: "value", v: 0 },
      condition,
    ],
    syntax: ["$oper$cond$s $Rd, $Rm, lsr #32"],
  },
  {
    arm: true,
    ref: "4.5,4.5.2,4.5.8.1",
    category: "Data Processing",
    codeParts: [
      { s: 4, k: "register", sym: "Rm" },
      { s: 1, k: "value", v: 0 }, // instruction specified shift amount
      { s: 2, k: "value", sym: "shift", v: 2 }, // shift = asr
      { s: 5, k: "value", sym: "amount", v: 0 }, // amount = 0
      { s: 4, k: "register", sym: "Rd" },
      { s: 4, k: "ignored", sym: "Rn", v: 0 }, // Rn is ignored for mov/mvn
      { s: 1, k: "enum", sym: "s", enum: ["", "s"] },
      {
        s: 4,
        k: "enum",
        sym: "oper",
        enum: [
          false,
          false,
          false,
          false,
          false,
          false,
          false,
          false,
          false,
          false,
          false,
          false,
          false,
          "mov",
          false,
          "mvn",
        ],
      },
      { s: 1, k: "value", sym: "immediate", v: 0 }, // immediate = 0
      { s: 2, k: "value", v: 0 },
      condition,
    ],
    syntax: ["$oper$cond$s $Rd, $Rm, asr #32"],
  },
  {
    arm: true,
    ref: "4.5,4.5.2,4.5.8.1",
    category: "Data Processing",
    codeParts: [
      { s: 4, k: "register", sym: "Rm" },
      { s: 1, k: "value", v: 0 }, // instruction specified shift amount
      { s: 2, k: "value", sym: "shift", v: 3 }, // shift = ror
      { s: 5, k: "value", sym: "amount", v: 0 }, // amount = 0
      { s: 4, k: "register", sym: "Rd" },
      { s: 4, k: "ignored", sym: "Rn", v: 0 }, // Rn is ignored for mov/mvn
      { s: 1, k: "enum", sym: "s", enum: ["", "s"] },
      {
        s: 4,
        k: "enum",
        sym: "oper",
        enum: [
          false,
          false,
          false,
          false,
          false,
          false,
          false,
          false,
          false,
          false,
          false,
          false,
          false,
          "mov",
          false,
          "mvn",
        ],
      },
      { s: 1, k: "value", sym: "immediate", v: 0 }, // immediate = 0
      { s: 2, k: "value", v: 0 },
      condition,
    ],
    syntax: ["$oper$cond$s $Rd, $Rm, rrx"],
  },
  {
    arm: true,
    ref: "4.5,4.5.2,4.5.8.1",
    category: "Data Processing",
    codeParts: [
      { s: 4, k: "register", sym: "Rm" },
      { s: 1, k: "value", v: 0 }, // instruction specified shift amount
      { s: 2, k: "enum", sym: "shift", enum: ["lsl/asl", "lsr", "asr", "ror"] },
      { s: 5, k: "immediate", sym: "amount" },
      { s: 4, k: "register", sym: "Rd" },
      { s: 4, k: "ignored", sym: "Rn", v: 0 }, // Rn is ignored for mov/mvn
      { s: 1, k: "enum", sym: "s", enum: ["", "s"] },
      {
        s: 4,
        k: "enum",
        sym: "oper",
        enum: [
          false,
          false,
          false,
          false,
          false,
          false,
          false,
          false,
          false,
          false,
          false,
          false,
          false,
          "mov",
          false,
          "mvn",
        ],
      },
      { s: 1, k: "value", sym: "immediate", v: 0 }, // immediate = 0
      { s: 2, k: "value", v: 0 },
      condition,
    ],
    syntax: ["$oper$cond$s $Rd, $Rm, $shift #$amount"],
  },
  {
    arm: true,
    ref: "4.5,4.5.2,4.5.8.1",
    category: "Data Processing",
    codeParts: [
      { s: 4, k: "register", sym: "Rm" },
      { s: 1, k: "value", v: 1 }, // register specified shift amount
      { s: 2, k: "enum", sym: "shift", enum: ["lsl/asl", "lsr", "asr", "ror"] },
      { s: 1, k: "value", v: 0 },
      { s: 4, k: "register", sym: "Rs" },
      { s: 4, k: "register", sym: "Rd" },
      { s: 4, k: "ignored", sym: "Rn", v: 0 }, // Rn is ignored for mov/mvn
      { s: 1, k: "enum", sym: "s", enum: ["", "s"] },
      {
        s: 4,
        k: "enum",
        sym: "oper",
        enum: [
          false,
          false,
          false,
          false,
          false,
          false,
          false,
          false,
          false,
          false,
          false,
          false,
          false,
          "mov",
          false,
          "mvn",
        ],
      },
      { s: 1, k: "value", sym: "immediate", v: 0 }, // immediate = 0
      { s: 2, k: "value", v: 0 },
      condition,
    ],
    syntax: ["$oper$cond$s $Rd, $Rm, $shift $Rs"],
  },
  {
    arm: true,
    ref: "4.5,4.5.3,4.5.8.1",
    category: "Data Processing",
    codeParts: [
      { s: 12, k: "rotimm", sym: "expression" },
      { s: 4, k: "register", sym: "Rd" },
      { s: 4, k: "ignored", sym: "Rn", v: 0 }, // Rn is ignored for mov/mvn
      { s: 1, k: "enum", sym: "s", enum: ["", "s"] },
      {
        s: 4,
        k: "enum",
        sym: "oper",
        enum: [
          false,
          false,
          false,
          false,
          false,
          false,
          false,
          false,
          false,
          false,
          false,
          false,
          false,
          "mov",
          false,
          "mvn",
        ],
      },
      { s: 1, k: "value", sym: "immediate", v: 1 }, // immediate = 1
      { s: 2, k: "value", v: 0 },
      condition,
    ],
    syntax: ["$oper$cond$s $Rd, #$expression"],
  },
  // tst/teq/cmp/cmn
  {
    arm: true,
    ref: "4.5,4.5.2,4.5.8.2",
    category: "Data Processing",
    codeParts: [
      { s: 4, k: "register", sym: "Rm" },
      { s: 1, k: "value", v: 0 }, // instruction specified shift amount
      { s: 2, k: "value", sym: "shift", v: 0 }, // shift = lsl
      { s: 5, k: "value", sym: "amount", v: 0 }, // amount = 0
      { s: 4, k: "ignored", sym: "Rd", v: 0 }, // Rd is ignored for tst/teq/cmp/cmn
      { s: 4, k: "register", sym: "Rn" },
      { s: 1, k: "value", sym: "s", v: 1 }, // s is always 1 for tst/teq/cmp/cmn
      {
        s: 4,
        k: "enum",
        sym: "oper",
        enum: [
          false,
          false,
          false,
          false,
          false,
          false,
          false,
          false,
          "tst",
          "teq",
          "cmp",
          "cmn",
          false,
          false,
          false,
          false,
        ],
      },
      { s: 1, k: "value", sym: "immediate", v: 0 }, // immediate = 0
      { s: 2, k: "value", v: 0 },
      condition,
    ],
    syntax: [
      "$oper$cond $Rn, $Rm",
      "$oper$cond $Rn, $Rm, lsr #0",
      "$oper$cond $Rn, $Rm, asr #0",
      "$oper$cond $Rn, $Rm, ror #0",
    ],
  },
  {
    arm: true,
    ref: "4.5,4.5.2,4.5.8.2",
    category: "Data Processing",
    codeParts: [
      { s: 4, k: "register", sym: "Rm" },
      { s: 1, k: "value", v: 0 }, // instruction specified shift amount
      { s: 2, k: "value", sym: "shift", v: 1 }, // shift = lsr
      { s: 5, k: "value", sym: "amount", v: 0 }, // amount = 0
      { s: 4, k: "ignored", sym: "Rd", v: 0 }, // Rd is ignored for tst/teq/cmp/cmn
      { s: 4, k: "register", sym: "Rn" },
      { s: 1, k: "value", sym: "s", v: 1 }, // s is always 1 for tst/teq/cmp/cmn
      {
        s: 4,
        k: "enum",
        sym: "oper",
        enum: [
          false,
          false,
          false,
          false,
          false,
          false,
          false,
          false,
          "tst",
          "teq",
          "cmp",
          "cmn",
          false,
          false,
          false,
          false,
        ],
      },
      { s: 1, k: "value", sym: "immediate", v: 0 }, // immediate = 0
      { s: 2, k: "value", v: 0 },
      condition,
    ],
    syntax: ["$oper$cond $Rn, $Rm, lsr #32"],
  },
  {
    arm: true,
    ref: "4.5,4.5.2,4.5.8.2",
    category: "Data Processing",
    codeParts: [
      { s: 4, k: "register", sym: "Rm" },
      { s: 1, k: "value", v: 0 }, // instruction specified shift amount
      { s: 2, k: "value", sym: "shift", v: 2 }, // shift = asr
      { s: 5, k: "value", sym: "amount", v: 0 }, // amount = 0
      { s: 4, k: "ignored", sym: "Rd", v: 0 }, // Rd is ignored for tst/teq/cmp/cmn
      { s: 4, k: "register", sym: "Rn" },
      { s: 1, k: "value", sym: "s", v: 1 }, // s is always 1 for tst/teq/cmp/cmn
      {
        s: 4,
        k: "enum",
        sym: "oper",
        enum: [
          false,
          false,
          false,
          false,
          false,
          false,
          false,
          false,
          "tst",
          "teq",
          "cmp",
          "cmn",
          false,
          false,
          false,
          false,
        ],
      },
      { s: 1, k: "value", sym: "immediate", v: 0 }, // immediate = 0
      { s: 2, k: "value", v: 0 },
      condition,
    ],
    syntax: ["$oper$cond $Rn, $Rm, asr #32"],
  },
  {
    arm: true,
    ref: "4.5,4.5.2,4.5.8.2",
    category: "Data Processing",
    codeParts: [
      { s: 4, k: "register", sym: "Rm" },
      { s: 1, k: "value", v: 0 }, // instruction specified shift amount
      { s: 2, k: "value", sym: "shift", v: 3 }, // shift = ror
      { s: 5, k: "value", sym: "amount", v: 0 }, // amount = 0
      { s: 4, k: "ignored", sym: "Rd", v: 0 }, // Rd is ignored for tst/teq/cmp/cmn
      { s: 4, k: "register", sym: "Rn" },
      { s: 1, k: "value", sym: "s", v: 1 }, // s is always 1 for tst/teq/cmp/cmn
      {
        s: 4,
        k: "enum",
        sym: "oper",
        enum: [
          false,
          false,
          false,
          false,
          false,
          false,
          false,
          false,
          "tst",
          "teq",
          "cmp",
          "cmn",
          false,
          false,
          false,
          false,
        ],
      },
      { s: 1, k: "value", sym: "immediate", v: 0 }, // immediate = 0
      { s: 2, k: "value", v: 0 },
      condition,
    ],
    syntax: ["$oper$cond $Rn, $Rm, rrx"],
  },
  {
    arm: true,
    ref: "4.5,4.5.2,4.5.8.2",
    category: "Data Processing",
    codeParts: [
      { s: 4, k: "register", sym: "Rm" },
      { s: 1, k: "value", v: 0 }, // instruction specified shift amount
      { s: 2, k: "enum", sym: "shift", enum: ["lsl/asl", "lsr", "asr", "ror"] },
      { s: 5, k: "immediate", sym: "amount" },
      { s: 4, k: "ignored", sym: "Rd", v: 0 }, // Rd is ignored for tst/teq/cmp/cmn
      { s: 4, k: "register", sym: "Rn" },
      { s: 1, k: "value", sym: "s", v: 1 }, // s is always 1 for tst/teq/cmp/cmn
      {
        s: 4,
        k: "enum",
        sym: "oper",
        enum: [
          false,
          false,
          false,
          false,
          false,
          false,
          false,
          false,
          "tst",
          "teq",
          "cmp",
          "cmn",
          false,
          false,
          false,
          false,
        ],
      },
      { s: 1, k: "value", sym: "immediate", v: 0 }, // immediate = 0
      { s: 2, k: "value", v: 0 },
      condition,
    ],
    syntax: ["$oper$cond $Rn, $Rm, $shift #$amount"],
  },
  {
    arm: true,
    ref: "4.5,4.5.2,4.5.8.2",
    category: "Data Processing",
    codeParts: [
      { s: 4, k: "register", sym: "Rm" },
      { s: 1, k: "value", v: 1 }, // register specified shift amount
      { s: 2, k: "enum", sym: "shift", enum: ["lsl/asl", "lsr", "asr", "ror"] },
      { s: 1, k: "value", v: 0 },
      { s: 4, k: "register", sym: "Rs" },
      { s: 4, k: "ignored", sym: "Rd", v: 0 }, // Rd is ignored for tst/teq/cmp/cmn
      { s: 4, k: "register", sym: "Rn" },
      { s: 1, k: "value", sym: "s", v: 1 }, // s is always 1 for tst/teq/cmp/cmn
      {
        s: 4,
        k: "enum",
        sym: "oper",
        enum: [
          false,
          false,
          false,
          false,
          false,
          false,
          false,
          false,
          "tst",
          "teq",
          "cmp",
          "cmn",
          false,
          false,
          false,
          false,
        ],
      },
      { s: 1, k: "value", sym: "immediate", v: 0 }, // immediate = 0
      { s: 2, k: "value", v: 0 },
      condition,
    ],
    syntax: ["$oper$cond $Rn, $Rm, $shift $Rs"],
  },
  {
    arm: true,
    ref: "4.5,4.5.3,4.5.8.2",
    category: "Data Processing",
    codeParts: [
      { s: 12, k: "rotimm", sym: "expression" },
      { s: 4, k: "ignored", sym: "Rd", v: 0 }, // Rd is ignored for tst/teq/cmp/cmn
      { s: 4, k: "register", sym: "Rn" },
      { s: 1, k: "value", sym: "s", v: 1 }, // s is always 1 for tst/teq/cmp/cmn
      {
        s: 4,
        k: "enum",
        sym: "oper",
        enum: [
          false,
          false,
          false,
          false,
          false,
          false,
          false,
          false,
          "tst",
          "teq",
          "cmp",
          "cmn",
          false,
          false,
          false,
          false,
        ],
      },
      { s: 1, k: "value", sym: "immediate", v: 1 }, // immediate = 1
      { s: 2, k: "value", v: 0 },
      condition,
    ],
    syntax: ["$oper$cond $Rn, #$expression"],
  },
  // and,eor,sub,rsb,add,adc,sbc,rsc,orr,bic
  {
    arm: true,
    ref: "4.5,4.5.2,4.5.8.3",
    category: "Data Processing",
    codeParts: [
      { s: 4, k: "register", sym: "Rm" },
      { s: 1, k: "value", v: 0 }, // instruction specified shift amount
      { s: 2, k: "value", sym: "shift", v: 0 }, // shift = lsl
      { s: 5, k: "value", sym: "amount", v: 0 }, // amount = 0
      { s: 4, k: "register", sym: "Rd" },
      { s: 4, k: "register", sym: "Rn" },
      { s: 1, k: "enum", sym: "s", enum: ["", "s"] },
      {
        s: 4,
        k: "enum",
        sym: "oper",
        enum: [
          "and",
          "eor",
          "sub",
          "rsb",
          "add",
          "adc",
          "sbc",
          "rsc",
          false,
          false,
          false,
          false,
          "orr",
          false,
          "bic",
          false,
        ],
      },
      { s: 1, k: "value", sym: "immediate", v: 0 }, // immediate = 0
      { s: 2, k: "value", v: 0 },
      condition,
    ],
    syntax: [
      "$oper$cond$s $Rd, $Rn, $Rm",
      "$oper$cond$s $Rd, $Rn, $Rm, lsr #0",
      "$oper$cond$s $Rd, $Rn, $Rm, asr #0",
      "$oper$cond$s $Rd, $Rn, $Rm, ror #0",
    ],
  },
  {
    arm: true,
    ref: "4.5,4.5.2,4.5.8.3",
    category: "Data Processing",
    codeParts: [
      { s: 4, k: "register", sym: "Rm" },
      { s: 1, k: "value", v: 0 }, // instruction specified shift amount
      { s: 2, k: "value", sym: "shift", v: 1 }, // shift = lsr
      { s: 5, k: "value", sym: "amount", v: 0 }, // amount = 0
      { s: 4, k: "register", sym: "Rd" },
      { s: 4, k: "register", sym: "Rn" },
      { s: 1, k: "enum", sym: "s", enum: ["", "s"] },
      {
        s: 4,
        k: "enum",
        sym: "oper",
        enum: [
          "and",
          "eor",
          "sub",
          "rsb",
          "add",
          "adc",
          "sbc",
          "rsc",
          false,
          false,
          false,
          false,
          "orr",
          false,
          "bic",
          false,
        ],
      },
      { s: 1, k: "value", sym: "immediate", v: 0 }, // immediate = 0
      { s: 2, k: "value", v: 0 },
      condition,
    ],
    syntax: ["$oper$cond$s $Rd, $Rn, $Rm, lsr #32"],
  },
  {
    arm: true,
    ref: "4.5,4.5.2,4.5.8.3",
    category: "Data Processing",
    codeParts: [
      { s: 4, k: "register", sym: "Rm" },
      { s: 1, k: "value", v: 0 }, // instruction specified shift amount
      { s: 2, k: "value", sym: "shift", v: 2 }, // shift = asr
      { s: 5, k: "value", sym: "amount", v: 0 }, // amount = 0
      { s: 4, k: "register", sym: "Rd" },
      { s: 4, k: "register", sym: "Rn" },
      { s: 1, k: "enum", sym: "s", enum: ["", "s"] },
      {
        s: 4,
        k: "enum",
        sym: "oper",
        enum: [
          "and",
          "eor",
          "sub",
          "rsb",
          "add",
          "adc",
          "sbc",
          "rsc",
          false,
          false,
          false,
          false,
          "orr",
          false,
          "bic",
          false,
        ],
      },
      { s: 1, k: "value", sym: "immediate", v: 0 }, // immediate = 0
      { s: 2, k: "value", v: 0 },
      condition,
    ],
    syntax: ["$oper$cond$s $Rd, $Rn, $Rm, asr #32"],
  },
  {
    arm: true,
    ref: "4.5,4.5.2,4.5.8.3",
    category: "Data Processing",
    codeParts: [
      { s: 4, k: "register", sym: "Rm" },
      { s: 1, k: "value", v: 0 }, // instruction specified shift amount
      { s: 2, k: "value", sym: "shift", v: 3 }, // shift = ror
      { s: 5, k: "value", sym: "amount", v: 0 }, // amount = 0
      { s: 4, k: "register", sym: "Rd" },
      { s: 4, k: "register", sym: "Rn" },
      { s: 1, k: "enum", sym: "s", enum: ["", "s"] },
      {
        s: 4,
        k: "enum",
        sym: "oper",
        enum: [
          "and",
          "eor",
          "sub",
          "rsb",
          "add",
          "adc",
          "sbc",
          "rsc",
          false,
          false,
          false,
          false,
          "orr",
          false,
          "bic",
          false,
        ],
      },
      { s: 1, k: "value", sym: "immediate", v: 0 }, // immediate = 0
      { s: 2, k: "value", v: 0 },
      condition,
    ],
    syntax: ["$oper$cond$s $Rd, $Rn, $Rm, rrx"],
  },
  {
    arm: true,
    ref: "4.5,4.5.2,4.5.8.3",
    category: "Data Processing",
    codeParts: [
      { s: 4, k: "register", sym: "Rm" },
      { s: 1, k: "value", v: 0 }, // instruction specified shift amount
      { s: 2, k: "enum", sym: "shift", enum: ["lsl/asl", "lsr", "asr", "ror"] },
      { s: 5, k: "immediate", sym: "amount" },
      { s: 4, k: "register", sym: "Rd" },
      { s: 4, k: "register", sym: "Rn" },
      { s: 1, k: "enum", sym: "s", enum: ["", "s"] },
      {
        s: 4,
        k: "enum",
        sym: "oper",
        enum: [
          "and",
          "eor",
          "sub",
          "rsb",
          "add",
          "adc",
          "sbc",
          "rsc",
          false,
          false,
          false,
          false,
          "orr",
          false,
          "bic",
          false,
        ],
      },
      { s: 1, k: "value", sym: "immediate", v: 0 }, // immediate = 0
      { s: 2, k: "value", v: 0 },
      condition,
    ],
    syntax: ["$oper$cond$s $Rd, $Rn, $Rm, $shift #$amount"],
  },
  {
    arm: true,
    ref: "4.5,4.5.2,4.5.8.3",
    category: "Data Processing",
    codeParts: [
      { s: 4, k: "register", sym: "Rm" },
      { s: 1, k: "value", v: 1 }, // register specified shift amount
      { s: 2, k: "enum", sym: "shift", enum: ["lsl/asl", "lsr", "asr", "ror"] },
      { s: 1, k: "value", v: 0 },
      { s: 4, k: "register", sym: "Rs" },
      { s: 4, k: "register", sym: "Rd" },
      { s: 4, k: "register", sym: "Rn" },
      { s: 1, k: "enum", sym: "s", enum: ["", "s"] },
      {
        s: 4,
        k: "enum",
        sym: "oper",
        enum: [
          "and",
          "eor",
          "sub",
          "rsb",
          "add",
          "adc",
          "sbc",
          "rsc",
          false,
          false,
          false,
          false,
          "orr",
          false,
          "bic",
          false,
        ],
      },
      { s: 1, k: "value", sym: "immediate", v: 0 }, // immediate = 0
      { s: 2, k: "value", v: 0 },
      condition,
    ],
    syntax: ["$oper$cond$s $Rd, $Rn, $Rm, $shift $Rs"],
  },
  {
    arm: true,
    ref: "4.5,4.5.3,4.5.8.3",
    category: "Data Processing",
    codeParts: [
      { s: 12, k: "rotimm", sym: "expression" },
      { s: 4, k: "register", sym: "Rd" },
      { s: 4, k: "register", sym: "Rn" },
      { s: 1, k: "enum", sym: "s", enum: ["", "s"] },
      {
        s: 4,
        k: "enum",
        sym: "oper",
        enum: [
          "and",
          "eor",
          "sub",
          "rsb",
          "add",
          "adc",
          "sbc",
          "rsc",
          false,
          false,
          false,
          false,
          "orr",
          false,
          "bic",
          false,
        ],
      },
      { s: 1, k: "value", sym: "immediate", v: 1 }, // immediate = 1
      { s: 2, k: "value", v: 0 },
      condition,
    ],
    syntax: ["$oper$cond$s $Rd, $Rn, #$expression"],
  },

  //
  // PSR TRANSFER
  //

  {
    arm: true,
    ref: "4.6,4.6.4.1",
    category: "PSR Transfer",
    codeParts: [
      { s: 12, k: "value", v: 0 },
      { s: 4, k: "register", sym: "Rd" },
      { s: 6, k: "value", v: 15 },
      { s: 1, k: "enum", sym: "psr", enum: ["cpsr", "spsr"] },
      { s: 5, k: "value", v: 2 },
      condition,
    ],
    syntax: [
      "mov$cond $Rd, $psr",
      "mrs$cond $Rd, $psr",
    ],
  },
  {
    arm: true,
    ref: "4.6,4.6.4.2",
    category: "PSR Transfer",
    codeParts: [
      { s: 4, k: "register", sym: "Rm" },
      { s: 8, k: "value", v: 0 },
      { s: 10, k: "value", v: 671 },
      { s: 1, k: "enum", sym: "psr", enum: ["cpsr", "spsr"] },
      { s: 5, k: "value", v: 2 },
      condition,
    ],
    syntax: [
      "mov$cond $psr, $Rm",
      "msr$cond $psr, $Rm",
    ],
  },
  {
    arm: true,
    ref: "4.6,4.6.4.3",
    category: "PSR Transfer",
    codeParts: [
      { s: 4, k: "register", sym: "Rm" },
      { s: 8, k: "value", v: 0 },
      { s: 10, k: "value", v: 655 },
      { s: 1, k: "enum", sym: "psrf", enum: ["cpsr_flg", "spsr_flg"] },
      { s: 2, k: "value", v: 2 },
      { s: 1, k: "value", sym: "immediate", v: 0 }, // immediate = 0
      { s: 2, k: "value", v: 0 },
      condition,
    ],
    syntax: [
      "mov$cond $psrf, $Rm",
      "msr$cond $psrf, $Rm",
    ],
  },
  {
    arm: true,
    ref: "4.6,4.6.4.4",
    category: "PSR Transfer",
    codeParts: [
      { s: 12, k: "rotimm", sym: "expression" },
      { s: 10, k: "value", v: 655 },
      { s: 1, k: "enum", sym: "psrf", enum: ["cpsr_flg", "spsr_flg"] },
      { s: 2, k: "value", v: 2 },
      { s: 1, k: "value", sym: "immediate", v: 1 }, // immediate = 1
      { s: 2, k: "value", v: 0 },
      condition,
    ],
    syntax: [
      "mov$cond $psrf, #$expression",
      "msr$cond $psrf, #$expression",
    ],
  },

  //
  // MULTIPLY AND MULTIPLY-ACCUMULATE
  //

  {
    arm: true,
    ref: "4.7,4.7.4.1",
    category: "Multiply and Multiply-Accumulate",
    codeParts: [
      { s: 4, k: "register", sym: "Rm" },
      { s: 4, k: "value", v: 9 },
      { s: 4, k: "register", sym: "Rs" },
      { s: 4, k: "value", sym: "Rn", v: 0 }, // Rn must be 0
      { s: 4, k: "register", sym: "Rd" },
      { s: 1, k: "enum", sym: "s", enum: ["", "s"] },
      { s: 1, k: "value", v: 0 }, // multiply only
      { s: 6, k: "value", v: 0 },
      condition,
    ],
    syntax: ["mul$cond$s $Rd, $Rm, $Rs"],
  },
  {
    arm: true,
    ref: "4.7,4.7.4.2",
    category: "Multiply and Multiply-Accumulate",
    codeParts: [
      { s: 4, k: "register", sym: "Rm" },
      { s: 4, k: "value", v: 9 },
      { s: 4, k: "register", sym: "Rs" },
      { s: 4, k: "register", sym: "Rn" },
      { s: 4, k: "register", sym: "Rd" },
      { s: 1, k: "enum", sym: "s", enum: ["", "s"] },
      { s: 1, k: "value", v: 1 }, // multiply and accumulate
      { s: 6, k: "value", v: 0 },
      condition,
    ],
    syntax: ["mla$cond$s $Rd, $Rm, $Rs, $Rn"],
  },

  //
  // MULTIPLY LONG AND MULTIPLY-ACCUMULATE LONG
  //

  {
    arm: true,
    ref: "4.8,4.8.4",
    category: "Multiply Long and Multiply-Accumulate Long",
    codeParts: [
      { s: 4, k: "register", sym: "Rm" },
      { s: 4, k: "value", v: 9 },
      { s: 4, k: "register", sym: "Rs" },
      { s: 4, k: "register", sym: "RdLo" },
      { s: 4, k: "register", sym: "RdHi" },
      { s: 1, k: "enum", sym: "s", enum: ["", "s"] },
      { s: 1, k: "enum", sym: "oper", enum: ["mull", "mlal"] },
      { s: 1, k: "enum", sym: "u", enum: ["u", "s"] },
      { s: 5, k: "value", v: 1 },
      condition,
    ],
    syntax: ["$u$oper$cond$s $RdLo, $RdHi, $Rm, $Rs"],
  },

  //
  // SINGLE DATA TRANSFER
  //

  {
    arm: true,
    ref: "4.9,4.9.8.2.1",
    category: "Single Data Transfer",
    codeParts: [
      { s: 12, k: "value", sym: "offset", v: 0 }, // offset = 0
      { s: 4, k: "register", sym: "Rd" },
      { s: 4, k: "register", sym: "Rn" },
      { s: 1, k: "enum", sym: "oper", enum: ["str", "ldr"] },
      { s: 1, k: "ignored", sym: "w", v: 0 }, // write back doesn't matter because offset is 0
      { s: 1, k: "enum", sym: "b", enum: ["", "b"] },
      { s: 1, k: "ignored", sym: "u", v: 0 }, // up/down doesn't matter because offset is 0
      { s: 1, k: "value", sym: "p", v: 1 }, // pre-indexing
      { s: 1, k: "value", sym: "immediate", v: 0 }, // immediate = 0
      { s: 2, k: "value", v: 1 },
      condition,
    ],
    syntax: ["$oper$cond$b $Rd, [$Rn]"],
  },
  {
    arm: true,
    ref: "4.9,4.9.8.2.2",
    category: "Single Data Transfer",
    codeParts: [
      { s: 12, k: "offset12", sym: "offset" },
      { s: 4, k: "register", sym: "Rd" },
      { s: 4, k: "register", sym: "Rn" },
      { s: 1, k: "enum", sym: "oper", enum: ["str", "ldr"] },
      { s: 1, k: "enum", sym: "w", enum: ["", "!"] },
      { s: 1, k: "enum", sym: "b", enum: ["", "b"] },
      { s: 1, k: "enum", sym: "u", enum: ["-", "/+"] },
      { s: 1, k: "value", sym: "p", v: 1 }, // pre-indexing
      { s: 1, k: "value", sym: "immediate", v: 0 }, // immediate = 0
      { s: 2, k: "value", v: 1 },
      condition,
    ],
    syntax: ["$oper$cond$b $Rd, [$Rn, #$u$offset]$w"],
  },
  {
    arm: true,
    ref: "4.9,4.9.8.2.3",
    category: "Single Data Transfer",
    codeParts: [
      { s: 4, k: "register", sym: "Rm" },
      { s: 8, k: "value", sym: "shift", v: 0 }, // shift = 0
      { s: 4, k: "register", sym: "Rd" },
      { s: 4, k: "register", sym: "Rn" },
      { s: 1, k: "enum", sym: "oper", enum: ["str", "ldr"] },
      { s: 1, k: "enum", sym: "w", enum: ["", "!"] },
      { s: 1, k: "enum", sym: "b", enum: ["", "b"] },
      { s: 1, k: "enum", sym: "u", enum: ["-", "/+"] },
      { s: 1, k: "value", sym: "p", v: 1 }, // pre-indexing
      { s: 1, k: "value", sym: "immediate", v: 1 }, // immediate = 1
      { s: 2, k: "value", v: 1 },
      condition,
    ],
    syntax: ["$oper$cond$b $Rd, [$Rn, $u$Rm]$w"],
  },
  {
    arm: true,
    ref: "4.9,4.9.8.2.3",
    category: "Single Data Transfer",
    codeParts: [
      { s: 4, k: "register", sym: "Rm" },
      { s: 8, k: "immediate", sym: "shift" },
      { s: 4, k: "register", sym: "Rd" },
      { s: 4, k: "register", sym: "Rn" },
      { s: 1, k: "enum", sym: "oper", enum: ["str", "ldr"] },
      { s: 1, k: "enum", sym: "w", enum: ["", "!"] },
      { s: 1, k: "enum", sym: "b", enum: ["", "b"] },
      { s: 1, k: "enum", sym: "u", enum: ["-", "/+"] },
      { s: 1, k: "value", sym: "p", v: 1 }, // pre-indexing
      { s: 1, k: "value", sym: "immediate", v: 1 }, // immediate = 1
      { s: 2, k: "value", v: 1 },
      condition,
    ],
    syntax: ["$oper$cond$b $Rd, [$Rn, $u$Rm, $shift]$w"],
  },
  {
    arm: true,
    ref: "4.9,4.9.8.3.1",
    category: "Single Data Transfer",
    codeParts: [
      { s: 12, k: "offset12", sym: "offset" },
      { s: 4, k: "register", sym: "Rd" },
      { s: 4, k: "register", sym: "Rn" },
      { s: 1, k: "enum", sym: "oper", enum: ["str", "ldr"] },
      { s: 1, k: "enum", sym: "w", enum: ["", "t"] },
      { s: 1, k: "enum", sym: "b", enum: ["", "b"] },
      { s: 1, k: "enum", sym: "u", enum: ["-", "/+"] },
      { s: 1, k: "value", sym: "p", v: 0 }, // post-indexing
      { s: 1, k: "value", sym: "immediate", v: 0 }, // immediate = 0
      { s: 2, k: "value", v: 1 },
      condition,
    ],
    syntax: ["$oper$cond$b$w $Rd, [$Rn], #$u$offset"],
  },
  {
    arm: true,
    ref: "4.9,4.9.8.3.2",
    category: "Single Data Transfer",
    codeParts: [
      { s: 4, k: "register", sym: "Rm" },
      { s: 8, k: "value", sym: "shift", v: 0 }, // shift = 0
      { s: 4, k: "register", sym: "Rd" },
      { s: 4, k: "register", sym: "Rn" },
      { s: 1, k: "enum", sym: "oper", enum: ["str", "ldr"] },
      { s: 1, k: "enum", sym: "w", enum: ["", "t"] },
      { s: 1, k: "enum", sym: "b", enum: ["", "b"] },
      { s: 1, k: "enum", sym: "u", enum: ["-", "/+"] },
      { s: 1, k: "value", sym: "p", v: 0 }, // post-indexing
      { s: 1, k: "value", sym: "immediate", v: 1 }, // immediate = 1
      { s: 2, k: "value", v: 1 },
      condition,
    ],
    syntax: ["$oper$cond$b$w $Rd, [$Rn], #$u$Rm"],
  },
  {
    arm: true,
    ref: "4.9,4.9.8.3.2",
    category: "Single Data Transfer",
    codeParts: [
      { s: 4, k: "register", sym: "Rm" },
      { s: 8, k: "immediate", sym: "shift" },
      { s: 4, k: "register", sym: "Rd" },
      { s: 4, k: "register", sym: "Rn" },
      { s: 1, k: "enum", sym: "oper", enum: ["str", "ldr"] },
      { s: 1, k: "enum", sym: "w", enum: ["", "t"] },
      { s: 1, k: "enum", sym: "b", enum: ["", "b"] },
      { s: 1, k: "enum", sym: "u", enum: ["-", "/+"] },
      { s: 1, k: "value", sym: "p", v: 0 }, // post-indexing
      { s: 1, k: "value", sym: "immediate", v: 1 }, // immediate = 1
      { s: 2, k: "value", v: 1 },
      condition,
    ],
    syntax: ["$oper$cond$b$w $Rd, [$Rn], #$u$Rm, $shift"],
  },

  //
  // HALFWORD AND SIGNED DATA TRANSFER
  //

  {
    arm: true,
    ref: "4.10,4.10.8.2.1",
    category: "Halfword and Signed Data Transfer",
    codeParts: [
      { s: 4, k: "value", sym: "offset", v: 0 }, // offset = 0
      { s: 1, k: "value", v: 1 },
      { s: 2, k: "enum", sym: "sh", enum: [false, "h", false, false] },
      { s: 1, k: "value", v: 1 },
      { s: 4, k: "value", sym: "offset", v: 0 }, // offset = 0
      { s: 4, k: "register", sym: "Rd" },
      { s: 4, k: "register", sym: "Rn" },
      { s: 1, k: "value", sym: "l", v: 0 }, // store
      { s: 1, k: "ignored", sym: "w", v: 0 }, // write back doesn't matter because offset is 0
      { s: 1, k: "value", sym: "immediate", v: 1 }, // immediate = 1
      { s: 1, k: "ignored", sym: "u", v: 0 }, // up/down doesn't matter because offset is 0
      { s: 1, k: "value", sym: "p", v: 1 }, // pre-indexing
      { s: 3, k: "value", v: 0 },
      condition,
    ],
    syntax: ["str$cond$sh $Rd, [$Rn]"],
  },
  {
    arm: true,
    ref: "4.10,4.10.8.2.2",
    category: "Halfword and Signed Data Transfer",
    codeParts: [
      { s: 4, k: "offsetlow", sym: "offset" },
      { s: 1, k: "value", v: 1 },
      { s: 2, k: "enum", sym: "sh", enum: [false, "h", false, false] },
      { s: 1, k: "value", v: 1 },
      { s: 4, k: "offsethigh", sym: "offset" },
      { s: 4, k: "register", sym: "Rd" },
      { s: 4, k: "register", sym: "Rn" },
      { s: 1, k: "value", sym: "l", v: 0 }, // store
      { s: 1, k: "enum", sym: "w", enum: ["", "!"] },
      { s: 1, k: "value", sym: "immediate", v: 1 }, // immediate = 1
      { s: 1, k: "enum", sym: "u", enum: ["-", "/+"] },
      { s: 1, k: "value", sym: "p", v: 1 }, // pre-indexing
      { s: 3, k: "value", v: 0 },
      condition,
    ],
    syntax: ["str$cond$sh $Rd, [$Rn, #$u$offset]$w"],
  },
  // TODO:
  //
  // 4.10,4.10.8.2.3  strh Rd,[Rn,{+-}Rm]{!}                      P=1,L=0,SH=01,immediate=0
  // 4.10,4.10.8.3.1  strh Rd,[Rn],<#{+-}expression>              P=0,W=0,L=0,SH=01,immediate=1
  // 4.10,4.10.8.3.2  strh Rd,{+-}Rm                              P=0,W=0,L=0,SH=01,immediate=0
  // 4.10,4.10.8.2.1  ldr{h/sb/sh} Rd,[Rn]                        P=1,W=?,L=1,immediate=1,offset=0
  // 4.10,4.10.8.2.2  ldr{h/sb/sh} Rd,[Rn,<#{+-}expression}>]{!}  P=1,L=1,immediate=1
  // 4.10,4.10.8.2.3  ldr{h/sb/sh} Rd,[Rn,{+-}Rm]{!}              P=1,L=1,immediate=0
  // 4.10,4.10.8.3.1  ldr{h/sb/sh} Rd,[Rn],<#{+-}expression>      P=0,W=0,L=1,immediate=1
  // 4.10,4.10.8.3.2  ldr{h/sb/sh} Rd,[Rn],{+-}Rm                 P=0,W=0,L=1,immediate=0
]);
