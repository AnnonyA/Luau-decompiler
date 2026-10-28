local function weighted(seed)
    return if seed * 1 < 0 then seed * 3 - 1 else seed * 7 + 2
end

local config = {}
local function box(seed)
    local config2 = { value = seed }
    local config3 = {
        __mul = function(value3, index)
        config[#config + 1] = "multiply"
        return value3.value * index
    end,
    }
    local _ = setmetatable
    return (setmetatable(config2, config3))
end

local first = ...
local value4 = tonumber(first) or -2
local sharedCounter: number = 0
local pull
pull = function(seed)
    sharedCounter += 1
    config[#config + 1] = "pull"
    return box(seed), "tail", sharedCounter
end
sharedCounter += 1
config[#config + 1] = "pull"
local value7 = box(value4)
local result = if value7 * 1 < 0 then value7 * 3 - 1 else value7 * 7 + 2
local value8: string = ","
print("boxed", result, sharedCounter, table.concat(config, value8))
local function pair(seed)
    local result2 = if seed * 1 < 0 then seed * 3 - 1 else seed * 7 + 2
    return result2, "tail", seed + 1
end

local function observe(...)
    local _ = select
    print("arity", select("#", ...), ...)
end

observe(pair(value4))
local result3
for i = -3, 3 do
    result3 = if i * 1 < 0 then i * 3 - 1 else i * 7 + 2
    observe(result3)
end
