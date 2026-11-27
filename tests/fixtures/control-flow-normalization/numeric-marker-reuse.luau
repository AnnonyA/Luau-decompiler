local function makeSnapshot()
    local saved
    for index = 1, 3 do
        local cell = index
        saved = function(delta)
            cell += delta
            return cell, index, nil
        end
        break
    end
    if false then
        for index = 1, 3 do
            local cell = index * 100
            saved = function(delta)
                cell += delta
                return cell, index, nil
            end
        end
    end
    return saved
end

local first = makeSnapshot()
local second = makeSnapshot()
print(first(2))
print(second(0))
print(first(1))
