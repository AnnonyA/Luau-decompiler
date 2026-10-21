local function values() return 7, nil, 9 end
local fixed = {0, (values())}
local open = {0, values()}
print(fixed[1], fixed[2], tostring(fixed[3]), tostring(fixed[4]))
print(open[1], open[2], tostring(open[3]), open[4])
