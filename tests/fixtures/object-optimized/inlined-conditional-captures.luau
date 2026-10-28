local first = ...
local limit = tonumber(first) or 4
local saved = {}
for offset = -2, limit do
    local function weighted(value)
        return if value < 0 then value * 7 + offset else value * 3 - offset
    end
    saved[#saved + 1] = weighted
    for index = -3, 3 do
        print("stable", offset, index, weighted(index))
    end
end
for index, callback in saved do
    print("saved", index, callback(-3), callback(2), callback == saved[index])
end
local bias = 1
local function change()
    bias += 2
end
local function mutable(value)
    return if value < 0 then value * 7 + bias else value * 3 - bias
end
for index = -3, 3 do
    change()
    print("mutable", index, mutable(index), bias)
end
