gvasm
=====

Assembler and disassembler designed specifically for Game Boy Advance homebrew.

This is a work in progress -- as features are completed, they should be mostly stable:

- [x] ARM opcode descriptions
- [x] THUMB opcode descriptions
- [x] Byte, halfword, word commands
- [x] GBA header commands
- [x] Include and embed
- [x] Labels
- [x] Constant expressions
- [x] ARM opcode assembly
- [x] THUMB opcode assembly
- [x] Literal pools
- [x] Defined constant expressions
- [x] Scoped names and labels
- [ ] Conditional compilation (in progress)
- [ ] Test suite (in progress)
- [ ] Defined constant macros
- [ ] Structs
- [ ] Standard library
- [ ] Extended library
- [ ] Disassembler
- [ ] Examples and documentation

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

Commands to get you started:

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

Then, you can try disassembling the .gba file:

```
gvasm dis MyGame.gba
```

The disassembler doesn't work very well yet, as you'll see :-).

Technical Docs
==============

* [ARM7TDMI Tech Spec](https://developer.arm.com/documentation/ddi0210/c) ([mirror](https://github.com/velipso/gvasm/blob/main/mirror/arm7tdmi-tech.pdf))
* [ARM7TDMI Data Sheet](https://www.dwedit.org/files/ARM7TDMI.pdf) ([mirror](https://github.com/velipso/gvasm/blob/main/mirror/arm7tdmi-data.pdf))
* [ARM7TDMI Instruction Set](https://www.ecs.csun.edu/~smirzaei/docs/ece425/arm7tdmi_instruction_set_reference.pdf) ([mirror](https://github.com/velipso/gvasm/blob/main/mirror/arm7tdmi-inst.pdf))
  * Error on PDF page 18 (labeled "Page 16"), it gives the incorrect encoding for CMN instruction
* [CowBite Hardware Spec](https://www.cs.rit.edu/~tjh8300/CowBite/CowBiteSpec.htm) ([mirror](https://cdn.githubraw.com/velipso/gvasm/main/mirror/cowbite.html))
* [GBATEK No$GBA](http://problemkaputt.de/gbatek.htm) ([mirror](https://cdn.githubraw.com/velipso/gvasm/main/mirror/gbatek.html))
