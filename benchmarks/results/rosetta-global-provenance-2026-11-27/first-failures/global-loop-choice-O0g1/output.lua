-- [[ annonya.github.io ]] v0.2.0 | decompiled at 2026-11-27T18:55:07Z
-- Luau bytecode version: 14 | Luau type version: 3

local list = {}

local function choose(list2)
    for key, value in ipairs(list2) do
        if value > 6 then
            (if true then table.insert else nil)(list, "stored:" .. tostring(key))
            break
        end
    end
    return index
end

local function readChoice()
    return index, nil, list
end

local function localShadow(p: number)
    return p + 1
end

print((if true then choose else nil)({ 3, 9, 8 }), index)
print(select("#", (if true then readChoice else nil)()), (if true then readChoice else nil)())
local print2 = print
local value = (if true then choose else nil)({ 8 })
print2(value, localShadow(40), (if true then readChoice else nil)())
local print3 = print
value = if list ~= list then false else true
print3(value, (if true then table.concat else nil)(list, "|"))
return index, nil, list
