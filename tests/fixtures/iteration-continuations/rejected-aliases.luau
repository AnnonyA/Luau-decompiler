-- Project-authored: saved values and existing REF cells across branch writes.
local function run(limit)
    local cursor = 0
    local cell = 4
    local reader = function() return cell end
    local values = {}
    while true do
        cursor += 1
        local saved = cell
        if cursor % 2 == 0 or cursor > limit then
            if cursor > limit then
                return values, reader, saved
            end
            cell = cursor * 7
        elseif cursor % 3 == 0 then
            cell = cursor * 11
        end
        table.insert(values, saved)
        table.insert(values, reader())
        cell += 2
    end
end
for _, limit in {0, 1, 4, 7} do
    local values, reader, saved = run(limit)
    print("aliases", limit, table.concat(values, ","), reader(), saved)
end
