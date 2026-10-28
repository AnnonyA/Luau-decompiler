local function weighted(value)
    return (value * value + 3) % 97
end
local argument = ...
local counter = tonumber(argument) or 0
local function pull()
    counter += 1
    print('pull', counter)
    return counter
end
local first = weighted(pull())
local second = weighted(pull())
print(first, second, counter)
for index = 1, 3 do
    print(weighted(index))
end
