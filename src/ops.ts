//
// gbasm - Assembler and disassembler for Game Boy Advance homebrew
// by Sean Connelly (@velipso), https://sean.cm
// The Unlicense License
// Project Home: https://github.com/velipso/gbasm
//

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

interface ICodePartImmediate {
  s: number;
  k: "immediate";
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

interface ICodePartValue {
  s: number;
  k: "value";
  v: number;
  sym?: string;
}

interface ICodePartIgnored {
  s: number;
  k: "ignored";
  v: number;
  sym: string;
}

export namespace Arm {
  interface ICodePartRegister {
    s: 4;
    k: "register";
    sym: string;
  }

  interface ICodePartRotimm {
    s: 12;
    k: "rotimm";
    sym: string;
  }

  interface ICodePartWord {
    s: number;
    k: "word";
    sym: string;
  }

  interface ICodePartOffset12 {
    s: 12;
    k: "offset12";
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

  interface ICodePartRegList {
    s: 16;
    k: "reglist";
    sym: string;
  }

  export type ICodePart =
    | ICodePartEnum1
    | ICodePartEnum2
    | ICodePartEnum3
    | ICodePartEnum4
    | ICodePartImmediate
    | ICodePartValue
    | ICodePartIgnored
    | ICodePartRegister
    | ICodePartRotimm
    | ICodePartWord
    | ICodePartOffset12
    | ICodePartOffsetLow
    | ICodePartOffsetHigh
    | ICodePartRegList;

  export interface IOp {
    ref: string;
    category:
      | "Branch"
      | "Data Processing"
      | "PSR Transfer"
      | "Multiply and Multiply-Accumulate"
      | "Multiply Long and Multiply-Accumulate Long"
      | "Single Data Transfer"
      | "Halfword and Signed Data Transfer"
      | "Block Data Transfer"
      | "Single Data Swap"
      | "Software Interrupt";
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
      ref: "4.4",
      category: "Branch",
      codeParts: [
        { s: 24, k: "word", sym: "offset" },
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
        "$oper$s$cond $Rd, $Rm",
        "$oper$s$cond $Rd, $Rm, lsl #0",
        "$oper$s$cond $Rd, $Rm, lsr #0",
        "$oper$s$cond $Rd, $Rm, asr #0",
        "$oper$s$cond $Rd, $Rm, ror #0",
        "$oper$cond$s $Rd, $Rm",
        "$oper$cond$s $Rd, $Rm, lsl #0",
        "$oper$cond$s $Rd, $Rm, lsr #0",
        "$oper$cond$s $Rd, $Rm, asr #0",
        "$oper$cond$s $Rd, $Rm, ror #0",
      ],
    },
    {
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
      syntax: [
        "$oper$s$cond $Rd, $Rm, lsr #32",
        "$oper$cond$s $Rd, $Rm, lsr #32",
      ],
    },
    {
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
      syntax: [
        "$oper$s$cond $Rd, $Rm, asr #32",
        "$oper$cond$s $Rd, $Rm, asr #32",
      ],
    },
    {
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
      syntax: [
        "$oper$s$cond $Rd, $Rm, rrx",
        "$oper$cond$s $Rd, $Rm, rrx",
      ],
    },
    {
      ref: "4.5,4.5.2,4.5.8.1",
      category: "Data Processing",
      codeParts: [
        { s: 4, k: "register", sym: "Rm" },
        { s: 1, k: "value", v: 0 }, // instruction specified shift amount
        {
          s: 2,
          k: "enum",
          sym: "shift",
          enum: ["lsl/asl", "lsr", "asr", "ror"],
        },
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
      syntax: [
        "$oper$s$cond $Rd, $Rm, $shift #$amount",
        "$oper$cond$s $Rd, $Rm, $shift #$amount",
      ],
    },
    {
      ref: "4.5,4.5.2,4.5.8.1",
      category: "Data Processing",
      codeParts: [
        { s: 4, k: "register", sym: "Rm" },
        { s: 1, k: "value", v: 1 }, // register specified shift amount
        {
          s: 2,
          k: "enum",
          sym: "shift",
          enum: ["lsl/asl", "lsr", "asr", "ror"],
        },
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
      syntax: [
        "$oper$s$cond $Rd, $Rm, $shift $Rs",
        "$oper$cond$s $Rd, $Rm, $shift $Rs",
      ],
    },
    {
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
      syntax: [
        "$oper$s$cond $Rd, #$expression",
        "$oper$cond$s $Rd, #$expression",
      ],
    },
    // tst/teq/cmp/cmn
    {
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
      ref: "4.5,4.5.2,4.5.8.2",
      category: "Data Processing",
      codeParts: [
        { s: 4, k: "register", sym: "Rm" },
        { s: 1, k: "value", v: 0 }, // instruction specified shift amount
        {
          s: 2,
          k: "enum",
          sym: "shift",
          enum: ["lsl/asl", "lsr", "asr", "ror"],
        },
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
      ref: "4.5,4.5.2,4.5.8.2",
      category: "Data Processing",
      codeParts: [
        { s: 4, k: "register", sym: "Rm" },
        { s: 1, k: "value", v: 1 }, // register specified shift amount
        {
          s: 2,
          k: "enum",
          sym: "shift",
          enum: ["lsl/asl", "lsr", "asr", "ror"],
        },
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
        "$oper$s$cond $Rd, $Rn, $Rm",
        "$oper$s$cond $Rd, $Rn, $Rm, lsr #0",
        "$oper$s$cond $Rd, $Rn, $Rm, asr #0",
        "$oper$s$cond $Rd, $Rn, $Rm, ror #0",
        "$oper$cond$s $Rd, $Rn, $Rm",
        "$oper$cond$s $Rd, $Rn, $Rm, lsr #0",
        "$oper$cond$s $Rd, $Rn, $Rm, asr #0",
        "$oper$cond$s $Rd, $Rn, $Rm, ror #0",
      ],
    },
    {
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
      syntax: [
        "$oper$s$cond $Rd, $Rn, $Rm, lsr #32",
        "$oper$cond$s $Rd, $Rn, $Rm, lsr #32",
      ],
    },
    {
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
      syntax: [
        "$oper$s$cond $Rd, $Rn, $Rm, asr #32",
        "$oper$cond$s $Rd, $Rn, $Rm, asr #32",
      ],
    },
    {
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
      syntax: [
        "$oper$s$cond $Rd, $Rn, $Rm, rrx",
        "$oper$cond$s $Rd, $Rn, $Rm, rrx",
      ],
    },
    {
      ref: "4.5,4.5.2,4.5.8.3",
      category: "Data Processing",
      codeParts: [
        { s: 4, k: "register", sym: "Rm" },
        { s: 1, k: "value", v: 0 }, // instruction specified shift amount
        {
          s: 2,
          k: "enum",
          sym: "shift",
          enum: ["lsl/asl", "lsr", "asr", "ror"],
        },
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
      syntax: [
        "$oper$s$cond $Rd, $Rn, $Rm, $shift #$amount",
        "$oper$cond$s $Rd, $Rn, $Rm, $shift #$amount",
      ],
    },
    {
      ref: "4.5,4.5.2,4.5.8.3",
      category: "Data Processing",
      codeParts: [
        { s: 4, k: "register", sym: "Rm" },
        { s: 1, k: "value", v: 1 }, // register specified shift amount
        {
          s: 2,
          k: "enum",
          sym: "shift",
          enum: ["lsl/asl", "lsr", "asr", "ror"],
        },
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
      syntax: [
        "$oper$s$cond $Rd, $Rn, $Rm, $shift $Rs",
        "$oper$cond$s $Rd, $Rn, $Rm, $shift $Rs",
      ],
    },
    {
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
      syntax: [
        "$oper$s$cond $Rd, $Rn, #$expression",
        "$oper$cond$s $Rd, $Rn, #$expression",
      ],
    },

    //
    // PSR TRANSFER
    //

    {
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
      syntax: [
        "mul$s$cond $Rd, $Rm, $Rs",
        "mul$cond$s $Rd, $Rm, $Rs",
      ],
    },
    {
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
      syntax: [
        "mla$s$cond $Rd, $Rm, $Rs, $Rn",
        "mla$cond$s $Rd, $Rm, $Rs, $Rn",
      ],
    },

    //
    // MULTIPLY LONG AND MULTIPLY-ACCUMULATE LONG
    //

    {
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
      syntax: [
        "$u$oper$s$cond $RdLo, $RdHi, $Rm, $Rs",
        "$u$oper$cond$s $RdLo, $RdHi, $Rm, $Rs",
      ],
    },

    //
    // SINGLE DATA TRANSFER
    //

    {
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
      syntax: [
        "$oper$b$cond $Rd, [$Rn]",
        "$oper$cond$b $Rd, [$Rn]",
      ],
    },
    {
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
      syntax: [
        "$oper$b$cond $Rd, [$Rn, #$u$offset]$w",
        "$oper$cond$b $Rd, [$Rn, #$u$offset]$w",
      ],
    },
    {
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
      syntax: [
        "$oper$b$cond $Rd, [$Rn, $u$Rm]$w",
        "$oper$cond$b $Rd, [$Rn, $u$Rm]$w",
      ],
    },
    {
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
      syntax: [
        "$oper$b$cond $Rd, [$Rn, $u$Rm, $shift]$w",
        "$oper$cond$b $Rd, [$Rn, $u$Rm, $shift]$w",
      ],
    },
    {
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
      syntax: [
        "$oper$b$w$cond $Rd, [$Rn], #$u$offset",
        "$oper$cond$b$w $Rd, [$Rn], #$u$offset",
      ],
    },
    {
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
      syntax: [
        "$oper$b$w$cond $Rd, [$Rn], #$u$Rm",
        "$oper$cond$b$w $Rd, [$Rn], #$u$Rm",
      ],
    },
    {
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
      syntax: [
        "$oper$b$w$cond $Rd, [$Rn], #$u$Rm, $shift",
        "$oper$cond$b$w $Rd, [$Rn], #$u$Rm, $shift",
      ],
    },

    //
    // HALFWORD AND SIGNED DATA TRANSFER
    //

    {
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
      syntax: [
        "str$sh$cond $Rd, [$Rn]",
        "str$cond$sh $Rd, [$Rn]",
      ],
    },
    {
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
      syntax: [
        "str$sh$cond $Rd, [$Rn, #$u$offset]$w",
        "str$cond$sh $Rd, [$Rn, #$u$offset]$w",
      ],
    },
    {
      ref: "4.10,4.10.8.2.3",
      category: "Halfword and Signed Data Transfer",
      codeParts: [
        { s: 4, k: "register", sym: "Rm" },
        { s: 1, k: "value", v: 1 },
        { s: 2, k: "enum", sym: "sh", enum: [false, "h", false, false] },
        { s: 1, k: "value", v: 1 },
        { s: 4, k: "value", v: 0 },
        { s: 4, k: "register", sym: "Rd" },
        { s: 4, k: "register", sym: "Rn" },
        { s: 1, k: "value", sym: "l", v: 0 }, // store
        { s: 1, k: "enum", sym: "w", enum: ["", "!"] },
        { s: 1, k: "value", sym: "immediate", v: 0 }, // immediate = 0
        { s: 1, k: "enum", sym: "u", enum: ["-", "/+"] },
        { s: 1, k: "value", sym: "p", v: 1 }, // pre-indexing
        { s: 3, k: "value", v: 0 },
        condition,
      ],
      syntax: [
        "str$sh$cond $Rd, [$Rn, $u$Rm]$w",
        "str$cond$sh $Rd, [$Rn, $u$Rm]$w",
      ],
    },
    {
      ref: "4.10,4.10.8.3.1",
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
        { s: 1, k: "value", sym: "w", v: 0 }, // write back must be zero for post-indexing
        { s: 1, k: "value", sym: "immediate", v: 1 }, // immediate = 1
        { s: 1, k: "enum", sym: "u", enum: ["-", "/+"] },
        { s: 1, k: "value", sym: "p", v: 0 }, // post-indexing
        { s: 3, k: "value", v: 0 },
        condition,
      ],
      syntax: [
        "str$sh$cond $Rd, [$Rn], #$u$offset",
        "str$cond$sh $Rd, [$Rn], #$u$offset",
      ],
    },
    {
      ref: "4.10,4.10.8.3.2",
      category: "Halfword and Signed Data Transfer",
      codeParts: [
        { s: 4, k: "register", sym: "Rm" },
        { s: 1, k: "value", v: 1 },
        { s: 2, k: "enum", sym: "sh", enum: [false, "h", false, false] },
        { s: 1, k: "value", v: 1 },
        { s: 4, k: "value", v: 0 },
        { s: 4, k: "register", sym: "Rd" },
        { s: 4, k: "register", sym: "Rn" },
        { s: 1, k: "value", sym: "l", v: 0 }, // store
        { s: 1, k: "value", sym: "w", v: 0 }, // write back must be zero for post-indexing
        { s: 1, k: "value", sym: "immediate", v: 0 }, // immediate = 0
        { s: 1, k: "enum", sym: "u", enum: ["-", "/+"] },
        { s: 1, k: "value", sym: "p", v: 0 }, // post-indexing
        { s: 3, k: "value", v: 0 },
        condition,
      ],
      syntax: [
        "str$sh$cond $Rd, [$Rn], $u$Rm",
        "str$cond$sh $Rd, [$Rn], $u$Rm",
      ],
    },
    {
      ref: "4.10,4.10.8.2.1",
      category: "Halfword and Signed Data Transfer",
      codeParts: [
        { s: 4, k: "value", sym: "offset", v: 0 }, // offset = 0
        { s: 1, k: "value", v: 1 },
        { s: 2, k: "enum", sym: "sh", enum: [false, "h", "sb", "sh"] },
        { s: 1, k: "value", v: 1 },
        { s: 4, k: "value", sym: "offset", v: 0 }, // offset = 0
        { s: 4, k: "register", sym: "Rd" },
        { s: 4, k: "register", sym: "Rn" },
        { s: 1, k: "value", sym: "l", v: 1 }, // load
        { s: 1, k: "ignored", sym: "w", v: 0 }, // write back doesn't matter because offset is 0
        { s: 1, k: "value", sym: "immediate", v: 1 }, // immediate = 1
        { s: 1, k: "ignored", sym: "u", v: 0 }, // up/down doesn't matter because offset is 0
        { s: 1, k: "value", sym: "p", v: 1 }, // pre-indexing
        { s: 3, k: "value", v: 0 },
        condition,
      ],
      syntax: [
        "ldr$sh$cond $Rd, [$Rn]",
        "ldr$cond$sh $Rd, [$Rn]",
      ],
    },
    {
      ref: "4.10,4.10.8.2.2",
      category: "Halfword and Signed Data Transfer",
      codeParts: [
        { s: 4, k: "offsetlow", sym: "offset" },
        { s: 1, k: "value", v: 1 },
        { s: 2, k: "enum", sym: "sh", enum: [false, "h", "sb", "sh"] },
        { s: 1, k: "value", v: 1 },
        { s: 4, k: "offsethigh", sym: "offset" },
        { s: 4, k: "register", sym: "Rd" },
        { s: 4, k: "register", sym: "Rn" },
        { s: 1, k: "value", sym: "l", v: 1 }, // load
        { s: 1, k: "enum", sym: "w", enum: ["", "!"] },
        { s: 1, k: "value", sym: "immediate", v: 1 }, // immediate = 1
        { s: 1, k: "enum", sym: "u", enum: ["-", "/+"] },
        { s: 1, k: "value", sym: "p", v: 1 }, // pre-indexing
        { s: 3, k: "value", v: 0 },
        condition,
      ],
      syntax: [
        "ldr$sh$cond $Rd, [$Rn, #$u$offset]$w",
        "ldr$cond$sh $Rd, [$Rn, #$u$offset]$w",
      ],
    },
    {
      ref: "4.10,4.10.8.2.3",
      category: "Halfword and Signed Data Transfer",
      codeParts: [
        { s: 4, k: "register", sym: "Rm" },
        { s: 1, k: "value", v: 1 },
        { s: 2, k: "enum", sym: "sh", enum: [false, "h", "sb", "sh"] },
        { s: 1, k: "value", v: 1 },
        { s: 4, k: "value", v: 0 },
        { s: 4, k: "register", sym: "Rd" },
        { s: 4, k: "register", sym: "Rn" },
        { s: 1, k: "value", sym: "l", v: 1 }, // load
        { s: 1, k: "enum", sym: "w", enum: ["", "!"] },
        { s: 1, k: "value", sym: "immediate", v: 0 }, // immediate = 0
        { s: 1, k: "enum", sym: "u", enum: ["-", "/+"] },
        { s: 1, k: "value", sym: "p", v: 1 }, // pre-indexing
        { s: 3, k: "value", v: 0 },
        condition,
      ],
      syntax: [
        "ldr$sh$cond $Rd, [$Rn, $u$Rm]$w",
        "ldr$cond$sh $Rd, [$Rn, $u$Rm]$w",
      ],
    },
    {
      ref: "4.10,4.10.8.3.1",
      category: "Halfword and Signed Data Transfer",
      codeParts: [
        { s: 4, k: "offsetlow", sym: "offset" },
        { s: 1, k: "value", v: 1 },
        { s: 2, k: "enum", sym: "sh", enum: [false, "h", "sb", "sh"] },
        { s: 1, k: "value", v: 1 },
        { s: 4, k: "offsethigh", sym: "offset" },
        { s: 4, k: "register", sym: "Rd" },
        { s: 4, k: "register", sym: "Rn" },
        { s: 1, k: "value", sym: "l", v: 1 }, // load
        { s: 1, k: "value", sym: "w", v: 0 }, // write back must be zero for post-indexing
        { s: 1, k: "value", sym: "immediate", v: 1 }, // immediate = 1
        { s: 1, k: "enum", sym: "u", enum: ["-", "/+"] },
        { s: 1, k: "value", sym: "p", v: 0 }, // post-indexing
        { s: 3, k: "value", v: 0 },
        condition,
      ],
      syntax: [
        "ldr$sh$cond $Rd, [$Rn], #$u$offset",
        "ldr$cond$sh $Rd, [$Rn], #$u$offset",
      ],
    },
    {
      ref: "4.10,4.10.8.3.2",
      category: "Halfword and Signed Data Transfer",
      codeParts: [
        { s: 4, k: "register", sym: "Rm" },
        { s: 1, k: "value", v: 1 },
        { s: 2, k: "enum", sym: "sh", enum: [false, "h", "sb", "sh"] },
        { s: 1, k: "value", v: 1 },
        { s: 4, k: "value", v: 0 },
        { s: 4, k: "register", sym: "Rd" },
        { s: 4, k: "register", sym: "Rn" },
        { s: 1, k: "value", sym: "l", v: 1 }, // load
        { s: 1, k: "value", sym: "w", v: 0 }, // write back must be zero for post-indexing
        { s: 1, k: "value", sym: "immediate", v: 0 }, // immediate = 0
        { s: 1, k: "enum", sym: "u", enum: ["-", "/+"] },
        { s: 1, k: "value", sym: "p", v: 0 }, // post-indexing
        { s: 3, k: "value", v: 0 },
        condition,
      ],
      syntax: [
        "ldr$sh$cond $Rd, [$Rn], $u$Rm",
        "ldr$cond$sh $Rd, [$Rn], $u$Rm",
      ],
    },

    //
    // BLOCK DATA TRANSFER
    //

    {
      ref: "4.11,4.11.9",
      category: "Block Data Transfer",
      codeParts: [
        { s: 16, k: "reglist", sym: "Rlist" },
        { s: 4, k: "value", sym: "Rn", v: 13 }, // stack pointer
        { s: 1, k: "value", v: 0 }, // store
        { s: 1, k: "value", sym: "w", v: 1 }, // write back
        { s: 1, k: "enum", sym: "s", enum: ["", "^"] },
        { s: 2, k: "value", sym: "pu", v: 2 }, // stmfd
        { s: 3, k: "value", v: 4 },
        condition,
      ],
      syntax: ["push$cond {$Rlist}$s"],
    },
    {
      ref: "4.11,4.11.9",
      category: "Block Data Transfer",
      codeParts: [
        { s: 16, k: "reglist", sym: "Rlist" },
        { s: 4, k: "register", sym: "Rn" },
        { s: 1, k: "value", v: 0 }, // store
        { s: 1, k: "enum", sym: "w", enum: ["", "!"] },
        { s: 1, k: "enum", sym: "s", enum: ["", "^"] },
        {
          s: 2,
          k: "enum",
          sym: "pu",
          enum: ["ed/da", "ea/ia", "fd/db", "fa/ib"],
        },
        { s: 3, k: "value", v: 4 },
        condition,
      ],
      syntax: [
        "stm$pu$cond $Rn$w, {$Rlist}$s",
        "stm$cond$pu $Rn$w, {$Rlist}$s",
      ],
    },
    {
      ref: "4.11,4.11.9",
      category: "Block Data Transfer",
      codeParts: [
        { s: 16, k: "reglist", sym: "Rlist" },
        { s: 4, k: "value", sym: "Rn", v: 13 }, // stack pointer
        { s: 1, k: "value", v: 1 }, // load
        { s: 1, k: "value", sym: "w", v: 1 }, // write back
        { s: 1, k: "enum", sym: "s", enum: ["", "^"] },
        { s: 2, k: "value", sym: "pu", v: 1 }, // ldmfd
        { s: 3, k: "value", v: 4 },
        condition,
      ],
      syntax: ["pop$cond {$Rlist}$s"],
    },
    {
      ref: "4.11,4.11.9",
      category: "Block Data Transfer",
      codeParts: [
        { s: 16, k: "reglist", sym: "Rlist" },
        { s: 4, k: "register", sym: "Rn" },
        { s: 1, k: "value", v: 1 }, // load
        { s: 1, k: "enum", sym: "w", enum: ["", "!"] },
        { s: 1, k: "enum", sym: "s", enum: ["", "^"] },
        {
          s: 2,
          k: "enum",
          sym: "pu",
          enum: ["fa/da", "fd/ia", "ea/db", "ed/ib"],
        },
        { s: 3, k: "value", v: 4 },
        condition,
      ],
      syntax: [
        "ldm$pu$cond $Rn$w, {$Rlist}$s",
        "ldm$cond$pu $Rn$w, {$Rlist}$s",
      ],
    },

    //
    // SINGLE DATA SWAP
    //

    {
      ref: "4.12,4.12.5",
      category: "Single Data Swap",
      codeParts: [
        { s: 4, k: "register", sym: "Rm" },
        { s: 8, k: "value", v: 9 },
        { s: 4, k: "register", sym: "Rd" },
        { s: 4, k: "register", sym: "Rn" },
        { s: 2, k: "value", v: 0 },
        { s: 1, k: "enum", sym: "b", enum: ["", "b"] },
        { s: 5, k: "value", v: 2 },
        condition,
      ],
      syntax: [
        "swp$b$cond $Rd, $Rm, [$Rn]",
        "swp$cond$b $Rd, $Rm, [$Rn]",
      ],
    },

    //
    // SOFTWARE INTERRUPT
    //

    {
      ref: "4.13,4.13.4",
      category: "Software Interrupt",
      codeParts: [
        { s: 24, k: "immediate", sym: "comment" },
        { s: 4, k: "value", v: 15 },
        condition,
      ],
      syntax: ["swi$cond $comment"],
    },
  ]);
}

export namespace Thumb {
  interface ICodePartRegister {
    s: 3;
    k: "register";
    sym: string;
  }

  interface ICodePartRegisterHigh {
    s: 3;
    k: "registerhigh";
    sym: string;
  }

  interface ICodePartWord {
    s: number;
    k: "word";
    sym: string;
  }

  interface ICodePartSignedWord {
    s: number;
    k: "sword";
    sym: string;
  }

  interface ICodePartHalfword {
    s: number;
    k: "halfword";
    sym: string;
  }

  interface ICodePartSignedHalfword {
    s: number;
    k: "shalfword";
    sym: string;
  }

  interface ICodePartRegList {
    s: 8;
    k: "reglist";
    sym: string;
  }

  export type ICodePart =
    | ICodePartEnum1
    | ICodePartEnum2
    | ICodePartEnum3
    | ICodePartEnum4
    | ICodePartImmediate
    | ICodePartValue
    | ICodePartIgnored
    | ICodePartRegister
    | ICodePartRegisterHigh
    | ICodePartWord
    | ICodePartSignedWord
    | ICodePartHalfword
    | ICodePartSignedHalfword
    | ICodePartRegList;

  export interface IOp {
    ref: string;
    category:
      | "Format 1: Move Shifted Register"
      | "Format 2: Add/Subtract"
      | "Format 3: Move/Compare/Add/Subtract Immediate"
      | "Format 4: ALU Operations"
      | "Format 5: Hi Register Operations/Branch Exchange"
      | "Format 6: PC-Relative Load"
      | "Format 7: Load/Store With Register Offset"
      | "Format 8: Load/Store Sign-Extended Byte/Halfword"
      | "Format 9: Load/Store With Immediate Offset"
      | "Format 10: Load/Store Halfword"
      | "Format 11: SP-Relative Load/Store"
      | "Format 12: Load Address"
      | "Format 13: Add Offset To Stack Pointer"
      | "Format 14: Push/Pop Registers"
      | "Format 15: Multiple Load/Store"
      | "Format 16: Conditional Branch"
      | "Format 17: Software Interrupt"
      | "Format 18: Unconditional Branch";
    codeParts: ICodePart[];
    syntax: [string, ...string[]];
  }

  export const ops: readonly IOp[] = Object.freeze([
    //
    // FORMAT 1: MOVE SHIFTED REGISTER
    //

    {
      ref: "5.1",
      category: "Format 1: Move Shifted Register",
      codeParts: [
        { s: 3, k: "register", sym: "Rd" },
        { s: 3, k: "register", sym: "Rs" },
        { s: 5, k: "immediate", sym: "offset" },
        { s: 2, k: "enum", sym: "oper", enum: ["lsl", "lsr", "asr", false] },
        { s: 3, k: "value", v: 0 },
      ],
      syntax: ["$oper $Rd, $Rs, #$offset"],
    },

    //
    // FORMAT 2: ADD/SUBTRACT
    //

    {
      ref: "5.2",
      category: "Format 2: Add/Subtract",
      codeParts: [
        { s: 3, k: "register", sym: "Rd" },
        { s: 3, k: "register", sym: "Rs" },
        { s: 3, k: "register", sym: "Rn" },
        { s: 1, k: "enum", sym: "oper", enum: ["add", "sub"] },
        { s: 1, k: "value", sym: "immediate", v: 0 }, // immediate = 0
        { s: 5, k: "value", v: 3 },
      ],
      syntax: ["$oper $Rd, $Rs, $Rn"],
    },
    {
      ref: "5.2",
      category: "Format 2: Add/Subtract",
      codeParts: [
        { s: 3, k: "register", sym: "Rd" },
        { s: 3, k: "register", sym: "Rs" },
        { s: 3, k: "immediate", sym: "offset" },
        { s: 1, k: "enum", sym: "oper", enum: ["add", "sub"] },
        { s: 1, k: "value", sym: "immediate", v: 1 }, // immediate = 1
        { s: 5, k: "value", v: 3 },
      ],
      syntax: ["$oper $Rd, $Rs, #$offset"],
    },

    //
    // FORMAT 3: MOVE/COMPARE/ADD/SUBTRACT IMMEDIATE
    //

    {
      ref: "5.3",
      category: "Format 3: Move/Compare/Add/Subtract Immediate",
      codeParts: [
        { s: 8, k: "immediate", sym: "offset" },
        { s: 3, k: "register", sym: "Rd" },
        { s: 2, k: "enum", sym: "oper", enum: ["mov", "cmp", "add", "sub"] },
        { s: 3, k: "value", v: 1 },
      ],
      syntax: ["$oper $Rd, #$offset"],
    },

    //
    // FORMAT 4: ALU OPERATIONS
    //

    {
      ref: "5.4",
      category: "Format 4: ALU Operations",
      codeParts: [
        { s: 3, k: "register", sym: "Rd" },
        { s: 3, k: "register", sym: "Rs" },
        {
          s: 4,
          k: "enum",
          sym: "oper",
          enum: [
            "and",
            "eor",
            "lsl",
            "lsr",
            "asr",
            "adc",
            "sbc",
            "ror",
            "tst",
            "neg",
            "cmp",
            "cmn",
            "orr",
            "mul",
            "bic",
            "mvn",
          ],
        },
        { s: 6, k: "value", v: 16 },
      ],
      syntax: ["$oper $Rd, $Rs"],
    },

    //
    // FORMAT 5: HI REGISTER OPERATIONS/BRANCH EXCHANGE
    //

    {
      ref: "5.5",
      category: "Format 5: Hi Register Operations/Branch Exchange",
      codeParts: [
        { s: 3, k: "register", sym: "Rd" },
        { s: 3, k: "registerhigh", sym: "Hs" },
        { s: 1, k: "value", sym: "h2", v: 1 },
        { s: 1, k: "value", sym: "h1", v: 0 },
        { s: 2, k: "enum", sym: "oper", enum: ["add", "cmp", "mov", false] },
        { s: 6, k: "value", v: 17 },
      ],
      syntax: ["$oper $Rd, $Hs"],
    },
    {
      ref: "5.5",
      category: "Format 5: Hi Register Operations/Branch Exchange",
      codeParts: [
        { s: 3, k: "registerhigh", sym: "Hd" },
        { s: 3, k: "register", sym: "Rs" },
        { s: 1, k: "value", sym: "h2", v: 0 },
        { s: 1, k: "value", sym: "h1", v: 1 },
        { s: 2, k: "enum", sym: "oper", enum: ["add", "cmp", "mov", false] },
        { s: 6, k: "value", v: 17 },
      ],
      syntax: ["$oper $Hd, $Rs"],
    },
    {
      ref: "5.5",
      category: "Format 5: Hi Register Operations/Branch Exchange",
      codeParts: [
        { s: 3, k: "registerhigh", sym: "Hd" },
        { s: 3, k: "registerhigh", sym: "Hs" },
        { s: 1, k: "value", sym: "h2", v: 1 },
        { s: 1, k: "value", sym: "h1", v: 1 },
        { s: 2, k: "enum", sym: "oper", enum: ["add", "cmp", "mov", false] },
        { s: 6, k: "value", v: 17 },
      ],
      syntax: ["$oper $Hd, $Hs"],
    },
    {
      ref: "5.5",
      category: "Format 5: Hi Register Operations/Branch Exchange",
      codeParts: [
        { s: 3, k: "ignored", sym: "Rd", v: 0 },
        { s: 3, k: "register", sym: "Rs" },
        { s: 1, k: "value", sym: "h2", v: 0 },
        { s: 1, k: "value", sym: "h1", v: 0 },
        { s: 2, k: "value", sym: "oper", v: 3 },
        { s: 6, k: "value", v: 17 },
      ],
      syntax: ["bx $Rs"],
    },
    {
      ref: "5.5",
      category: "Format 5: Hi Register Operations/Branch Exchange",
      codeParts: [
        { s: 3, k: "ignored", sym: "Rd", v: 0 },
        { s: 3, k: "registerhigh", sym: "Hs" },
        { s: 1, k: "value", sym: "h2", v: 1 },
        { s: 1, k: "value", sym: "h1", v: 0 },
        { s: 2, k: "value", sym: "oper", v: 3 },
        { s: 6, k: "value", v: 17 },
      ],
      syntax: ["bx $Hs"],
    },

    //
    // FORMAT 6: PC-RELATIVE LOAD
    //

    {
      ref: "5.6",
      category: "Format 6: PC-Relative Load",
      codeParts: [
        { s: 8, k: "word", sym: "offset" },
        { s: 3, k: "register", sym: "Rd" },
        { s: 5, k: "value", v: 9 },
      ],
      syntax: ["ldr $Rd, [pc, #$offset]"],
    },

    //
    // FORMAT 7: LOAD/STORE WITH REGISTER OFFSET
    //

    {
      ref: "5.7",
      category: "Format 7: Load/Store With Register Offset",
      codeParts: [
        { s: 3, k: "register", sym: "Rd" },
        { s: 3, k: "register", sym: "Rb" },
        { s: 3, k: "register", sym: "Ro" },
        { s: 1, k: "value", v: 0 },
        { s: 1, k: "enum", sym: "b", enum: ["", "b"] },
        { s: 1, k: "enum", sym: "oper", enum: ["str", "ldr"] },
        { s: 4, k: "value", v: 5 },
      ],
      syntax: ["$oper $Rd, [$Rb, $Ro]"],
    },

    //
    // FORMAT 8: LOAD/STORE SIGN-EXTENDED BYTE/HALFWORD
    //

    {
      ref: "5.8",
      category: "Format 8: Load/Store Sign-Extended Byte/Halfword",
      codeParts: [
        { s: 3, k: "register", sym: "Rd" },
        { s: 3, k: "register", sym: "Rb" },
        { s: 3, k: "register", sym: "Ro" },
        { s: 1, k: "value", v: 1 },
        { s: 1, k: "value", sym: "s", v: 0 }, // operand not sign-extended
        { s: 1, k: "enum", sym: "oper", enum: ["strh", "ldrh"] },
        { s: 4, k: "value", v: 5 },
      ],
      syntax: ["$oper $Rd, [$Rb, $Ro]"],
    },
    {
      ref: "5.8",
      category: "Format 8: Load/Store Sign-Extended Byte/Halfword",
      codeParts: [
        { s: 3, k: "register", sym: "Rd" },
        { s: 3, k: "register", sym: "Rb" },
        { s: 3, k: "register", sym: "Ro" },
        { s: 1, k: "value", v: 1 },
        { s: 1, k: "value", sym: "s", v: 1 }, // operand sign-extended
        { s: 1, k: "enum", sym: "oper", enum: ["ldsb", "ldsh"] },
        { s: 4, k: "value", v: 5 },
      ],
      syntax: ["$oper $Rd, [$Rb, $Ro]"],
    },

    //
    // FORMAT 9: LOAD/STORE WITH IMMEDIATE OFFSET
    //

    {
      ref: "5.9",
      category: "Format 9: Load/Store With Immediate Offset",
      codeParts: [
        { s: 3, k: "register", sym: "Rd" },
        { s: 3, k: "register", sym: "Rb" },
        { s: 5, k: "word", sym: "offset" },
        { s: 1, k: "enum", sym: "oper", enum: ["str", "ldr"] },
        { s: 1, k: "value", sym: "b", v: 0 }, // transfer word quantity
        { s: 3, k: "value", v: 3 },
      ],
      syntax: ["$oper $Rd, [$Rb, #$offset]"],
    },
    {
      ref: "5.9",
      category: "Format 9: Load/Store With Immediate Offset",
      codeParts: [
        { s: 3, k: "register", sym: "Rd" },
        { s: 3, k: "register", sym: "Rb" },
        { s: 5, k: "immediate", sym: "offset" },
        { s: 1, k: "enum", sym: "oper", enum: ["strb", "ldrb"] },
        { s: 1, k: "value", sym: "b", v: 1 }, // transfer byte quantity
        { s: 3, k: "value", v: 3 },
      ],
      syntax: ["$oper $Rd, [$Rb, #$offset]"],
    },

    //
    // FORMAT 10: LOAD/STORE HALFWORD
    //

    {
      ref: "5.10",
      category: "Format 10: Load/Store Halfword",
      codeParts: [
        { s: 3, k: "register", sym: "Rd" },
        { s: 3, k: "register", sym: "Rb" },
        { s: 5, k: "halfword", sym: "offset" },
        { s: 1, k: "enum", sym: "oper", enum: ["strh", "ldrh"] },
        { s: 4, k: "value", v: 8 },
      ],
      syntax: ["$oper $Rd, [$Rb, #$offset]"],
    },

    //
    // FORMAT 11: SP-RELATIVE LOAD/STORE
    //

    {
      ref: "5.11",
      category: "Format 11: SP-Relative Load/Store",
      codeParts: [
        { s: 8, k: "word", sym: "offset" },
        { s: 3, k: "register", sym: "Rd" },
        { s: 1, k: "enum", sym: "oper", enum: ["str", "ldr"] },
        { s: 4, k: "value", v: 9 },
      ],
      syntax: ["$oper $Rd, [sp, #$offset]"],
    },

    //
    // FORMAT 12: LOAD ADDRESS
    //

    {
      ref: "5.12",
      category: "Format 12: Load Address",
      codeParts: [
        { s: 8, k: "word", sym: "offset" },
        { s: 3, k: "register", sym: "Rd" },
        { s: 1, k: "enum", sym: "Rs", enum: ["pc", "sp"] },
        { s: 4, k: "value", v: 10 },
      ],
      syntax: ["add $Rd, $Rs, #$offset"],
    },

    //
    // FORMAT 13: ADD OFFSET TO STACK POINTER
    //

    {
      ref: "5.13",
      category: "Format 13: Add Offset To Stack Pointer",
      codeParts: [
        { s: 8, k: "sword", sym: "offset" },
        { s: 8, k: "value", v: 176 },
      ],
      syntax: ["add sp, #$offset"],
    },

    //
    // FORMAT 14: PUSH/POP REGISTERS
    //

    {
      ref: "5.14",
      category: "Format 14: Push/Pop Registers",
      codeParts: [
        { s: 8, k: "reglist", sym: "Rlist" },
        { s: 1, k: "value", sym: "r", v: 0 }, // do not store LR
        { s: 2, k: "value", v: 2 },
        { s: 1, k: "value", sym: "l", v: 0 }, // store
        { s: 4, k: "value", v: 11 },
      ],
      syntax: ["push {$Rlist}"],
    },
    {
      ref: "5.14",
      category: "Format 14: Push/Pop Registers",
      codeParts: [
        { s: 8, k: "reglist", sym: "Rlist" },
        { s: 1, k: "value", sym: "r", v: 1 }, // store LR
        { s: 2, k: "value", v: 2 },
        { s: 1, k: "value", sym: "l", v: 0 }, // store
        { s: 4, k: "value", v: 11 },
      ],
      syntax: ["push {$Rlist, lr}"],
    },
    {
      ref: "5.14",
      category: "Format 14: Push/Pop Registers",
      codeParts: [
        { s: 8, k: "reglist", sym: "Rlist" },
        { s: 1, k: "value", sym: "r", v: 0 }, // do not load PC
        { s: 2, k: "value", v: 2 },
        { s: 1, k: "value", sym: "l", v: 1 }, // load
        { s: 4, k: "value", v: 11 },
      ],
      syntax: ["pop {$Rlist}"],
    },
    {
      ref: "5.14",
      category: "Format 14: Push/Pop Registers",
      codeParts: [
        { s: 8, k: "reglist", sym: "Rlist" },
        { s: 1, k: "value", sym: "r", v: 1 }, // load PC
        { s: 2, k: "value", v: 2 },
        { s: 1, k: "value", sym: "l", v: 1 }, // load
        { s: 4, k: "value", v: 11 },
      ],
      syntax: ["pop {$Rlist, pc}"],
    },

    //
    // FORMAT 15: MULTIPLE LOAD/STORE
    //

    {
      ref: "5.15",
      category: "Format 15: Multiple Load/Store",
      codeParts: [
        { s: 8, k: "reglist", sym: "Rlist" },
        { s: 3, k: "register", sym: "Rb" },
        { s: 1, k: "enum", sym: "oper", enum: ["stmia", "ldmia"] },
        { s: 4, k: "value", v: 12 },
      ],
      syntax: ["$oper $Rb!, {$Rlist}"],
    },

    //
    // FORMAT 16: CONDITIONAL BRANCH
    //

    {
      ref: "5.16",
      category: "Format 16: Conditional Branch",
      codeParts: [
        { s: 8, k: "shalfword", sym: "offset" },
        {
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
            false,
            false,
          ],
        },
        { s: 4, k: "value", v: 13 },
      ],
      syntax: ["b$cond $offset"],
    },

    //
    // FORMAT 17: SOFTWARE INTERRUPT
    //

    {
      ref: "5.17",
      category: "Format 17: Software Interrupt",
      codeParts: [
        { s: 8, k: "immediate", sym: "comment" },
        { s: 8, k: "value", v: 223 }
      ],
      syntax: ["swi $comment"]
    },

    //
    // FORMAT 18: UNCONDITIONAL BRANCH
    //

    {
      ref: "5.18",
      category: "Format 18: Unconditional Branch",
      codeParts: [
        { s: 11, k: "halfword", sym: "offset" },
        { s: 5, k: "value", v: 28 }
      ],
      syntax: ["b $offset"]
    }
  ]);
}
