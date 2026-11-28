-- Captures, reassignment and nested iteration must keep their original cells.
local function exercise(permit)
    local current = 0
    local saved = {}
    local callbacks = {}
    local value = 1
    while true do
        current += 1
        local condition = current % 2 == 0
        if condition or current > 3 then
            if current > permit then
                return value, saved, callbacks
            end
            local branchValue = current
            saved[#saved + 1] = function() return branchValue end
            value = current * 10
        end
        for index = 1, 2 do
            local localValue = current + index
            callbacks[#callbacks + 1] = function(delta)
                localValue += delta
                return localValue, value
            end
        end
        value += 1
    end
end
for _, permit in {0, 2, 4} do
    local value, saved, callbacks = exercise(permit)
    local items = {}
    for _, fn in saved do table.insert(items, fn()) end
    print("cells", permit, value, table.concat(items, ","), #callbacks)
    for _, fn in callbacks do print("capture", fn(1), fn(2)) end
end
