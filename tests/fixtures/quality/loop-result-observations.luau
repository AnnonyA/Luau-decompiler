local trace = {}
local function hasValue(values, target)
    for _, value in ipairs(values) do
        if value == target then
            return true
        end
    end
    return false
end
local meta = { __eq = function(left, right)
    table.insert(trace, left.id .. ":" .. right.id)
    return left.id == right.id
end }
local values = { setmetatable({ id = 2 }, meta), setmetatable({ id = 5 }, meta), setmetatable({ id = 8 }, meta) }
local two = setmetatable({ id = 2 }, meta)
local five = setmetatable({ id = 5 }, meta)
local absent = setmetatable({ id = 99 }, meta)
local first = hasValue(values, two)
local middle = hasValue(values, five)
local missing = hasValue(values, absent)
local empty = hasValue({}, absent)
local function pack(...) return select("#", ...), ... end
print(first, middle, missing, empty)
print(pack(hasValue(values, five), nil, hasValue(values, absent)))
local saved = {}
for index = 1, 3 do
    local found = hasValue(values, setmetatable({ id = index * 2 }, meta))
    saved[index] = function() return found end
end
print(saved[1](), saved[2](), saved[3](), saved[1] == saved[2])
print(table.concat(trace, ","))
