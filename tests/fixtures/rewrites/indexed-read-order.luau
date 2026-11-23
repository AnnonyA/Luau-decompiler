local sequence = 0
local proxy = setmetatable({}, {
    __index = function(_, key)
        sequence += 1
        return key * 10 + sequence
    end,
    __newindex = function(_, key, value)
        print("store", key, value)
    end,
})
local i = 1
local function rotate()
    proxy[i], i, proxy[i + 1] = proxy[i + 1], i + 1, proxy[i]
end
rotate()
