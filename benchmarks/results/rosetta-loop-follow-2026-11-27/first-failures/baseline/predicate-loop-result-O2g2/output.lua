-- [[ annonya.github.io ]] v0.2.0 | decompiled at 2026-11-27T18:31:31Z
-- Luau bytecode version: 14 | Luau type version: 3

local function firstMatch(items, predicate)
    for _, item2 in items do
        if predicate(item2) then
            return item2
        end
    end
    return nil
end

local print2 = print

local function predicate(item)
    return item > 5
end

for _, value in { 2, 7, 9 } do
    if value > 5 then
        break
    end
end
print2(nil)
local print3 = print

local function predicate2(item)
    return item > 5
end

for _2, value2 in { 2, 3 } do
    if value2 > 5 then
        break
    end
end
print3(nil)
