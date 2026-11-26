local sequence = 0
local function observe(key)
    sequence += 1
    return key * 10 + sequence
end
local proxy = setmetatable({}, {
    __index = function(_, key) return observe(key) end,
    __add = function(_, key) return observe(key) end,
    __newindex = function(_, key, value) print(key, value) end,
})
local i = 1
local function readFirst()
    proxy[i], i, proxy[i + 1] = proxy[i + 1], i + 1, proxy + i
end
local function addFirst()
    proxy[i], i, proxy[i + 1] = proxy + (i + 1), i + 1, proxy[i]
end
readFirst()
addFirst()
