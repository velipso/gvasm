//
// gvasm - Assembler and disassembler for Game Boy Advance homebrew
// by Sean Connelly (@velipso), https://sean.fun
// Project Home: https://github.com/velipso/gvasm
// SPDX-License-Identifier: 0BSD
//

import { ITest } from '../itest.ts';

export function load(def: (test: ITest) => void) {
  def({
    name: 'printf.basic',
    desc: 'Basic usage of .printf',
    kind: 'make',
    stdout: ['hello, %world'],
    files: {
      '/root/main': `.printf "hello, %%world"`,
    },
  });

  def({
    name: 'printf.newline',
    desc: 'Newline in strings',
    kind: 'make',
    stdout: ['hello,\nworld'],
    files: {
      '/root/main': `.printf "hello,\\nworld"`,
    },
  });

  def({
    name: 'printf.decimal',
    desc: 'Decimal formatting',
    kind: 'make',
    stdout: ['one hundred 100 two hundred 200'],
    files: {
      '/root/main': `.printf "one hundred %d two hundred %i", 100, 200`,
    },
  });

  def({
    name: 'printf.binary',
    desc: 'Binary formatting',
    kind: 'make',
    stdout: ['one hundred 1100100 two hundred 11001000'],
    files: {
      '/root/main': `.printf "one hundred %b two hundred %b", 100, 200`,
    },
  });

  def({
    name: 'printf.octal',
    desc: 'Octal formatting',
    kind: 'make',
    stdout: ['one hundred 144 two hundred 310'],
    files: {
      '/root/main': `.printf "one hundred %o two hundred %o", 100, 200`,
    },
  });

  def({
    name: 'printf.hex',
    desc: 'Hex formatting',
    kind: 'make',
    stdout: ['two hundred c8 two hundred C8'],
    files: {
      '/root/main': `.printf "two hundred %x two hundred %X", 200, 200`,
    },
  });

  def({
    name: 'printf.hex-unsigned',
    desc: 'Hex formatting should be unsigned',
    kind: 'make',
    stdout: ['0xFFFFFFFF'],
    files: {
      '/root/main': `.printf "%#X", -1`,
    },
  });

  def({
    name: 'printf.unsigned',
    desc: 'Unsigned formatting',
    kind: 'make',
    stdout: ['-1 4294967295'],
    files: {
      '/root/main': `.printf "%i %u", 4294967295, 4294967295`,
    },
  });

  def({
    name: 'printf.label-known',
    desc: 'Known label',
    kind: 'make',
    stdout: ['0x08000000'],
    files: {
      '/root/main': `main: .printf "%#08x", main`,
    },
  });

  def({
    name: 'printf.label-unknown',
    desc: 'Late print an on unknown label',
    kind: 'make',
    stdout: ['hi', '0x08000000'],
    files: {
      '/root/main': `
.printf "%#08x", main
.printf "hi"
main:
`,
    },
  });
}
