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
local replace
replace = function(seed)
    sharedCounter = seed
end
local first = ...
local _ = tonumber
local value4 = tonumber(first) or 4
local sharedCounter3: number = 0
local __add
__add = function(value6, index)
    sharedCounter3 += 1
    return index + sharedCounter3 * 10
end
local config2 = { __add = __add }
local _2 = setmetatable
local value7 = setmetatable({}, config2)
for i = -2, value4 do
    sharedCounter = value7
    sharedCounter += 1
    sharedCounter2 = if i > 0 then sharedCounter2 + sharedCounter else sharedCounter2 - 1
    print("changed", i, sharedCounter, sharedCounter2, sharedCounter3)
end
local snapshot = sharedCounter
sharedCounter = nil
local protected
protected = function()
    sharedCounter += 1
    sharedCounter2 += sharedCounter
end
local _3 = pcall
local value8 = pcall(protected)
print("failure", value8, sharedCounter, sharedCounter2, sharedCounter3)
