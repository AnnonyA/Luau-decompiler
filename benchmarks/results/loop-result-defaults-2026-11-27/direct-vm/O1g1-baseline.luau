local function hasValue(list, p): boolean
    for _, value in ipairs(list) do
        if value == p then
            return true
        end
    end
    return false
end

local list = {}
local data = {}
data.__eq = function(p, p2)
    table.insert(list, p.id .. ":" .. p2.id)
    return not (p.id ~= p2.id)
end

local list2 = {
    setmetatable({ id = 2 }, data),
    setmetatable({ id = 5 }, data),
    setmetatable({ id = 8 }, data),
}
local value = setmetatable({ id = 2 }, data)
local value2 = setmetatable({ id = 5 }, data)
local value3 = setmetatable({ id = 99 }, data)
local value4 = (if true then hasValue else nil)(list2, value)
local value5 = (if true then hasValue else nil)(list2, value2)
local value6 = (if true then hasValue else nil)(list2, value3)
local value7 = (if true then hasValue else nil)({}, value3)

local function pack(...)
    return select("#", ...), ...
end

print(value4, value5, value6, value7)
print((if true then pack else nil)((if true then hasValue else nil)(list2, value2), nil, (if true then hasValue else nil)(list2, value3)))
local list3 = {}
for i = 1, 3 do
    local data2 = { id = i * 2 }
    local function_
    do
        local value8
        value8 = (if true then hasValue else nil)(list2, setmetatable(data2, data))
        function_ = function()
            return value8
        end

    end
    list3[i] = function_
end
print((if true then list3[1] else nil)(), (if true then list3[2] else nil)(), (if true then list3[3] else nil)(), list3[1] == list3[2])
print(table.concat(list, ","))
