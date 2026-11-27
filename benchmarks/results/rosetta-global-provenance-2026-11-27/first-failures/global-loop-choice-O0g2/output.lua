-- [[ annonya.github.io ]] v0.2.0 | decompiled at 2026-11-27T18:55:08Z
-- Luau bytecode version: 14 | Luau type version: 3

local list = {}
local alias = list

local function choose(values)
    for key, value in ipairs(values) do
        if value > 6 then
            local index = key;
            (if true then table.insert else nil)(list, "stored:" .. tostring(index))
            break
        end
    end
    return index
end

local function readChoice()
    return index, nil, list
end

local function localShadow(index2: number)
    return index2 + 1
end

print((if true then choose else nil)({ 3, 9, 8 }), index)
print(select("#", (if true then readChoice else nil)()), (if true then readChoice else nil)())
local print2 = print
local value2 = (if true then choose else nil)({ 8 })
print2(value2, localShadow(40), (if true then readChoice else nil)())
local print3 = print
value2 = if list ~= alias then false else true
print3(value2, (if true then table.concat else nil)(alias, "|"))
return index, nil, alias
