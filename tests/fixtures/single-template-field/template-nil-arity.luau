local trace = {}
local function many(value)
    table.insert(trace, "many:" .. value)
    return value, "extra", nil
end
local function none()
    table.insert(trace, "none")
end
local function build(value)
    local record = { value = if value then many(7) else none() }
    local alias = record
    print(record == alias, select("#", record.value), record.value)
    return record
end
local first, second = build(true), build(false)
print(table.concat(trace, "|"), first.value, second.value, first == second)
second.value = 2
second.other = 3
local key, value = next(second)
print(key, value, next(second, key))
local function vararg(...)
    return { value = ... }
end
local a, b = vararg(), vararg(nil, 8, 9)
print(a.value, b.value, select("#", a.value, b.value), a == b)
