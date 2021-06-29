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
.i8 "CAA"        // game code
.i8 "E"          // (D)eutsch (E)nglish (F)rench (I)talian (J)apanese Euro(P)ean (S)panish
.i8 "99"         // maker code
.i16 150, 0, 0, 0, 0
.i8 0            // software version
.crc
.i16 0

.include "./file.gbasm" // copy/paste text file as code
.embed "./file.bmp"     // copy/paste binary file as i8
.stdlib                 // include the standard library
.extlib                 // include the extended library

.thumb
.arm

.if $foo
.error "message"
.elseif $bar
.else
.endif

.b8 1
.b16 1
.b32 1

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
