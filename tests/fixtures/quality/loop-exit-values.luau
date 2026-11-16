local attemptsLog = {}

local function flaky(limit)
	local calls = 0
	return function(key)
		calls += 1
		if calls < limit then
			error("busy " .. key)
		end
		return key .. ":" .. calls
	end
end

local function load(key, fetch)
	local attempts = 0
	local success, result
	repeat
		attempts += 1
		success, result = pcall(fetch, key)
		if not success then
			attemptsLog[#attemptsLog + 1] = attempts
		end
	until success or attempts >= 3
	if not success then
		return false, "gave up after " .. attempts
	end
	return true, result
end

local function firstLong(words, minimum)
	local index = 0
	local word, length
	while true do
		index += 1
		word = words[index]
		if word == nil then
			break
		end
		length = #word
		if length >= minimum then
			break
		end
	end
	return word, length, index
end

local function drain(queue)
	local taken = {}
	local last
	repeat
		local item = table.remove(queue, 1)
		last = item
		if item then
			taken[#taken + 1] = function()
				return item * 2
			end
		end
	until item == nil or #taken >= 3
	local sum = 0
	for _, get in ipairs(taken) do
		sum += get()
	end
	return sum, last, #queue
end

local function retryUntil(limit)
	local tries = 0
	local value
	repeat
		tries += 1
		local doubled = tries * 2
		value = doubled + 1
	until value > limit
	return value, tries
end

print(load("a", flaky(2)))
print(load("b", flaky(9)))
print(load("c", flaky(1)))
print(table.concat(attemptsLog, ","))
print(firstLong({ "a", "bb", "cccc", "dd" }, 3))
print(firstLong({ "a", "bb" }, 3))
print(drain({ 1, 2, 3, 4, 5 }))
print(drain({ 7 }))
print(retryUntil(8))
