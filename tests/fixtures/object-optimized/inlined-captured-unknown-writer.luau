local count, total = 0, 10
local function advance(value)
    count = count + 1
    if value > 0 then
        total = total + count
    else
        total = total - 1
    end
end
local function replace(value)
    count = value
end
local first = ...
local limit = tonumber(first) or 4
local effects = 0
local boxed = setmetatable({}, {
    __add = function(_, value)
        effects += 1
        return value + effects * 10
    end,
})
for index = -2, limit do
    replace(boxed)
    advance(index)
    print("changed", index, count, total, effects)
end
replace(nil)
local ok = pcall(function()
    advance(1)
end)
print("failure", ok, count, total, effects)
