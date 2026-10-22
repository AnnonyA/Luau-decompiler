# Scope, register and CFG regressions

Six additional original programs exercise dependency snapshots, nested generic
iterators, reused registers and in-place alternatives, nested tables with an
open multi-return tail, shared terminal returns, and nested phi bindings.

`npm run bench:regressions -- --luau-compile /path/to/luau-compile --luau /path/to/luau --output /tmp/pr58-regressions`

The runner uses O0/O1 and inputs `-7`, `1`, `8` for these six programs and the
unchanged twelve competition originals: 36 profiles, 108 execution comparisons.
It requires every comparison and official syntax check to pass. JSON includes
source/bytecode hashes and exact original/reconstructed VM traces. It has no
external API client. This is additional coverage; the original 200 comparisons
and the 24-profile competition remain independent blocking gates in CI.
