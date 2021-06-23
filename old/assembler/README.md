Assembler
=========

### Work in Progress

Current ideas:

1. Must handle ARM and THUMB modes
2. Should have easy way to specify GBA header
3. Would be nice to have a register allocator algorithm so users can have infinite registers (global
   variables and local variables)
4. Perhaps goto with arguments instead of branch
5. Must be able to branch in and out of ARM/THUMB modes
6. Conditional opcodes for ARM
7. If using infinite registers, should have a way to write code that uses registers directly, and
   have it interface with the register allocator
8. Start with JavaScript and port to C once it's looking good (?)

Syntax
======

```
// Comments
/* more */

set {base = 0x08000000}

gba {
	title = "Foo"
	game = "1234"
	developer = "12"
	debug = true
	version = 0x12
}

embed label("./some/file.bmp")

data namespace {
	u8 FOO = 1
	i8 FOO = 1
	u16 FOO = 1
	i16 FOO = 1
	u32 BAR = 1
	i32 BAR = 1
	rstr FOO = "bar"
	cstr BAR = "bar"
	ptr FOO = &namespace.BAR
	u8 FOO[] = {1, 2, 3, 4, 5}
	u8[] = {
		0x00, 0x01, 0x02
	}
}

addr label(0x0) {}

addr namespace(fast/slow/save/0x0) {
	u8 FOO
	i8 FOO
	union {
		u16 FOO
		i16 FOO
	}
	u32 FOO
	i32 FOO
	ptr FOO
	u8 FOO[10]
}

include("./some/file.s")

arm label(param1, param2) reserve(r0, r1) {
	reserve(r0, r1) {
	}
	...arm code...
inner_label:
	goto label(param1, param2)
	call label(param1, param2), (result1, result2)
	return (result1, result2)
}

thumb label(param1, param2) {
	...thumb code...
}

```
