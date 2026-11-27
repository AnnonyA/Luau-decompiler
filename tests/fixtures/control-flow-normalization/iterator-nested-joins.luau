local function evaluate(values)
    local total = 0
    local checkpoints = {}
    for _, value in values do
        local pass = 0
        while pass < 2 do
            pass += 1
            if value < 0 then total += 1 else total += 2 end
            if value % 2 == 0 then total += 3 else total += 4 end
            if value > 5 then total += 5 else total += 6 end
            if value == 3 then total += 7 else total += 8 end
            if value <= 2 then total += 9 else total += 10 end
            if value ~= 1 then total += 11 else total += 12 end
            local snapshot = total
            table.insert(checkpoints, function(delta)
                snapshot += delta
                return snapshot, value
            end)
        end
    end
    return total, checkpoints
end

local total, checkpoints = evaluate({-1, 2, 7})
print(total, #checkpoints)
print(checkpoints[1](1))
print(checkpoints[2](0))
print(checkpoints[1](1))
print(checkpoints[3](-1))
local empty, noCheckpoints = evaluate({})
print(empty, #noCheckpoints)
