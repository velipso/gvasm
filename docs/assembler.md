Assembler
=========

### Work in Progress

```
/* block comment */

//.base 0 // for bios
//.base 0x08000000 // for gba (default)

// GBA header
b @main          // branch to main method
.logo
.title "Game"    // game title, up to 12 characters
.u8 "CAA"        // game code
.u8 "E"          // (D)eutsch (E)nglish (F)rench (I)talian (J)apanese Euro(P)ean (S)panish
.u8 "99"         // maker code
.u16 150, 0, 0, 0, 0
.u8 0            // software version
.crc
.u16 0

.include "./file.gbasm" // copy/paste text file as code
.embed "./file.bmp"     // copy/paste binary file as u8
.stdlib                 // include the standard library
.extlib                 // include the extended library

.thumb
.arm

.if $foo
.elseif $bar
.else
.endif

@main:    // global label
@@foo:    // local label (disappears after .end)
$foo = 1  // global define
$$foo = 1 // local define (disappears after .end)
.end

// global macro
.macro %foo \param1, \param2
.endm
// local macro (disappears after .end)
.marco %%foo \param1, \param2
.endm
```
