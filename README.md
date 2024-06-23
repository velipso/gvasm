gvasm
=====

Assembler and disassembler designed specifically for Game Boy Advance homebrew.

The assembler works for ARM and Thumb code, and has features like conditional compilation, defined
constants and functions, struct layout, compile-time scripts, literal pools, and incremental builds.

The disassembler is experimental, and includes a partially implemented ARM emulator.

Install
=======

You'll need to install [deno](https://deno.land) on your operating system.

Then run:

```bash
# install the latest release of deno
deno upgrade

# install the latest release of gvasm
deno install -g --allow-read --allow-write --allow-run -f -r \
  https://raw.githubusercontent.com/velipso/gvasm/main/gvasm.ts
```

If this is your first time running `deno install`, you will need to add the deno binary directory to
your path.  See the page on [deno install](https://deno.land/manual@v1.27.2/tools/script_installer)
for more information.

In order to upgrade, simply run the above command again -- it will redownload the latest version and
install it.

You can verify everything installed correctly by running the internal test suite:

```bash
gvasm itest
```

Every test should pass!

Assembler
=========

Read [the assembler manual](./docs/assembler/README.md).

Start by initializing a new file:

```bash
gvasm init MyGame.gvasm
```

This will create `MyGame.gvasm` in your current directory with a small example program.

You can build this file via:

```bash
gvasm make MyGame.gvasm
```

This will output `MyGame.gba`, which can be ran inside emulators.  The example program just sets the
background color to green.

Disassember and Emulator [WIP]
==============================

If you want to play with the disassembler, you can try:

```bash
gvasm dis gba_bios.bin
```

The emulator can run code, which is useful for quickly debugging a section of code.  For example,
this works:

```
// test.gvasm
.thumb
ldr   r0, =300
again:
_log  "r0 = %d", r0
subs  r0, #1
cmp   r0, #250
bne   again
_log  "done"
_exit
.pool
```

Then:

```bash
gvasm run test.gvasm
```

This will execute the code, along with debug statements like `_log` and `_exit`, producing the
output:

```
r0 = 300
r0 = 299
...
r0 = 251
done
```

Installing Older Version
========================

If your project uses the older gvasm v1, you can still install the latest release prior to v2 by
using the `v1.9.4` tag:

```bash
deno install --allow-read --allow-write -f -r \
  https://raw.githubusercontent.com/velipso/gvasm/v1.9.4/gvasm.ts
```

References
==========

* [Assembler Manual](./docs/assembler/README.md)
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
* [M36W0R6030T0/M36W0R6030B0](https://www.datasheetarchive.com/pdf/download.php?id=b575903d0cf639dddc354c69571d90ff1b6021&type=M&term=M36W0R6030T) ([mirror](https://github.com/velipso/gvasm/blob/main/mirror/m36w0r6030x0.pdf))
* [M58WR064FT/M58WR064FB](https://pdf1.alldatasheet.com/datasheet-pdf/view/155760/STMICROELECTRONICS/M58WR064FT.html) ([mirror](https://github.com/velipso/gvasm/blob/main/mirror/m58wr064fx.pdf))
* [CFI Publication 100](https://netwinder.osuosl.org/pub/netwinder/docs/nw/flash/cfi100.pdf) ([mirror](https://github.com/velipso/gvasm/blob/main/mirror/cfi100.pdf))
