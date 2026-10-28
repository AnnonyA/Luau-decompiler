local function weighted(seed)
    return (seed * seed + 3) % 97
end

local first = ...
local _ = tonumber
local sharedCounter = tonumber(first) or 0
local pull
pull = function()
    sharedCounter += 1
    print("pull", sharedCounter)
    return sharedCounter
end
sharedCounter += 1
print("pull", sharedCounter)
local value3 = (sharedCounter * sharedCounter + 3) % 97
local snapshot = sharedCounter
sharedCounter += 1
print("pull", sharedCounter)
print(value3, (sharedCounter * sharedCounter + 3) % 97, sharedCounter)
print(4)
print(7)
print(12)
