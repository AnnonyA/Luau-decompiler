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
    (if true then table.insert else nil)(list, left.id .. ":" .. right.id)
    return not (left.id ~= right.id)
end

local tbl = {}
tbl["__eq"] = __eq
local list2 = {
    setmetatable({ ["id"] = 2 }, tbl),
    setmetatable({ ["id"] = 5 }, tbl),
    setmetatable({ ["id"] = 8 }, tbl),
}
local two = setmetatable({ ["id"] = 2 }, tbl)
local five = setmetatable({ ["id"] = 5 }, tbl)
local absent = setmetatable({ ["id"] = 99 }, tbl)
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
    local found = (if true then hasValue else nil)(list2, setmetatable({ ["id"] = index * 2 }, tbl))
    list3[index] = function()
        return found
    end

end
print((if true then list3[1] else nil)(), (if true then list3[2] else nil)(), (if true then list3[3] else nil)(), not (list3[1] ~= list3[2]))
print((if true then table.concat else nil)(list, ","))
