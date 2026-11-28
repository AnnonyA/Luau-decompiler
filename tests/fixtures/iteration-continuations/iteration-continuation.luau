-- Project-authored loop continuation and early-return observations.
local function run(border, permit, values)
    local cursor = 0
    local total = 0
    local seen = {}
    local observe = function() return cursor, total, seen end
    while true do
        cursor += 1
        local value = values[cursor] or -1
        local tag = if cursor % 2 == 0 then "even" else "odd"
        if value == 0 or value <= border and tag ~= "even" or value < border then
            if cursor <= permit then
            else
                local a, b, identity = observe()
                return total, cursor, table.concat(seen, "/"), a, b, identity == seen
            end
        end
        table.insert(seen, tostring(cursor))
        local increment = tag == "even" and value - 1 or value
        if increment > 0 then
            total += increment
        elseif increment < 0 then
            total -= increment
        else
            total += 10
        end
    end
end
for _, entry in {{2, 2, {7, 1, 0}}, {0, 4, {1, 3, 2, 7}}, {4, 0, {2}}, {3, 3, {9, 8, 7}}} do
    print("iteration", run(entry[1], entry[2], entry[3]))
end
