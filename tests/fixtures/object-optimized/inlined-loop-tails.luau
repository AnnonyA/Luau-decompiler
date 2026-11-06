-- Original regression: an inline return skips a conditional/effectful tail;
-- an ordinary break still runs it. Values and callbacks cross both exits.
local function scan(limit, noisy)
    local n = 0
    while n < 4 do
        n += 1
        if n > limit then return n end
        if n == 3 then break end
    end
    if noisy then print("tail", limit) end
    return -2
end
local function position(values, needle)
    for i = #values, 1, -1 do
        if values[i] == 0 then break end
        if values[i] == needle then return i end
    end
    return -3
end
local function label(values, needle)
    for _, value in values do
        if value == needle then return "equal" end
        if value > needle then return "greater" end
    end
    return "none"
end
local first = ...
local limit = tonumber(first) or 2
local sum = 0
for i = 0, 5 do
    local score = scan(i, i % 2 == 0)
    sum += score
    print("score", i, score, sum)
end
local p = position({2,0,5,9}, limit)
local category = label({1,4,8}, limit)
print("selected", p, category, sum)
