local events = {}
local object = { offset = 10 }
function object:factory(base)
    table.insert(events, "factory")
    return function(value, ...)
        table.insert(events, "apply")
        return self.offset + base + value, select("#", ...), ...
    end
end
print(object:factory(3)(4, 5, nil))
print(table.concat(events, ","))
