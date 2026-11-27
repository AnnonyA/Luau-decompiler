local function pick(flag)
    if flag then
        return function() return 1 end
    else
        return function() return 1 end
    end
end
local call = {pick}
local a = call[1](true)
local b = call[1](true)
local c = call[1](false)
local d = call[1](false)
local keys = {[a] = "left", [c] = "right"}
print(a == b, c == d, a == c, keys[b], keys[d])
