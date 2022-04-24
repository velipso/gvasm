gvasm
=====

Assembler and disassembler designed specifically for Game Boy Advance homebrew.

The assembler works for ARM and Thumb code, and has features like conditional compilation, defined
constants and functions, struct layout, compile-time scripts, and literal pools.  Read
[the assembler manual](https://github.com/velipso/gvasm/blob/main/docs/assembler/README.md).

The disassembler is still experimental, but does work for ARM instructions.  Now that the assembler
is done, I'll be working on the disassembler more slowly.

Install
=======

You'll need to install [deno](https://deno.land) on your operating system.

Then run:

```
# install the latest release of deno
deno upgrade

# install the latest release of gvasm
deno install --allow-read --allow-write -f -r \
  https://raw.githubusercontent.com/velipso/gvasm/master/gvasm.ts
```

If this is your first time running `deno install`, you will need to add the deno binary directory to
your path.

In order to upgrade, simply run the above command again -- it will redownload the latest version and
install it.

You can verify everything installed correctly by running the internal test suite:

```
gvasm itest
```

Every test should pass!

Usage
=====

Start by initializing a new file:

```
gvasm init MyGame.gvasm
```

This will create `MyGame.gvasm` in your current directory with a small example program.

You can build this file via:

```
gvasm make MyGame.gvasm
```

This will output `MyGame.gba`, which can be ran inside emulators.  The example program just sets the
background color to green.

References
==========

* [Assembler Manual](https://github.com/velipso/gvasm/blob/main/docs/assembler/README.md)
* [GBA Instruction Set](https://cdn.githubraw.com/velipso/gvasm/main/docs/assembler/asm.html)

GBA Technical Docs
==================

* [ARM7TDMI Tech Spec](https://developer.arm.com/documentation/ddi0210/c) ([mirror](https://github.com/velipso/gvasm/blob/main/mirror/arm7tdmi-tech.pdf))
* [ARM7TDMI Data Sheet](https://www.dwedit.org/files/ARM7TDMI.pdf) ([mirror](https://github.com/velipso/gvasm/blob/main/mirror/arm7tdmi-data.pdf))
* [ARM7TDMI Instruction Set](https://www.ecs.csun.edu/~smirzaei/docs/ece425/arm7tdmi_instruction_set_reference.pdf) ([mirror](https://github.com/velipso/gvasm/blob/main/mirror/arm7tdmi-inst.pdf))
  * Error on PDF page 18 (labeled "Page 16"), it gives the incorrect encoding for CMN instruction
* [CowBite Hardware Spec](https://www.cs.rit.edu/~tjh8300/CowBite/CowBiteSpec.htm) ([mirror](https://cdn.githubraw.com/velipso/gvasm/main/mirror/cowbite.html))
* [GBATEK No$GBA](http://problemkaputt.de/gbatek.htm) ([mirror](https://cdn.githubraw.com/velipso/gvasm/main/mirror/gbatek.html))

Flash Cart Docs
===============

* [M29W128GH/M29W128GL](https://media-www.micron.com/-/media/client/global/documents/products/data-sheet/nor-flash/parallel/m29w/m29w128g.pdf?rev=d22b70b2c0494a7187cd45dda03ceb9a) ([mirror](https://github.com/velipso/gvasm/blob/main/mirror/m29w128gx.pdf))
* [S29GL128N/S29GL256N/S29GL512N](https://www.cypress.com/file/219941/download) ([mirror](https://github.com/velipso/gvasm/blob/main/mirror/s29glxxxn.pdf))
