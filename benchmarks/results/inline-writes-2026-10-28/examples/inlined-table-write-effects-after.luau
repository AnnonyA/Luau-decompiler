local function record(value, index)
    value.score = index * 3 + 1
    value.tag = index * 7 - 2
end

local first = ...
local _ = tonumber
local value2 = tonumber(first) or 3
local config = {}
local config3 = {
    __newindex = function(a, b, c)
    local _2 = tostring
    config[#config + 1] = b .. ":" .. tostring(c)
    local _3 = rawset
    rawset(a, b, c)
end,
}
local _2 = setmetatable
local value4 = setmetatable({}, config3)
for i = -3, value2 do
    value4.score = nil
    value4.tag = nil
    value4.score = i * 3 + 1
    value4.tag = i * 7 - 2
    local value5: string = ","
    print("metatable", i, value4.score, value4.tag, table.concat(config, value5))
end
local value6 = table.freeze({})
local function protected()
    value6.score = 7
    value6.tag = 12
end

local _3 = pcall
local value7 = pcall(protected)
print("frozen", value7, value6.score)
local config5 = {}
local result
for i2 = -3, value2 do
    config5.score = i2 * 3 + 1
    config5.tag = i2 * 7 - 2
    local value8: string = "alias"
    local score = config5.score
    local tag = config5.tag
    result = config5 == config5
    print(value8, score, tag, result)
end
