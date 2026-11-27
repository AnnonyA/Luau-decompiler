local function hasValue(values, target): boolean
    for _, value in ipairs(values) do
        if value == target then
            return true
        end
    end
    return false
end

local list = {}
local data = {}
data.__eq = function(left, right)
    table.insert(list, left.id .. ":" .. right.id)
    return not (left.id ~= right.id)
end

local list2 = {
    setmetatable({ id = 2 }, data),
    setmetatable({ id = 5 }, data),
    setmetatable({ id = 8 }, data),
}
local two = setmetatable({ id = 2 }, data)
local five = setmetatable({ id = 5 }, data)
local absent = setmetatable({ id = 99 }, data)
local first = (true and hasValue)(list2, two)
local middle = (true and hasValue)(list2, five)
local missing = (true and hasValue)(list2, absent)
local empty = (true and hasValue)({}, absent)

local function pack(...)
    return select("#", ...), ...
end

print(first, middle, missing, empty)
print((pack)((true and hasValue)(list2, five), nil, (true and hasValue)(list2, absent)))
local list3 = {}
for index = 1, 3 do
    local found = (true and hasValue)(list2, setmetatable({ id = index * 2 }, data))
    list3[index] = function()
        return found
    end

end
print((list3[1])(), (list3[2])(), (list3[3])(), list3[1] == list3[2])
print(table.concat(list, ","))
