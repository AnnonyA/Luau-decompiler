-- [[ annonya.github.io ]] v0.2.0 | decompiled at 2026-11-27T18:18:56Z
-- Luau bytecode version: 14 | Luau type version: 3

local list = {}
local print2 = print
local data = { offset = 10 }

function data.factory(self, base)
    table.insert(list, "factory")
    return function(value, ...)
        table.insert(list, "apply")
        return self.offset + base + value, select("#", ...), ...
    end
end

local value2: number = 4
print2(data:factory(5, nil))
print(table.concat(list, ","))
