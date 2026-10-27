local config = { bias = 1 }
local function factory()
    local function_
    function_ = function()
        return config
    end
    return function_
end

local setfenv = _G.setfenv
local value = _G.getfenv()
local config2 = {}
local config3 = { __index = value }
local _ = setmetatable
setfenv(1, setmetatable(config2, config3))
local value2 = factory()
local value3 = factory()
config2 = if value2 ~= value3 then false else true
config3 = value2() == config
local result = value3() == config
print(config2, config3, result)
