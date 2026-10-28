local first = ...
local _ = tonumber
local value = tonumber(first) or 4
local config = {}
for index = -2, value do
    local function weighted(seed)
        return if seed < 0 then seed * 7 + index else seed * 3 - index
    end

    config[#config + 1] = weighted
    local result: number = 3
    local result2
    for j = -3, result do
        local value3: string = "stable"
        result2 = if j < 0 then j * 7 + index else j * 3 - index
        print(value3, index, j, result2)
    end
end
for key, value4 in config do
    local value5: string = "saved"
    local value6 = value4(-3)
    local value7 = value4(2)
    local result3 = value4 == config[key]
    print(value5, key, value6, value7, result3)
end
local sharedCounter: number = 1
local change
change = function()
    sharedCounter += 2
end
local mutable
mutable = function(seed)
    return if seed < 0 then seed * 7 + sharedCounter else seed * 3 - sharedCounter
end
local result5
for i = -3, 3 do
    sharedCounter += 2
    local value9: string = "mutable"
    result5 = if i < 0 then i * 7 + sharedCounter else i * 3 - sharedCounter
    print(value9, i, result5, sharedCounter)
end
