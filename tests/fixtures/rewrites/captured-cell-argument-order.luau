local count = 10
local function take()
    local old = count
    count += 1
    return old
end

local function observe(before, result, after)
    print(before, result, after)
end

for i = 1, 3 do
    observe(count, take(), count)
    count, take = count + 1, take
end
