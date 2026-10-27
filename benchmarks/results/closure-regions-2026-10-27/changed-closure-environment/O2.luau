local config = { bias = 1 }
local function factory()
    local function_
    function_ = function()
        return config
    end
    return function_
end

local setfenv = _G.setfenv
local field = (_G.getfenv())
local config2 = {}
local config3 = { __index = field }
local _ = setmetatable
setfenv(1, (setmetatable(config2, config3)))
local function function_2()
    return config
end

local function function_3()
    return config
end

config2 = if function_2 ~= function_3 then false else true
config3 = function_2() == config
local result = function_3() == config
print(config2, config3, result)
