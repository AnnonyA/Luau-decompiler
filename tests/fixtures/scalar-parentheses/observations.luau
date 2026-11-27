local trace = {}
local function values(tag, ...)
    trace[#trace + 1] = tag
    return ...
end
local function empty(tag)
    trace[#trace + 1] = tag
end
local function record(label, ...)
    local count = select("#", ...)
    local items = {}
    for index = 1, count do
        items[index] = tostring(select(index, ...))
    end
    print(label, count, table.concat(items, ":"))
end

local one = (values("one", 11, nil, 13))
local left, right = (values("left", 21, nil, 23)), (values("right", 31, nil, 33))
local filled, missing, absent = (values("padded", 41, 42, 43))
record("locals", one, left, right, filled, missing, absent)
left, right = (values("assign-first", 51, 52)), (values("assign-last", 61, 62))
filled, missing, absent = (values("assign-padded", 71, 72, 73))
record("assign", left, right, filled, missing, absent)
record("arg-prefix", (values("arg-first", 81, nil, 83)), "tail")
record("arg-tail", "head", (values("arg-last", 91, nil, 93)))
record("arg-open", "head", values("arg-open", 101, nil, 103))
record("empty-tail", (empty("empty-tail")))
record("empty-open", empty("empty-open"))

local object = {}
function object:read(tag)
    trace[#trace + 1] = tag
    return self, nil, "extra"
end
local receiver = (object:read("method-single"))
record("method-prefix", (object:read("method-prefix")) == object, receiver == object)
record("method-tail-count", select("#", (object:read("method-tail"))))

local map = {
    (values("array-first", "alpha", "extra")),
    keyed = (values("field-value", "beta", "extra")),
    [(values("field-key", "dynamic", "extra"))] = (values("dynamic-value", "gamma", "extra")),
    (values("array-last", "delta", "extra")),
}
record("table", #map, map[1], map[2], map[3], map.keyed, map.dynamic)
record("index", map[(values("lookup", "dynamic", "extra"))])
local spread = {(values("list-prefix", 1, 2)), values("list-open", 3, nil, 5)}
record("spread", spread[1], spread[2], spread[3], spread[4], spread[5])

local function returns(flag)
    return (values("return-prefix", 201, nil, 203)), (values(if flag then "return-yes" else "return-no", 211, nil, 213))
end
record("returns-true", returns(true))
record("returns-false", returns(false))
local function conditional(flag)
    return if flag then (values("conditional-yes", 221, nil, 223)) else (empty("conditional-no"))
end
record("conditional-true", conditional(true))
record("conditional-false", conditional(false))

local function variadic(...)
    local first = (...)
    local padded, nil1, nil2 = (...)
    local array = {(...), "tail"}
    local tail = {(...)}
    record("vararg-locals", first, padded, nil1, nil2, array[1], array[2], tail[1], tail[2])
    record("vararg-prefix", (...), "tail")
    record("vararg-tail", "head", (...))
    return (...), (...)
end
record("vararg-return", variadic(231, nil, 233))
record("vararg-empty", variadic())

local total = 0
for index = (values("start", 1, 9)), (values("stop", 2, 9)), (values("step", 1, 9)) do
    total += (values("increment", index, 9))
end
if (values("if-test", true, false)) then
    total += -(values("negative", -4, 9)) + (values("binary", 5, 9))
end
local attempts = 0
while (values("while-test", attempts < 1, false)) do
    attempts += 1
end
repeat
    attempts += 1
until (values("until-test", attempts >= 3, false))
record("bounds", total, attempts, `{(values("interpolation", "word", "extra"))}`)

local function iterator()
    local index = 0
    return function(state)
        if state ~= nil then error("grouped iterator leaked its extra state") end
        index += 1
        if index <= 2 then return index, index * 10 end
    end, "ignored-state", "ignored-control"
end
for index, value in (iterator()) do
    record("iteration", index, value)
end

local function create(value)
    local cell = {value = value}
    return function(delta)
        cell.value += delta
        return cell
    end, "ignored-function-tail"
end
local callback = (create(7))
local alias = callback
local initial = callback(0)
local changed = alias(2)
local named = {run = function() return 1 end}
local anonymous = {["run"] = function() return 2 end}
record("closures", callback == alias, initial == changed, initial.value,
    debug.info(callback, "n"), debug.info(named.run, "n"), debug.info(anonymous.run, "n"))
print("trace", table.concat(trace, ","))
