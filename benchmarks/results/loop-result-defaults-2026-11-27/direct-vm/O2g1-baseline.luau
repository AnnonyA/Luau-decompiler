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
local runTail3: boolean = true
local result
for _3, value8 in ipairs(list2) do
    if value8 ~= value5 then
        continue
    end
    result = true
    runTail3 = false
    break
end
if runTail3 then
    result = false
end
local runTail4: boolean = true
local result2
for _4, value9 in ipairs({}) do
    if value9 ~= value5 then
        continue
    end
    result2 = true
    runTail4 = false
    break
end
if runTail4 then
    result2 = false
end

local function pack(...)
    return select("#", ...), ...
end

print(data2, value3, result, result2)
local print2 = print
local runTail5: boolean = true
for _5, value10 in ipairs(list2) do
    if value10 ~= value4 then
        continue
    end
    result2 = true
    runTail5 = false
    break
end
if runTail5 then
    result2 = false
end
local runTail6: boolean = true
local result3
for _6, value11 in ipairs(list2) do
    if value11 ~= value5 then
        continue
    end
    result3 = true
    runTail6 = false
    break
end
if runTail6 then
    result3 = false
end
print2((if true then pack else nil)(result2, nil, result3))
local list3 = {}
for i = 1, 3 do
    local value12 = setmetatable({ id = i * 2 }, data)
    local runTail7: boolean = true
    for _7, value13 in ipairs(list2) do
        if value13 ~= value12 then
            continue
        end
        result3 = true
        runTail7 = false
        break
    end
    if runTail7 then
        result3 = false
    end
    local captured = result3
    list3[i] = function()
        return captured
    end

end
print((if true then list3[1] else nil)(), (if true then list3[2] else nil)(), (if true then list3[3] else nil)(), list3[1] == list3[2])
print(table.concat(list, ","))
