-- a local that a closure assigns, read as an argument before a call that runs the closure
local n = 1
local function bump()
	n += 10
	return n
end

local max = math.max
local obj = {}
function obj:show(...)
	return select("#", ...), ...
end

print(n, bump(), n)
print(math.max(n, bump()), n)
print(max(n, bump()), n)
print(obj:show(n, bump(), n))
print(tostring(n) .. tostring(bump()), n)
local t = { n, bump(), n }
print(t[1], t[2], t[3])
print(n + bump(), n)
print(select(2, n, bump(), n))
