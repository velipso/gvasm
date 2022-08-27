#!/usr/bin/env -S deno run --check=all --allow-read --allow-write
//
// gvasm - Assembler and disassembler for Game Boy Advance homebrew
// by Sean Connelly (@velipso), https://sean.cm
// Project Home: https://github.com/velipso/gvasm
// SPDX-License-Identifier: 0BSD
//

import { main } from './src/main.ts';
Deno.exit(await main(Deno.args));
