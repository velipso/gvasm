//
// Test file
//

set {base = 0x80000000}

gba {
	title = "Foo"
	game = "1234"
	developer = "12"
	debug = false
	version = 0x12
}

include("./two.s")

arm main() {
	goto main()
}
