//
// gbasm - Assembler and disassembler for Game Boy Advance homebrew
// by Sean Connelly (@velipso), https://sean.cm
// The Unlicense License
// Project Home: https://github.com/velipso/gbasm
//

import { load as basicLoad } from "./itests/basic.ts";
import { load as exprLoad } from "./itests/expr.ts";
import { load as armLoad } from "./itests/arm.ts";
import { makeFromFile } from "./make.ts";

export interface IItestArgs {
  filters: string[];
}

interface ITestMake {
  name: string;
  desc: string;
  kind: "make";
  error?: true;
  files: { [filename: string]: string };
}

export type ITest = ITestMake;

async function itestMake(test: ITestMake): Promise<boolean> {
  const data: string[] = [];
  const res = await makeFromFile("/root/main", (filename: string) => {
    if (filename in test.files) {
      data.push(test.files[filename]);
      return Promise.resolve(test.files[filename]);
    } else {
      throw new Error(`Not found: ${filename}`);
    }
  });
  if ("errors" in res) {
    if (test.error) {
      return true;
    }
    console.error("");
    res.errors.forEach((err) => console.error(err));
    return false;
  }
  const expected: number[] = data
    .join("\n")
    .split("\n")
    .map((line) => {
      const c = line.indexOf("///");
      if (c >= 0) {
        return " " + line.substr(c + 3).replace(/\s+/g, " ").trim();
      } else {
        return "";
      }
    })
    .join("")
    .trim()
    .split(" ")
    .map((n) => parseInt(n, 16));
  if (expected.length !== res.result.length) {
    console.error(
      `\nExpected length is ${expected.length} bytes, but got ${res.result.length} bytes`,
    );
    return false;
  }
  const hex = (n: number) => `${n < 16 ? "0" : ""}${n.toString(16)}`;
  for (let i = 0; i < expected.length; i++) {
    if (expected[i] !== res.result[i]) {
      console.error(`\nResult doesn't match expected:`);
      for (
        let s = Math.max(0, i - 5);
        s < Math.min(expected.length, i + 6);
        s++
      ) {
        if (res.result[s] === expected[s]) {
          console.error(` result[${s}] = ${hex(res.result[s])} // match`);
        } else {
          console.error(
            ` result[${s}] = ${hex(res.result[s])} // expected[${s}] = ${
              hex(expected[s])
            }`,
          );
        }
      }
      return false;
    }
  }
  return true;
}

export async function itest({ filters }: IItestArgs): Promise<number> {
  const tests: { index: number; test: ITest }[] = [];
  const def = (test: ITest) => {
    tests.push({
      index: tests.length,
      test,
    });
  };

  // load the tests
  basicLoad(def);
  exprLoad(def);
  armLoad(def);

  // execute the tests that match any filter
  const indexDigits = Math.ceil(Math.log10(tests.length));
  let passed = 0;
  let failed = 0;
  let skipped = 0;
  for (const test of tests) {
    const { index, test: { name } } = test;
    if (
      filters.length > 0 &&
      !filters.some((filter) =>
        name.toLowerCase().indexOf(filter.toLowerCase()) >= 0
      )
    ) {
      // skip test
      skipped++;
      continue;
    }

    let indexStr = `${index}`;
    while (indexStr.length < indexDigits) {
      indexStr = `0${indexStr}`;
    }

    try {
      // TODO: switch on different test types
      const pass = await itestMake(test.test);

      if (pass) {
        console.log(`pass     [${indexStr}] ${name}`);
        passed++;
      } else {
        console.log(`FAIL     [${indexStr}] ${name}\n`);
        failed++;
      }
    } catch (e) {
      console.error(e);
      console.log(`ERR      [${indexStr}] ${name}\n`);
      failed++;
    }
  }

  console.log(`-------------------------------
Skipped: ${skipped}
Passed:  ${passed}
Failed:  ${failed}
TOTAL:   ${skipped + passed + failed}

${failed > 0 ? "FAILED!" : passed > 0 ? "All good!" : "No results"}`);
  return failed > 0 ? 1 : 0;
}
