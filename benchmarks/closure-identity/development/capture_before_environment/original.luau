local output = print
local change = _G.setfenv
local read = _G.getfenv
local function bind(p) return function() return p end end
local function factory(...)
    local old = read(1)
    local a = function() return token end
    change(1, {token = "A"})
    local first = bind(a)
    change(1, old)
    local b = function() return token end
    change(1, {token = "B"})
    local second = bind(b)
    change(1, old)
    output(first()(), second()())
end
factory()
