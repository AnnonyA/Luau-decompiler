local argument = ...
local value = tonumber(argument) or 3
local callback
local function reader()
    return callback
end
callback = function(number)
    return debug.info(1, "n"), number * 7
end
local name, result = reader()(value)
print("anonymous", name == "", result)
