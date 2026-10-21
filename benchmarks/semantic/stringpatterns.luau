local function parse(value)
    local name, count = string.match(value, "^(%a+):(%d+)$")
    return tostring(name), tostring(count)
end
print(parse("item:12"))
print(parse("bad value"))
local result, count = string.gsub("a1 b2 c3", "%d", "#")
print(result, count)
