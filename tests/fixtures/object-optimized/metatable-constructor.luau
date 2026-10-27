local Module = {}
Module.__index = Module
function Module.new(value)
    local self = setmetatable({ value = value }, Module)
    return self
end
function Module:read(offset)
    return self.value + offset
end
Module.alias = Module.read
local object = Module.new(5)
print(object:read(3), object:alias(7), Module.read == Module.alias, getmetatable(object) == Module)
return Module
