local sharedCounter: number = 0
local sharedCounter2: number = 10
local advance
advance = function(seed)
    sharedCounter += 1
    if seed > 0 then
        sharedCounter2 += sharedCounter
        return
    else
        sharedCounter2 -= 1
    end
end
local tick
tick = function()
    sharedCounter += 1
    sharedCounter2 += sharedCounter
end
local first = ...
local _ = tonumber
local value2 = tonumber(first) or 4
local config = {}
for index = -2, value2 do
    print("before", index, sharedCounter, sharedCounter2)
    advance(index)
    local result3 = sharedCounter2
    local captured = result3
    local function_
    function_ = function()
        return captured, sharedCounter2, sharedCounter
    end
    config[#config + 1] = function_
    tick()
    local result4 = print
    result4("after", index, sharedCounter, sharedCounter2)
end
for key, value3 in ipairs(config) do
    print("snapshot", key, value3())
end
