local Module = {}
Module.__index = Module
Module.__index = { fallback = 7 }
local object = setmetatable({}, Module)
print(object.fallback, type(Module.__index), Module.__index == Module)
return Module
