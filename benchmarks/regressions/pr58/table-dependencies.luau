local n = tonumber(...) or 0
local value = n
local config = {value, value + 1}
value += 7
local function snapshot() return config end
local function shadow(config) return config + 2 end
print("snapshot", snapshot() == snapshot(), snapshot()[1], value, shadow(n))
for index, item in ipairs(config) do print(index, item) end
