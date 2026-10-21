local function empty() return end
local function one() return nil end
local function two() return nil, nil end
print(select("#", empty()), select("#", one()), select("#", two()))
local value = empty()
print(tostring(value))
