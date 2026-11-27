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

local value = setmetatable({ id = 2 }, data)
local value2 = setmetatable({ id = 5 }, data)
local field = (setmetatable({ id = 8 }, data))
local value3 = setmetatable({ id = 2 }, data)
local value4 = setmetatable({ id = 5 }, data)
local data2 = { id = 99 }
local value5 = setmetatable(data2, data)
local list2 = { value, value2, field }
local runTail: boolean = true
for _, value6 in ipairs(list2) do
    if value6 ~= value3 then
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
for _2, value7 in ipairs(list2) do
    if value7 ~= value4 then
        continue
    end
    value3 = true
    runTail2 = false
    break
end
if runTail2 then
    value3 = false
end
local flag: boolean = false
for _3, value8 in ipairs(list2) do
    if value8 ~= value5 then
        continue
    end
    flag = true
    break
end
local flag2: boolean = false
for _4, value9 in ipairs({}) do
    if value9 ~= value5 then
        continue
    end
    flag2 = true
    break
end

local function pack(...)
    return select("#", ...), ...
end

print(data2, value3, flag, flag2)
local print2 = print
local flag3: boolean = false
for _5, value10 in ipairs(list2) do
    if value10 ~= value4 then
        continue
    end
    flag3 = true
    break
end
local flag4: boolean = false
for _6, value11 in ipairs(list2) do
    if value11 ~= value5 then
        continue
    end
    flag4 = true
    break
end
print2((pack)(flag3, nil, flag4))
local list3 = {}
local result
for i = 1, 3 do
    local value12 = setmetatable({ id = i * 2 }, data)
    result = false
    for _7, value13 in ipairs(list2) do
        if value13 ~= value12 then
            continue
        end
        result = true
        break
    end
    local captured = result
    list3[i] = function()
        return captured
    end

end
print((list3[1])(), (list3[2])(), (list3[3])(), list3[1] == list3[2])
print(table.concat(list, ","))
