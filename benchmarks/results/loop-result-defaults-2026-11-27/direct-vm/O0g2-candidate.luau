local function hasValue(values, target): boolean
    for _, value in ipairs(values) do
        if value == target then
            return true
        end
    end
    return false
end

local list = {}

local function __eq(left, right)
    (table.insert)(list, left.id .. ":" .. right.id)
    return not (left.id ~= right.id)
end

local tbl = {}
tbl["__eq"] = __eq
local list2 = {
    setmetatable({ id = 2 }, tbl),
    setmetatable({ id = 5 }, tbl),
    setmetatable({ id = 8 }, tbl),
}
local two = setmetatable({ id = 2 }, tbl)
local five = setmetatable({ id = 5 }, tbl)
local absent = setmetatable({ id = 99 }, tbl)
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
    local found = (true and hasValue)(list2, setmetatable({ id = index * 2 }, tbl))
    list3[index] = function()
        return found
    end

end
print((list3[1])(), (list3[2])(), (list3[3])(), not (list3[1] ~= list3[2]))
print((table.concat)(list, ","))
