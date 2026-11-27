local output = print
local swap = _G.setfenv
local record = {}
local f = function() return token end
swap(1, {token = "changed"})
record.read = f
output(record.read())
