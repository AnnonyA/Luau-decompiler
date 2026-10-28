local function band(seed)
    return if seed < -2 then seed * 3 - 1 elseif seed > 4 then seed * 7 + 2 else seed * seed + 5
end

local function shifted(seed)
    local value3 = seed * 3 + 1
    return if value3 < 0 then -value3 + 2 else value3 * 7
end

local function inside(seed)
    if seed < -2 then
        local result = seed * seed < 49
        return result
    else
        local result2 = seed * 3 + 1 <= 10
        return result2
    end
end

local first = ...
local _ = tonumber
local value5 = tonumber(first) or 8
local result3: number = 0
local result4
for index = -5, value5 do
    local result5 = band(index)
    local value6 = index * 3 + 1
    local result6 = shifted(index)
    result3 += result5 + result6
    result4 = inside(index)
    print(index, result5, result6, result4)
end
print("total", result3)
