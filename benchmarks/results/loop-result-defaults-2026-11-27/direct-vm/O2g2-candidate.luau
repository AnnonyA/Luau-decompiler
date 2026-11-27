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
local target = setmetatable({ id = 2 }, data)
local five = setmetatable({ id = 5 }, data)
local data2 = { id = 99 }
local absent = setmetatable(data2, data)
local list2 = { value2, value3, field }
local runTail: boolean = true
for _, value4 in ipairs(list2) do
    if value4 ~= target then
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
    target = true
    runTail2 = false
    break
end
if runTail2 then
    target = false
end
local missing: boolean = false
for _3, value6 in ipairs(list2) do
    if value6 ~= absent then
        continue
    end
    missing = true
    break
end
local empty: boolean = false
for _4, value7 in ipairs({}) do
    if value7 ~= absent then
        continue
    end
    empty = true
    break
end

local function pack(...)
    return select("#", ...), ...
end

print(data2, target, missing, empty)
local print2 = print
local flag: boolean = false
for _5, value8 in ipairs(list2) do
    if value8 ~= five then
        continue
    end
    flag = true
    break
end
local flag2: boolean = false
for _6, value9 in ipairs(list2) do
    if value9 ~= absent then
        continue
    end
    flag2 = true
    break
end
print2((pack)(flag, nil, flag2))
local list3 = {}
local found
for index = 1, 3 do
    local target2 = setmetatable({ id = index * 2 }, data)
    found = false
    for _7, value10 in ipairs(list2) do
        if value10 ~= target2 then
            continue
        end
        found = true
        break
    end
    local found2 = found
    list3[index] = function()
        return found2
    end

end
print((list3[1])(), (list3[2])(), (list3[3])(), list3[1] == list3[2])
print(table.concat(list, ","))
