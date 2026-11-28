-- Independent review of linear loop exits with existing REF cells.
local function exercise(mode)
    local trace = {}
    local count = 0
    local observed = function() return count end
    local saved = {}
    local selected = -1
    local function mark(name, value)
        table.insert(trace, name .. ":" .. value .. ":" .. observed())
        return value, nil, "ignored"
    end
    repeat
        count += 1
        local cell = count
        local snapshot = function() return cell, count end
        if mode == 1 and count == 2 then
            cell += 100
            count += 10
            selected = count
            saved[#saved + 1] = snapshot
            mark("first", count)
            break
        end
        if mode == 2 and count == 3 then
            cell += 200
            count += 20
            selected = count
            saved[#saved + 1] = snapshot
            mark("second", count)
            break
        end
        saved[#saved + 1] = snapshot
        cell += 1
    until mark("until", count) == 4
    count += 1000
    return selected, observed(), saved, table.concat(trace, ",")
end

for mode = 1, 3 do
    local selected, observed, saved, trace = exercise(mode)
    print("repeat", mode, selected, observed, trace)
    for index, callback in saved do
        print("saved", index, callback())
    end
end

-- Both conditions route to the same source exit body and exported phi.
local function shared(mode)
    local trace = {}
    local state = 0
    local observe = function() return state end
    local selected
    for index = 1, 6 do
        if (mode == 1 and index == 2) or (mode == 2 and index == 4) then
            state = index * 10
            selected = function() return state, index end
            table.insert(trace, observe())
            break
        end
        state += 1
        table.insert(trace, observe())
    end
    local before = observe()
    state += 100
    if selected then
        print("shared", mode, before, observe(), selected())
    else
        print("shared", mode, before, observe(), "none")
    end
    print(table.concat(trace, ","))
end
shared(1)
shared(2)
shared(3)
