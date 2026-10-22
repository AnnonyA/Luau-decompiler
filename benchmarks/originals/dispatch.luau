local seed = tonumber(...) or 1
local tasks = {seed, -2, 0, 4, -1, 3}
local total, accepted, cursor = 0, 0, 1
while cursor <= #tasks do
    local value = tasks[cursor]
    cursor += 1
    if value == 0 then continue end
    if value < 0 then
        if total > 0 then total += value else total -= value end
    else
        for j = 1, value do
            if j % 3 == 0 then continue end
            total += j
            if total > 40 then break end
        end
        accepted += 1
    end
    if accepted >= 3 then break end
end
repeat
    total -= 2
    accepted -= 1
until accepted <= 0 or total < 0
print("dispatch", seed, total, accepted, cursor)
