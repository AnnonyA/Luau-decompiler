local output = print
local change = _G.setfenv
local read = _G.getfenv
local function bind(p) return function() return p end end
local function factory(flag, ...)
    if flag then
        local function a() return 1 end
        return bind(a)
    else
        local function b() return 2 end
        return bind(b)
    end
end
local old = read(factory)
change(factory, {})
local f1 = factory(true)
change(factory, old)
local f2 = factory(false)
local f3 = factory(false)
local f4 = factory(true)
local keys = {[f2] = "cached"}
output(f1 == f4, f2 == f3, keys[f1], keys[f2], keys[f3], keys[f4])
output(f1()(), f2()(), f3()(), f4()())
change(f2, {})
local f5 = factory(false)
local f6 = factory(false)
change(f2, old)
local f7 = factory(false)
output(f2 == f5, f5 == f6, f2 == f7)
