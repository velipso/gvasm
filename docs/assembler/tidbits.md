Helpful Tidbits
===============

### Go from ARM -> Thumb

```
  .arm
  // ARM code here
  add   ip, pc, #1
  bx    ip
  .thumb
  // Thumb code here
```

### Go from Thumb -> ARM

```
  .thumb
  // Thumb code here
  .align 4, nop
  bx    pc
  .arm
  // ARM code here
```

### Generic ARM subroutine

```
@subroutine.thumb:
  .begin
    .thumb
    .align 4, nop
    bx    pc // change to ARM mode
  .end
@subroutine.arm:
  .begin
    .arm
    // ARM code here
    bx    lr // returns
  .end
```

Calling from ARM:

```
  .arm
  bl    @subroutine.arm
```

Calling from Thumb:

```
  .thumb
  bl    @subroutine.thumb
```

### Generic Thumb subroutine

```
@subroutine.arm:
  .begin
    .arm
    add   ip, pc, #1
    bx    ip // change to Thumb mode
  .end
@subroutine.thumb:
  .begin
    .thumb
    // Thumb code here
    bx    lr // returns
  .end
```

Calling from ARM:

```
  .arm
  bl    @subroutine.arm
```

Calling from Thumb:

```
  .thumb
  bl    @subroutine.thumb
```

### Using the stack for local variables

```
.begin
  .struct $$S
    .s32 temp1
    .s32 temp2
    .s0  size
  .end
  sub   sp, #$$S.size

  // write to the local variables
  ldr   r0, =0
  str   r0, [sp, #$$S.temp1]
  str   r0, [sp, #$$S.temp2]

  // read from the local variables
  ldr   r0, [sp, #$$S.temp1]
  ldr   r1, [sp, #$$S.temp2]

  add   sp, #$$S.size
  bx    lr
  .pool
.end
```
