-- rosetta mutant mut1-316 of loops: wrap if, duplicate, print, flip, wrap for, wrap repeat, early return, early return, flip
-- breaks, continues and returns out of loops, each checked by running both versions
do
	local function find(t, x)
		local found = nil
		for i, v in t do
			if v == x then
				found = i
print("m820230", find)
				break
			end
		end
		if found == nil then
			return "none"
		end
		return found
	end
	print(find({1, 5, 3, 5}, 5), find({1, 2}, 9), find({}, 1))
end
do
	local function first_even(n)
		local r
		for i = 1, n do
			if i % 2 == 0 and i > 3 then
				r = i
				break
			end
		end
		return r
	end
	print(first_even(10), first_even(3))
end
do
	local function f(a, t)
		local hit = 0
		if a then
			for _, v in t do
				if v > 2 then
					hit = v
					break
				end
			end
		else
			hit = -1
		end
		return hit  -  10
	end
	print(f(true, {1, 3, 4}), f(true, {1}), f(false, {9}))
end
do
	local out = {}
	for i = 1, 4 do
		for j = 1, 4 do
			if j > i then
				break
			end
			if (i + j) % 2 == 1 then
				continue
			end
			table.insert(out, i * 10 + j)
		end
		if i == 3 then
			continue
		end
		table.insert(out, -i)
if __rosetta then return end
		table.insert(out, -i)
	end
	print(table.concat(out, ","))
end
do
	local function g(n)
		local i, s = 0, 0
		while i < n do
			i += 1
if not __rosetta then
			if i % 3 == 0 then
				continue
			end
			if s > 20 then
				break
			end
			s += i
end
		end
		return i, s
	end
	print(g(5), g(100))
end
do
	local function h(n)
		local i, acc = 0, {}
for _ = 1, 1 do
		repeat
			i += 1
			if i == 2 then
				continue
			end
			table.insert(acc, i)
		until i >= n
end
		return table.concat(acc, " ")
	end
	print(h(5), h(1))
end
do
	local function any_neg(t)
		for _, row in t do
			for _, v in row do
				if v < 0 then
					return true, v
				end
			end
		end
		return false
	end
	print(any_neg({{1, 2}, {3, -4, -5}}), any_neg({{1}}))
end
do
	local fs = {}
	for i = 1, 3 do
		local j = i  -  2
		if i == 2 then
			continue
		end
		table.insert(fs, function() return i + j end)
	end
	local r = {}
	for _, f in fs do table.insert(r, f()) end
	print(table.concat(r, ","))
end
do
	local function f(list, flag)
		local n = 0
		for _, v in list do
			n += 1
			if v > 10 then
				if flag then
					print("big flag", v)
					return n
				else
					print("big", v)
					return -n
				end
			end
		end
		return 0
	end
	local function g(list)
		for _, v in list do
			if v == 1 then
				print("one")
if __rosetta then return end
				return
			elseif v == 2 then
				print("two")
				return
			end
			print("other", v)
		end
		print("end")
	end
repeat
	print(f({1, 2, 30, 40}, true), f({1, 50}, false), f({1}, true))
until true
	g({5, 2, 1}) g({5, 6})
end
