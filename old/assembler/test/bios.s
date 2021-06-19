//
// Decompiled GBA BIOS
//

set {base = 0x00000000}

arm main() {
	// Exception vectors

	// Reset
	b #96

	// Undefined instruction
	b #16

	// Software interrupt
	b #304

	// Prefetch abort
	b #8

	// Data abort
	b #4

	// Reserved
	b #0

	// Interrupt request (IRQ)
	b #264

	// Fast interrupt request (FIQ)

	ldr sp, _01C4 @=IWRAM_END - 0x10
}
