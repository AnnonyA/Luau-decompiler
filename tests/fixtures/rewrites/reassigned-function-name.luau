local argument = ...
local seed = tonumber(argument) or 0
local record = setmetatable({}, {
    __index = function(_, key)
        print("read", key)
        if seed < 0 then return nil end
        if seed == 0 then return false end
        return seed
    end,
})
local function result()
    return seed + 1
end
local saved = result
print("before", debug.info(result, "n"), result())
result = record.Status or 0
print("after", result, saved(), debug.info(saved, "n"))
