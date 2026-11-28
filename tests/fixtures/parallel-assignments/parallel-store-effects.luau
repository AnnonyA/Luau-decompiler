local trace = {}
local contents = { left = { tag = "L" }, right = { tag = "R" } }
local destination = setmetatable({}, {
    __index = function(_, key)
        table.insert(trace, "read:" .. key)
        return contents[key]
    end,
    __newindex = function(_, key, value)
        table.insert(trace, "write:" .. key .. ":" .. value.tag)
        contents[key] = value
    end,
})
local owner = setmetatable({}, {
    __index = function(_, key)
        table.insert(trace, "object:" .. key)
        return destination
    end,
})
local function swap(object, left, right)
    object.items[left], object.items[right] = object.items[right], object.items[left]
end
swap(owner, "left", "right")
print(table.concat(trace, "|"))
print(contents.left.tag, contents.right.tag, contents.left == contents.right)
table.clear(trace)
swap(owner, "left", "left")
print(table.concat(trace, "|"))
print(contents.left.tag, contents.right.tag, contents.left == contents.right)

local function key(name)
    table.insert(trace, "key:" .. name)
    return name
end
table.clear(trace)
owner.items[key("left")], owner.items[key("right")] = owner.items[key("right")], owner.items[key("left")]
print(table.concat(trace, "|"))
print(contents.left.tag, contents.right.tag)
