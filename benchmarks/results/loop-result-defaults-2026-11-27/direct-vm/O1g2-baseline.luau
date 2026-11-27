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
local first = (if true then hasValue else nil)(list2, two)
local middle = (if true then hasValue else nil)(list2, five)
local missing = (if true then hasValue else nil)(list2, absent)
local empty = (if true then hasValue else nil)({}, absent)

local function pack(...)
    return select("#", ...), ...
end

print(first, middle, missing, empty)
print((if true then pack else nil)((if true then hasValue else nil)(list2, five), nil, (if true then hasValue else nil)(list2, absent)))
local list3 = {}
for index = 1, 3 do
    local found = (if true then hasValue else nil)(list2, setmetatable({ id = index * 2 }, data))
    list3[index] = function()
        return found
    end

end
print((if true then list3[1] else nil)(), (if true then list3[2] else nil)(), (if true then list3[3] else nil)(), list3[1] == list3[2])
print(table.concat(list, ","))
