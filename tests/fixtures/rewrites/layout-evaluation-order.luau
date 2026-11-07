local argument = ...
local limit = tonumber(argument) or 2
local trace = {}
local function record(message)
    table.insert(trace, message)
end
local function object(path)
    return setmetatable({path = path}, {
        __index = function(self, key)
            record("lookup:" .. self.path .. ":" .. key)
            if key == "WaitForChild" then
                return function(receiver, child, timeout)
                    record("call:" .. receiver.path .. ":" .. child .. ":" .. tostring(timeout))
                    return object(receiver.path .. "/" .. child), "extra"
                end
            end
            return nil
        end,
    })
end
local function timeout()
    record("timeout")
    return limit
end
local function many(...)
    record("many")
    return ...
end
local function scalar(...)
    local result = many(...)
    return result
end
local function first(...)
    local result = ...
    return result
end
local root = object("root")
local gui = root:WaitForChild("Gui")
local panel = gui:WaitForChild("Panel", timeout())
print("path", panel.path)
print("packs", select("#", scalar(limit, nil, 8)), scalar(limit, nil, 8), select("#", first()), first(nil, 8))
for index, event in trace do
    print(index, event)
end
