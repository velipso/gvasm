gbasm
=====

Assembler and disassembler designed specifically for Game Boy Advance homebrew.

Note that the entire repo is a **work in progress**.  Feel free to poke around but certainly don't
rely on anything!

Install
=======

You'll need to install [deno](https://deno.land) on your operating system.

Then run:

```
# install the latest release of deno
deno upgrade

# install the latest release of gbasm
deno install --allow-read --allow-write -f -r \
  https://raw.githubusercontent.com/velipso/gbasm/master/gbasm.ts
```

If this is your first time running `deno install`, you will need to add the deno binary directory to
your path.

In order to upgrade, simply run the above command again -- it will redownload the latest version and
install it.

Usage
=====

Commands to get you started:

```
gbasm init MyGame.gbasm
```

This will create `MyGame.gbasm` in your current directory with a small example program.

You can build this file via:

```
gbasm make MyGame.gbasm
```

This will output `MyGame.gba`, which can be ran inside emulators.  The example program just sets the
background color to green.

Then, you can try disassembling the .gba file:

```
gbasm dis MyGame.gba
```

The disassembler doesn't work very well yet, as you'll see :-).

Technical Docs
==============

* [ARM7TDMI Tech Spec](https://developer.arm.com/documentation/ddi0210/c) ([mirror](https://github.com/velipso/gbasm/blob/main/mirror/arm7tdmi-tech.pdf))
* [ARM7TDMI Data Sheet](https://www.dwedit.org/files/ARM7TDMI.pdf) ([mirror](https://github.com/velipso/gbasm/blob/main/mirror/arm7tdmi-data.pdf))
* [ARM7TDMI Instruction Set](https://www.ecs.csun.edu/~smirzaei/docs/ece425/arm7tdmi_instruction_set_reference.pdf) ([mirror](https://github.com/velipso/gbasm/blob/main/mirror/arm7tdmi-inst.pdf))
  * Error on PDF page 18 (labeled "Page 16"), it gives the incorrect encoding for CMN instruction
* [CowBite Hardware Spec](https://www.cs.rit.edu/~tjh8300/CowBite/CowBiteSpec.htm) ([mirror](https://cdn.githubraw.com/velipso/gbasm/main/mirror/cowbite.html))
* [GBATEK No$GBA](http://problemkaputt.de/gbatek.htm) ([mirror](https://cdn.githubraw.com/velipso/gbasm/main/mirror/gbatek.html))
