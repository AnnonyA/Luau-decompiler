local config = { ["bias"] = 1 }
local function factory()
    local function_
    function_ = function()
        return config
    end
    return function_
end

local setfenv = _G.setfenv
local value: string = "__index"
local value2 = _G.getfenv()
local config2 = {}
local config3 = { [value] = value2 }
setfenv(1, setmetatable(config2, config3))
local value3 = factory()
local value4 = factory()
config2 = if value3 ~= value4 then false else true
config3 = value3() == config
local result = value4() == config
print(config2, config3, result)
