local function build(dependencies, compute)
    local node = {
        dependencies = dependencies or {}, dependents = {},
        compute = compute, dirty = compute ~= nil,
    }
    print(type(node.dependencies), type(node.dependents), node.dirty, #node.dependencies)
    return node
end
local empty = build(nil, nil)
local values = {10, 20}
local filled = build(values, function() return 3 end)
print(empty.dependencies ~= empty.dependents, filled.dependencies == values)
