local seed = tonumber(...) or 1
local edges = {{2, 3}, {3, 4}, {1, 4}, {}}
local seen, order = {}, {}
local function visit(node, depth)
    if seen[node] or depth > seed + 3 then return 0 end
    seen[node] = true
    order[#order + 1] = node
    local count = 1
    for _, nextNode in ipairs(edges[node]) do count += visit(nextNode, depth + 1) end
    return count
end
local reached = visit(1, 0)
print("graph", reached, table.concat(order, ","))
for i = 1, #edges do print("seen", i, seen[i] == true) end
