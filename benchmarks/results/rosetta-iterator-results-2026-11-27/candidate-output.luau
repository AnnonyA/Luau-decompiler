-- [[ annonya.github.io ]] v0.2.0 | decompiled at 2026-11-27T19:22:23Z
-- Luau bytecode version: 14 | Luau type version: 3

local function walk(items)
    local total: number = 0
    for list, item in items do
        print(list, item)
        total += #list + item
    end
    print("finished", total)
end;

(if true then walk else nil)({ apricot = 7 });
(if true then walk else nil)({ blue = 9 });
(if true then walk else nil)({})
