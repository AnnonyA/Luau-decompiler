local function values() return 4, nil, 6 end
local function relay(...) return ... end
local first, second, third, fourth = relay(2, values())
print(first, second, tostring(third), fourth)
print(select("#", relay(2, values())))
