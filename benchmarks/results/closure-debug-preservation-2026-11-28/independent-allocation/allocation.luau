-- Independent review: a repeated cached closure does not allocate a record.
local function make()
    local function tag() return "value" end
    return tag
end

local before = gcinfo()
for index = 1, 200 do
    local first = make()
    local between = gcinfo()
    local second = make()
    assert(first == second)
end
local after = gcinfo()
print("allocation", after - before)
