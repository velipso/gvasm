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
  nop
  .arm
  // ARM code here
```

### Generic ARM subroutine

```
.begin subroutine
  .begin thumb
    .thumb
    .align 4, nop
    bx    pc // change to ARM mode
    nop
  .end
  .begin arm
    .arm
    // ARM code here
    bx    lr // returns
  .end
.end
```

Calling from ARM:

```
  .arm
  bl    subroutine.arm
```

Calling from Thumb:

```
  .thumb
  bl    subroutine.thumb
```

### Generic Thumb subroutine

```
.begin subroutine
  .begin arm
    .arm
    add   ip, pc, #1
    bx    ip // change to Thumb mode
  .end
  .begin thumb
    .thumb
    // Thumb code here
    bx    lr // returns
  .end
.end
```

Calling from ARM:

```
  .arm
  bl    subroutine.arm
```

Calling from Thumb:

```
  .thumb
  bl    subroutine.thumb
```

### Using the stack for local variables

```
.begin
  .thumb
  .struct S
    .i32 temp1
    .i32 temp2
  .end
  .if S._bytes > 0
    sub   sp, #S._bytes
  .end

  // write to the local variables
  ldr   r0, =0
  str   r0, [sp, #S.temp1]
  str   r0, [sp, #S.temp2]

  // read from the local variables
  ldr   r0, [sp, #S.temp1]
  ldr   r1, [sp, #S.temp2]

  .if S._bytes > 0
    add   sp, #S._bytes
  .end
  bx    lr
  .pool
.end
```
