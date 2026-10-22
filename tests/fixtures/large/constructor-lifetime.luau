local meta = {}
local function begin(owner, label)
    return setmetatable({store = owner, label = label, reads = {}, writes = {}, keys = {}, seen = {}, marks = {}, closed = false}, meta)
end
local value = begin({}, "test")
print(type(value.reads), type(value.marks), value.marks == meta, value.closed)
