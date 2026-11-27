-- [[ annonya.github.io ]] v0.2.0 | decompiled at 2026-11-27T18:30:27Z
-- Luau bytecode version: 14 | Luau type version: 3

local cell
cell = nil

local function observe()
    local value = cell[1]
    return cell, value, cell.tag
end

local cell2 = { [1] = 11, tag = "first" }
local old = cell2
local first, firstNumber, firstTag = (if true then observe else nil)()
local second, secondNumber, secondTag = (if true then observe else nil)()
print(firstNumber, firstTag, secondNumber, secondTag)
local print2 = print
local cell3 = { [1] = 22, tag = "second" }
print2(old == first, first ~= second, cell3 == second, old[1])
