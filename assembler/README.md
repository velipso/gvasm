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
