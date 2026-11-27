local function evaluate(limit)
    local latest = false
    local snapshots = {}
    for index = 1, limit do
        latest = false
        local snapshot = latest
        snapshots[index] = function() return snapshot, index end
        latest = not latest
    end
    return latest, snapshots
end
local zero, empty = evaluate(0)
local latest, snapshots = evaluate(3)
print(zero, #empty, latest, #snapshots)
for _, snapshot in snapshots do print(snapshot()) end
