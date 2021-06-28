#!/usr/bin/env -S deno run --allow-read --allow-write
//
// gbasm - Assembler and disassembler for Game Boy Advance homebrew
// by Sean Connelly (@velipso), https://sean.cm
// The Unlicense License
// Project Home: https://github.com/velipso/gbasm
//

import { main } from "./src/main.ts";
Deno.exit(await main(Deno.args));