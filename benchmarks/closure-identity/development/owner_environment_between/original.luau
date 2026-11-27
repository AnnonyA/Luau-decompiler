local output=print
local change=_G.setfenv
local old=_G.getfenv(1)
local function make() return function() return token end end
local first=make()
change(1,{token="B"})
local second=make()
change(1,old)
local third=make()
output(first==third,first==second,first(),second(),third())
