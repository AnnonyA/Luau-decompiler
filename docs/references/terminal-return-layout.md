# A physical bytecode end is not a source function tail

The terminal-path references are Tovek
`ce2ea3325547fa3896f274b68013386338039040` (MIT),
`restructure/src/region.rs` (`join_return` and exit adapters), and official Luau
`c87565b8b0db5d5d5bfd2b8b00ad6573e5d06d9f`, VM RETURN and compiler
`compileStatReturn`. The implementation is independent.

Every RETURN leaves the function, regardless of its physical position among
bytecode blocks. The reconstructor previously omitted a bare return when its
instruction happened to be last. After block permutation that instruction can
be an early exit inside a loop; omitting it executes later iterations and the
normal exhaustion tail.

Reconstruction now keeps every RETURN while building control flow. Only after
the whole source function body is assembled does it remove a redundant bare
return at that body's final statement. Existing structural cleanup can remove
other redundant exits with its source-context proof.

The independent fixture observes an iterator's effects and captures on two
early exits and ordinary exhaustion, including zero-return arity. Its authored
transformation moves one early bare return to the physical end behind a jump.
Original and transformed bytecodes run identically in all six official
O0/O1/O2, g1/g2 profiles. Full-pipeline decompilation failed all six before the
repair and passes all six afterward. The initial source, bytecode hashes and
incorrect output remain in the associated fixtures and benchmark evidence.
