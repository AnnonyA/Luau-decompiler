local function bind(p) return function() return p end end
local function wrap()
    local function h() return 7 end
    return bind(h)
end
local a, b = wrap(), wrap()
local keys = {[a] = "hit"}
print(a == b, a() == b(), keys[b])
