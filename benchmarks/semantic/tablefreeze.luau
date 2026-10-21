local data = table.freeze({value = 3})
local function mutate() data.value = 4 end
local okay = pcall(mutate)
print(table.isfrozen(data), okay, data.value)
