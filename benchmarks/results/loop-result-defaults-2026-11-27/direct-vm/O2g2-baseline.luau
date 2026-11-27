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

local value2 = setmetatable({ id = 2 }, data)
local value3 = setmetatable({ id = 5 }, data)
local field = (setmetatable({ id = 8 }, data))
local two = setmetatable({ id = 2 }, data)
local five = setmetatable({ id = 5 }, data)
local data2 = { id = 99 }
local absent = setmetatable(data2, data)
local list2 = { value2, value3, field }
local runTail: boolean = true
for _, value4 in ipairs(list2) do
    if value4 ~= two then
        continue
    end
    data2 = true
    runTail = false
    break
end
if runTail then
    data2 = false
end
local runTail2: boolean = true
for _2, value5 in ipairs(list2) do
    if value5 ~= five then
        continue
    end
    two = true
    runTail2 = false
    break
end
if runTail2 then
    two = false
end
local runTail3: boolean = true
local missing
for _3, value6 in ipairs(list2) do
    if value6 ~= absent then
        continue
    end
    missing = true
    runTail3 = false
    break
end
if runTail3 then
    missing = false
end
local runTail4: boolean = true
local empty
for _4, value7 in ipairs({}) do
    if value7 ~= absent then
        continue
    end
    empty = true
    runTail4 = false
    break
end
if runTail4 then
    empty = false
end

local function pack(...)
    return select("#", ...), ...
end

print(data2, two, missing, empty)
local print2 = print
local runTail5: boolean = true
local result
for _5, value8 in ipairs(list2) do
    if value8 ~= five then
        continue
    end
    result = true
    runTail5 = false
    break
end
if runTail5 then
    result = false
end
local runTail6: boolean = true
local result2
for _6, value9 in ipairs(list2) do
    if value9 ~= absent then
        continue
    end
    result2 = true
    runTail6 = false
    break
end
if runTail6 then
    result2 = false
end
print2((if true then pack else nil)(result, nil, result2))
local list3 = {}
local found
for index = 1, 3 do
    local target = setmetatable({ id = index * 2 }, data)
    local runTail7: boolean = true
    for _7, value10 in ipairs(list2) do
        if value10 ~= target then
            continue
        end
        found = true
        runTail7 = false
        break
    end
    if runTail7 then
        found = false
    end
    local found2 = found
    list3[index] = function()
        return found2
    end

end
print((if true then list3[1] else nil)(), (if true then list3[2] else nil)(), (if true then list3[3] else nil)(), list3[1] == list3[2])
print(table.concat(list, ","))
