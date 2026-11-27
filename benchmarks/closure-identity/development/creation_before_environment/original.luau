local output = print
local swap = _G.setfenv
local f
f = function() return token end
swap(1, {token = "changed"})
output(f())
