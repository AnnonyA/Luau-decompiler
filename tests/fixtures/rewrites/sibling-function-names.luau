-- Project-authored development regression: sibling factories own their names.
local argument = ...
local seed = tonumber(argument) or 0

local function buildLeft(value)
    local count = 0
    local function decode(delta)
        count += 1
        return value + delta, count, "left"
    end
    return decode
end

local function buildRight(value)
    local count = 0
    local function decode(delta)
        count += 1
        return value - delta, count, "right"
    end
    return decode
end

-- Indirect calls keep the factories present even under O2 inlining.
local factories = {buildLeft, buildRight}
local callbacks = {}
for index, factory in ipairs(factories) do
    callbacks[index] = factory(seed + index * 10)
end

local left, right = callbacks[1], callbacks[2]
local alias = left
print("names", debug.info(left, "n"), debug.info(right, "n"))
print("identity", left == right, alias == left, alias == right)
print("left-first", left(seed))
print("right-first", right(seed))
print("left-alias", alias(3))
print("right-second", right(-4))
print("left-third", left(0))
