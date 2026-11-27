local high = 9007199254740993i
local low = 9007199254740992i
local function inspect(value, ...)
    print(typeof(value), tostring(value), value == low, value == high)
end
inspect(high)
inspect(low)
