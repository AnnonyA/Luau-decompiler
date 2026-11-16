local function classify(n)
	if n < 0 then
		return "negative"
	elseif n == 0 then
		return "zero"
	elseif n < 10 then
		return "small"
	elseif n < 100 then
		return "medium"
	else
		return "large"
	end
end

local function collatz(n)
	local steps = 0
	while n ~= 1 do
		if n % 2 == 0 then
			n = n / 2
		else
			n = n * 3 + 1
		end
		steps += 1
		if steps > 1000 then
			break
		end
	end
	return steps
end

local function findFirst(list, predicate)
	for index, value in ipairs(list) do
		if predicate(value) then
			return index, value
		end
	end
	return nil
end

local function sumEvenSkipBig(list, limit)
	local total = 0
	for i = 1, #list do
		local v = list[i]
		if v % 2 ~= 0 then
			continue
		end
		if v > limit then
			break
		end
		total += v
	end
	return total
end

local function repeatDemo(start)
	local value = start
	local count = 0
	repeat
		local half = value // 2
		value = half
		count += 1
	until half <= 1 or count >= 20
	return value, count
end

local function nested(grid)
	local hits = {}
	for y, row in ipairs(grid) do
		for x, cell in ipairs(row) do
			if cell == 0 then
				continue
			elseif cell < 0 then
				break
			end
			if x == y then
				table.insert(hits, cell * 2)
			else
				table.insert(hits, cell)
			end
		end
	end
	return hits
end

local function whileComplex(items)
	local i = 1
	local out = {}
	while i <= #items do
		local item = items[i]
		i += 1
		if type(item) == "string" then
			if #item == 0 then
				continue
			end
			out[#out + 1] = item:upper()
		elseif type(item) == "number" then
			if item < 0 then
				break
			end
			out[#out + 1] = tostring(item * 2)
		else
			out[#out + 1] = "?"
		end
	end
	return table.concat(out, ",")
end

local function andOr(a, b, c)
	local x = a and b or c
	local y = a or b and c
	local z = (a or b) and (b or c)
	local w = not a and not b
	return x, y, z, w
end

local function countdown(n)
	local parts = {}
	for i = n, 1, -2 do
		parts[#parts + 1] = i
	end
	return table.concat(parts, " ")
end

local function whileTrue(limit)
	local a, b = 0, 1
	while true do
		a, b = b, a + b
		if b > limit then
			return a
		end
	end
end

for _, n in ipairs({ -5, 0, 7, 42, 1000 }) do
	print(classify(n))
end
print(collatz(27), collatz(1), collatz(6))
print(findFirst({ 3, 8, 12, 5 }, function(v)
	return v > 9
end))
print(findFirst({ 1, 2 }, function(v)
	return v > 9
end))
print(sumEvenSkipBig({ 2, 3, 4, 7, 10, 200, 6 }, 50))
print(repeatDemo(1000))
print(repeatDemo(1))
print(table.concat(nested({ { 1, 0, 3 }, { 4, 5, -1, 9 }, { 0, 0, 7 } }), ","))
print(whileComplex({ "a", "", 3, true, "bc", -1, "never" }))
print(andOr(true, false, "c"))
print(andOr(nil, 5, "c"))
print(andOr(false, nil, nil))
print(countdown(9))
print(whileTrue(100))
