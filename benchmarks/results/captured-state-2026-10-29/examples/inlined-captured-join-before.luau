local result: number = 0
local read
read = function()
    return result
end
local first = ...
local _ = tonumber
local _2 = tonumber(first) or 4
local config = { read }
for index = 1, tonumber(first) or 4 do
    result = if index % 2 == 0 then result + index else result - index
    result = (result + 2) * 3
    local value: string = "joined"
    local value2 = config[1]()
    print(value, index, value2, result)
end
print("final", config[1]())
