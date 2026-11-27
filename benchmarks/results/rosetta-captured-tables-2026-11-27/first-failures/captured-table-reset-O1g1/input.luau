local cell
local function observe()
    return cell, cell[1], cell.tag
end

cell = {}
cell[1] = 11
cell.tag = "first"
local old = cell
local first, firstNumber, firstTag = observe()

cell = {}
cell[1] = 22
cell.tag = "second"
local second, secondNumber, secondTag = observe()

print(firstNumber, firstTag, secondNumber, secondTag)
print(old == first, first ~= second, cell == second, old[1])
