local function empty()
    return
end

local function search(mode)
    local count = 0
    while count < 4 do
        count += 1
        if mode ~= "break" and count == 2 then
            local trace = {}
            local cursor = count
            while cursor > 0 do
                table.insert(trace, cursor)
                cursor -= 1
            end
            print("trace", table.concat(trace, ","))
            if mode == "empty" then
                return empty()
            end
            local snapshot = count
            return function()
                return snapshot
            end, count, nil
        end
        if count == 3 then
            break
        end
    end
    return nil, count
end

local function report(...)
    local result, count, trailing = ...
    print("result", select("#", ...), if result then result() else "none", count, trailing)
end

report(search("found"))
report(search("empty"))
report(search("break"))
