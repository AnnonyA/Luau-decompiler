-- Project-authored: option interactions with closures, bytes and multireturns.
local input = ...
local count = tonumber(input) or 4
local trace = {}
local function mark(value)
    trace[#trace + 1] = tostring(value)
    return value, nil, value + 1
end
local function make(start)
    local value = start
    return function(delta)
        value += delta
        return value, value + 1
    end, function() return value end
end
local add, read = make(count)
local a, empty, c = mark(count)
print(a, empty, c, add(2), read())
local module = {
    version = 3,
    format = function(value) return "á😀:{`}" .. tostring(value) end,
    bytes = function() return "\000\255\195\169" end,
}
local text = module.format(count)
print(text, #module.bytes(), string.byte(module.bytes(), 1, 4))
local total = 0
for i = 1, count do
    if i % 2 ~= 0 then
        total += i
        mark(i)
    end
end
local function choose(value)
    if value < 0 then return "negative" end
    if value == 0 then return "zero" end
    return "positive"
end
local function unused(value) return value + 100 end
print(total, choose(count), table.concat(trace, ","))
return module, add, read
