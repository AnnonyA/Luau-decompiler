local count, total = 0, 10
local function advance(value)
    count += 1
    if value > 0 then
        total += count
    else
        total -= 1
    end
end
local function tick()
    count += 1
    total += count
end
local first = ...
local limit = tonumber(first) or 4
local snapshots = {}
for index = -2, limit do
    print("before", index, count, total)
    advance(index)
    local saved = total
    snapshots[#snapshots + 1] = function()
        return saved, total, count
    end
    tick()
    print("after", index, count, total)
end
for index, read in ipairs(snapshots) do
    print("snapshot", index, read())
end
