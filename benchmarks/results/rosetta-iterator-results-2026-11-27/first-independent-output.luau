-- [[ annonya.github.io ]] v0.2.0 | decompiled at 2026-11-27T19:22:07Z
-- Luau bytecode version: 14 | Luau type version: 3

local function walk(items)
    local total: number = 0
    for _, _2 in items do
        print(_2, _2)
        total += #_2 + _2
    end
    print("finished", total)
end;

(if true then walk else nil)({ apricot = 7 });
(if true then walk else nil)({ blue = 9 });
(if true then walk else nil)({})
