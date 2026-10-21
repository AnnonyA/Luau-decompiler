local function read(data) return data.x end
local value = 1
local config = {x = value}
value = 2
print(read(config), value)
