-- Project-authored: moving preloaded constants preserves the other evaluations.
local log = {}
local function first()
    log[#log + 1] = "first:" .. debug.info(2, "n")
    return "first-value", nil, "not-a-field"
end
local function second()
    log[#log + 1] = "second:" .. debug.info(2, "n")
    return false, nil, "not-a-field"
end
local function assemble(left, right)
    return {early = left(), marker = 7, late = right(), tag = "done"}
end
local function withClosure(value)
    return {
        __callback = function() return value end,
        count = 1,
        __other = function() return value + 1 end,
        tag = "closure",
    }
end
local routes = {assemble, withClosure}
local result = routes[1](first, second)
print("calls", table.concat(log, "|"), result.early, result.late,
    result.marker, result.tag, result[1] == nil)
local closure = routes[2](4)
print("closures", debug.info(closure.__callback, "n"), debug.info(closure.__other, "n"),
    closure.__callback(), closure.__other(), closure.__callback == closure.__other)

-- A key overwritten after construction and an extra key must not be sorted
-- as if they were just the immutable template values.
local function extended(value)
    local record = {first = value, count = 1}
    record.extra = value
    record.count = 2
    return record
end
local source = {extended}
local object = {}
local extra = source[1](object)
print("extra", extra.first == object, extra.extra == object, extra.count)

