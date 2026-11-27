-- [[ annonya.github.io ]] v0.2.0 | decompiled at 2026-11-27T18:40:52Z
-- Luau bytecode version: 14 | Luau type version: 3

local function choose(a: number, b: number, c: boolean)
    print(if a ~= b then "selected" elseif c then nil else "fallback")
end;

(if true then choose else nil)(1, 1, true);
(if true then choose else nil)(2, 1, true);
(if true then choose else nil)(1, 1, false)
