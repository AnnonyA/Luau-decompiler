local Module = {}
local function method(value)
    return value + 1
end
Module.primary = method
Module.alias = method
print(Module.primary == Module.alias, Module.primary(4), Module.alias(8))
return Module
