Helpful Tidbits
===============

### Go from ARM -> Thumb

```
  // ARM code here
  add ip, pc, #1
  bx ip
  .thumb
  // Thumb code here
```

### Go from Thumb -> ARM

```
  // Thumb code here
  .align 4, nop
  bx pc
  .arm
  // ARM code here
```

### Generic ARM subroutine

```
  .thumb
@subroutine.thumb:
  .align 4, nop
  bx pc // change to ARM mode
  .arm
@subroutine.arm:
  .begin
  // ARM code here
  .end
  bx lr // returns
```

Calling from ARM:

```
  .arm
  bl @subroutine.arm
```

Calling from Thumb:

```
  .thumb
  bl @subroutine.thumb
```

### Generic Thumb subroutine

```
  .arm
@subroutine.arm:
  add ip, pc, #1
  bx ip // change to Thumb mode
  .thumb
@subroutine.thumb:
  .begin
  // Thumb code here
  .end
  bx lr // returns
```

Calling from ARM:

```
  .arm
  bl @subroutine.arm
```

Calling from Thumb:

```
  .thumb
  bl @subroutine.thumb
```
