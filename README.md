gbasm
=====

Assembler and disassembler designed specifically for Game Boy Advance homebrew.

Note that the entire repo is a **work in progress**.  Feel free to poke around but certainly don't
rely on anything!

Usage
=====

The `gbasm` script in the main directory is the entry point.

You'll need to install [deno](https://deno.land) on your operating system.

Then, to install:

```
deno install --allow-read --allow-write -rf https://raw.githubusercontent.com/velipso/gbasm/master/gbasm.ts
```

Commands to get you started:

```
gbasm init MyGame.gbasm
gbasm make MyGame.gbasm
# now you will have MyGame.gba inside the main folder
# run it in an emulator, and it will show a red screen
```

Technical Docs
==============

* [ARM7TDMI Tech Spec](https://developer.arm.com/documentation/ddi0210/c) ([mirror](https://github.com/velipso/gbasm/blob/main/mirror/arm7tdmi-tech.pdf))
* [ARM7TDMI Data Sheet](https://www.dwedit.org/files/ARM7TDMI.pdf) ([mirror](https://github.com/velipso/gbasm/blob/main/mirror/arm7tdmi-data.pdf))
* [ARM7TDMI Instruction Set](https://www.ecs.csun.edu/~smirzaei/docs/ece425/arm7tdmi_instruction_set_reference.pdf) ([mirror](https://github.com/velipso/gbasm/blob/main/mirror/arm7tdmi-inst.pdf))
  * Error on PDF page 18 (labeled "Page 16"), it gives the incorrect encoding for CMN instruction
* [CowBite Hardware Spec](https://www.cs.rit.edu/~tjh8300/CowBite/CowBiteSpec.htm) ([mirror](https://cdn.githubraw.com/velipso/gbasm/main/mirror/cowbite.html))
* [GBATEK No$GBA](http://problemkaputt.de/gbatek.htm) ([mirror](https://cdn.githubraw.com/velipso/gbasm/main/mirror/gbatek.html))
* [Linear scan register allocation](http://web.cs.ucla.edu/~palsberg/course/cs132/linearscan.pdf) ([mirror](https://cdn.githubraw.com/velipso/gbasm/main/mirror/linearscan.pdf))
