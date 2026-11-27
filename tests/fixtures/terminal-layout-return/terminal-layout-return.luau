local events, readers = {}, {}
local function route(items)
    for _, item in items do
        local captured = item
        if item == 3 then
            table.insert(readers, function() return captured end)
            table.insert(events, "three")
            return
        elseif item == 7 then
            table.insert(readers, function() return captured end)
            table.insert(events, "seven")
            return
        end
        table.insert(events, "step")
    end
    table.insert(events, "exhausted")
end
local runners = {route}
runners[1]({1, 3, 7})
runners[1]({7})
runners[1]({1, 2})
print(table.concat(events, ","), readers[1](), readers[2](), #readers)
print(select("#", runners[1]({})))
