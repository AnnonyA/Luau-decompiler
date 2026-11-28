local trace = {}
local token = {}
local function record(label, value)
    trace[#trace + 1] = label
    return value, nil, token
end

local function flat(first, second, final)
    local result = record("first", first) == true
    if result then return result end
    result = record("second", second) == true
    if result then return result end
    result = record("last", final)
    return result
end

local function flatAnd(first, second, final)
    local result = record("first", first) ~= false
    if not result then return result end
    result = record("second", second) ~= false
    if not result then return result end
    result = record("last", final)
    return result
end

local function prefix(first, second)
    local result = record("first", first) == true
    if result then return result end
    result = record("second", second) == true
    if result then return result end
    record("tail", false)
    return result
end

local function captured(first, second)
    local result = record("first", first) == true
    local function reader() return result end
    if result then return reader end
    result = record("second", second) == true
    if result then return reader end
    record("captured tail", result)
    return reader
end

local function withPrimitiveRight(value, second)
    local result = record("unknown", value) and record("condition", second) == true
    if result then return result end
    result = record("fallback", second) == true
    return result
end

local function describe(value)
    if value == nil then return "nil" end
    if value == token then return "token" end
    return tostring(value)
end
local inputs = {{false}, {nil}, {true}, {0}, {token}}
for _, first in inputs do
    for _, second in inputs do
        for _, final in inputs do
            print(describe(flat(first[1], second[1], final[1])))
            print(describe(flatAnd(first[1], second[1], final[1])))
            print("arity", select("#", flat(first[1], second[1], final[1])), select("#", flatAnd(first[1], second[1], final[1])))
        end
        print("prefix", prefix(first[1], second[1]))
        local reader = captured(first[1], second[1])
        print("captured", reader())
        print("primitive", withPrimitiveRight(first[1], second[1]))
    end
end
print(table.concat(trace, ","))
