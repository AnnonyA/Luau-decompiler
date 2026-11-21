local record = {tag = 72}
local function setSelf(argument)
    function record:read()
        return argument, self.tag
    end
end
local seed = tonumber(...) or 123
setSelf(seed)
local value, tag = record:read()
print(type(value), value == seed, tag)
