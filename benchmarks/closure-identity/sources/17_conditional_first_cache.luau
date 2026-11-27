local function bind(p) return function() return p end end
local function factory(flag, ...)
    local out = {}
    for i = 1, 2 do
        if flag then
            local function a() return 1 end
            out[i] = bind(a)
        else
            local function b() return 2 end
            out[i] = bind(b)
        end
    end
    return out
end
local a, b = factory(true), factory(false)
local keys = {[a[1]] = "first", [b[1]] = "second"}
print(a[1] == a[2], b[1] == b[2], keys[a[2]], keys[b[2]])
