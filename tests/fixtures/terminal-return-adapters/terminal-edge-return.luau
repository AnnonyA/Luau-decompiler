local events = {}
local function search(node, wanted)
    while node do
        if node.tag == wanted then
            table.insert(events, "found")
            return true, nil, node
        end
        node = node.parent
    end
    table.insert(events, "absent")
    return false, nil, nil
end
local function choose(items)
    for _, item in items do
        if item == 3 then
            table.insert(events, "three")
            local captured = item
            return item, nil, function() return captured end
        elseif item == 7 then
            table.insert(events, "seven")
            return item, nil, function() return item end
        end
        table.insert(events, "step")
    end
    table.insert(events, "exhausted")
    return 0, nil, nil
end
local root = {tag = "root"}
local leaf = {tag = "leaf", parent = root}
local runners = {search, choose}
local a, b, c = runners[1](leaf, "root")
print(a, b, c == root, select("#", runners[1](leaf, "missing")))
local value, gap, read = runners[2]({1, 3, 7})
print(value, gap, read and read(), select("#", runners[2]({7})))
print(runners[2]({1, 2}))
print(table.concat(events, ","))
