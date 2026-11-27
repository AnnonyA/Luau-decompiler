local function hasValue(list, p): boolean
    for _, value in ipairs(list) do
        if value == p then
            return true
        end
    end
    return false
end

local list = {}

local function __eq(p, p2)
    (table.insert)(list, p.id .. ":" .. p2.id)
    return not (p.id ~= p2.id)
end

local tbl = {}
tbl["__eq"] = __eq
local list2 = {
    setmetatable({ id = 2 }, tbl),
    setmetatable({ id = 5 }, tbl),
    setmetatable({ id = 8 }, tbl),
}
local value = setmetatable({ id = 2 }, tbl)
local value2 = setmetatable({ id = 5 }, tbl)
local value3 = setmetatable({ id = 99 }, tbl)
local value4 = (true and hasValue)(list2, value)
local value5 = (true and hasValue)(list2, value2)
local value6 = (true and hasValue)(list2, value3)
local value7 = (true and hasValue)({}, value3)

local function pack(...)
    return select("#", ...), ...
end

print(value4, value5, value6, value7)
print((pack)((true and hasValue)(list2, value2), nil, (true and hasValue)(list2, value3)))
local list3 = {}
for i = 1, 3 do
    local value8 = (true and hasValue)(list2, setmetatable({ id = i * 2 }, tbl))
    list3[i] = function()
        return value8
    end

end
print((list3[1])(), (list3[2])(), (list3[3])(), not (list3[1] ~= list3[2]))
print((table.concat)(list, ","))
