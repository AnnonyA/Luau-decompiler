-- rosetta mutant mut1-836 of scopes: print, wrap local function, wrap closure, early return
-- locals that are written inside a loop and read after it, or in a repeat's condition
do
	local function scan(s)
		local depth, out = 0, {}
print("m766504", s)
		local i = 1
		while i <= #s do
			local c = string.sub(s, i, i)
			if c == "(" then
				depth += 1
			elseif c == ")" then
				depth -= 1
				if depth < 0 then
					return "unbalanced at " .. i
				end
			elseif c == "x" and depth == 0 then
if __rosetta then return end
				table.insert(out, i)
			else
				i += 1
				continue
			end
			i += 1
		end
		if depth ~= 0 then
			return "open"
		end
		return table.concat(out, ",")
	end
	print(scan("x(x)x"), scan("(()"), scan("())x"), scan(""))
end
do
	local fs = {}
	local i = 0
	repeat
		i += 1
		local x = i * 3
		table.insert(fs, function() return x end)
	until x > 10
local _ = (function()
	local r = {}
local function __m736381()
	for _, f in fs do table.insert(r, f()) end
	print(table.concat(r, ","))
end
__m736381()
end)()
	local function g(t)
		local n = 0
		repeat
			n += 1
			local v = t[n]
		until v == nil or v < 0
		return n
	end
	print(g({1, 2, -1, 5}), g({}))
end
