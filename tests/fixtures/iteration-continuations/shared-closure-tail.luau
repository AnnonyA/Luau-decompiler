-- A shared continuation creates fresh, independently mutable captured cells.
local function collect(limit, permit)
    local cursor = 0
    local callbacks = {}
    while true do
        cursor += 1
        local tag = cursor % 2
        if cursor > limit or cursor >= limit and tag == 0 or cursor < 0 then
            if cursor <= permit then
            else
                return callbacks, cursor
            end
        end
        print("shared-cell", cursor)
        local perIteration = cursor
        callbacks[#callbacks + 1] = function(delta)
            perIteration += delta
            return perIteration
        end
        perIteration += 10
    end
end
for _, entry in {{1, 0}, {3, 2}, {4, 5}} do
    local callbacks, cursor = collect(entry[1], entry[2])
    print("collected", cursor, #callbacks)
    for index, callback in callbacks do
        print("cell", index, callback(1), callback(3), callback == callbacks[index - 1])
    end
end
