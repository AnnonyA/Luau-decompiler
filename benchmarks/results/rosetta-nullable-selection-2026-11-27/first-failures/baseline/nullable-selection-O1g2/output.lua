-- [[ annonya.github.io ]] v0.2.0 | decompiled at 2026-11-27T18:40:52Z
-- Luau bytecode version: 14 | Luau type version: 3

local function choose(left: number, right: number, flag: boolean)
    print(if left ~= right then "selected" elseif flag then nil else "fallback")
end;

(if true then choose else nil)(1, 1, true);
(if true then choose else nil)(2, 1, true);
(if true then choose else nil)(1, 1, false)
