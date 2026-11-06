local sharedCounter: number = 0
local read
read = function()
    return sharedCounter
end
local first = ...
local _ = tonumber
local _2 = tonumber(first) or 4
local config = { read }
for index = 1, tonumber(first) or 4 do
    sharedCounter = if index % 2 == 0 then sharedCounter + index else sharedCounter - index
    sharedCounter += 2
    sharedCounter *= 3
    local value: string = "joined"
    local value2 = config[1]()
    print(value, index, value2, sharedCounter)
end
print("final", config[1]())
