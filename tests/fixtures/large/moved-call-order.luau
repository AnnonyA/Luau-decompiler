local serial = 0
local Meta = {}
local function node(tag)
    serial += 1
    print('node', serial, tag)
    return setmetatable({id = serial, tag = tag}, Meta)
end
local function constant(value)
    return node(tostring(value))
end
function Meta.__mul(a, b)
    return node(a.tag .. '*' .. b.tag)
end
function Meta.__add(a, b)
    return node(a.tag .. '+' .. b.tag)
end
local function run(seed)
    local x = constant(seed)
    local y = constant(seed + 1)
    local z = constant(seed + 2)
    local result = x * y + z
    print('result', result.id)
end
run(2)
run(7)
