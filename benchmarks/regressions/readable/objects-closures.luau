local Stack = {}
Stack.__index = Stack

function Stack.new()
	local self = setmetatable({}, Stack)
	self.items = {}
	self.size = 0
	return self
end

function Stack:push(value)
	self.size += 1
	self.items[self.size] = value
	return self
end

function Stack:pop()
	if self.size == 0 then
		return nil, "empty"
	end
	local value = self.items[self.size]
	self.items[self.size] = nil
	self.size -= 1
	return value
end

function Stack:peek()
	return self.items[self.size]
end

local Queue = setmetatable({}, { __index = Stack })
Queue.__index = Queue

function Queue.new(capacity)
	local self = Stack.new()
	self.capacity = capacity or 4
	self.dropped = 0
	return setmetatable(self, Queue)
end

function Queue:push(value)
	if self.size >= self.capacity then
		self.dropped += 1
		return self
	end
	return Stack.push(self, value)
end

local function makeCounter(step)
	local count = 0
	local history = {}
	local function increment()
		count += step
		history[#history + 1] = count
		return count
	end
	local function reset()
		local previous = count
		count = 0
		table.clear(history)
		return previous
	end
	return {
		increment = increment,
		reset = reset,
		total = function()
			local sum = 0
			for _, v in history do
				sum += v
			end
			return sum
		end,
	}
end

local function memoize(fn)
	local cache = {}
	return function(n)
		local hit = cache[n]
		if hit ~= nil then
			return hit
		end
		local result = fn(n)
		cache[n] = result
		return result
	end
end

local fib
fib = memoize(function(n)
	if n < 2 then
		return n
	end
	return fib(n - 1) + fib(n - 2)
end)

local function varargStats(...)
	local n = select("#", ...)
	local args = { ... }
	local min, max = math.huge, -math.huge
	for i = 1, n do
		local v = args[i]
		if v < min then
			min = v
		end
		if v > max then
			max = v
		end
	end
	return n, min, max
end

local function safeDivide(a, b)
	local ok, result = pcall(function()
		if b == 0 then
			error("division by zero")
		end
		return a / b
	end)
	if not ok then
		return nil, tostring(result):match("division by zero") or "unknown"
	end
	return result
end

local function formatRecord(record)
	local parts = {}
	for key, value in pairs(record) do
		parts[#parts + 1] = string.format("%s=%s", tostring(key), tostring(value))
	end
	table.sort(parts)
	return "{" .. table.concat(parts, ", ") .. "}"
end

local s = Stack.new()
s:push(1):push(2):push(3)
print(s:pop(), s:peek(), s.size)
local q = Queue.new(2)
q:push("a"):push("b"):push("c")
print(q.size, q.dropped, q:pop(), q:pop(), q:pop())

local counter = makeCounter(3)
counter.increment()
counter.increment()
print(counter.increment(), counter.total(), counter.reset(), counter.total())
print(fib(30))
print(varargStats(4, -2, 9, 7))
print(safeDivide(10, 4))
print(safeDivide(1, 0))
print(formatRecord({ name = "x", level = 3, active = true }))

local config = {
	name = "Test",
	limits = { min = 1, max = 10 },
	tags = { "a", "b", "c" },
	enabled = true,
}
config.limits.max *= 2
config.tags[#config.tags + 1] = "d"
print(config.name, config.limits.min, config.limits.max, #config.tags, config.enabled)

local text = "Hello, World"
local words = {}
for word in text:gmatch("%a+") do
	words[#words + 1] = word:lower()
end
print(#words, words[1] .. "-" .. words[2], text:sub(1, 5):rep(2, "|"))
local a, b, c = 1, 2
a, b = b, a
print(a, b, c)
