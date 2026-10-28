local function blend(left, right)
    return (left * left + right * 3) / (left - right)
end
local argument = ...
local limit = tonumber(argument) or 5
for index = -3, limit do
    print(index, blend(index, index + 1), blend(index + 1, index))
end
