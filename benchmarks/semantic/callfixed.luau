local function many() return 1, 2, 3 end
local function count(...) return select("#", ...), ... end
print(count((many())))
print(count(many(), 9))
print(count(9, many()))
