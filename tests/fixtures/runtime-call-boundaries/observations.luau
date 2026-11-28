-- Project-authored observations for source-level call presentation.
local log = {}
local function note(label, value)
    table.insert(log, label)
    return value
end
local function collect(label, ...)
    local values = table.pack(...)
    print(label, values.n, values[1], values[2], values[3], values[4])
end
local function observe(value, expected)
    local caller = debug.info(2, "f")
    local environment = getfenv(2)
    return value, nil, caller == expected, type(environment)
end
local function apply(callable, value)
    return (true and callable)(value, apply)
end
local function applyVariadic(callable, ...)
    return (true and callable)(..., applyVariadic)
end
local function factory(callable)
    return function(value, expected)
        return (true and callable)(value, expected)
    end
end
local builtin = math.abs
collect("fixed-builtin", (true and apply)(math.abs, -7))
collect("fixed-alias", (true and apply)(builtin, -8))
collect("fixed-literal", (true and apply)(function(value) return value + 3 end, 9))
collect("fixed-observer", (true and apply)(observe, 11))
collect("variadic-observer", (true and applyVariadic)(observe, 13))
local first = (true and factory)(observe)
local second = (true and factory)(observe)
print("factory-identity", first == second)
collect("factory-observer", first(17, first))
local target = observe
target = note("replace", target)
collect("written-target", target(note("arg", 19), nil))
local function makeRecord()
    return setmetatable({}, {
        __index = function(_, key)
            note("lookup:" .. key)
            return observe
        end,
    })
end
local record = (true and makeRecord)()
collect("runtime-field", record.fire(note("field-arg", 23), nil))
local keys = {"computed"}
collect("computed-field", record[keys[1]](note("index-arg", 29), nil))
local function choose()
    note("callee")
    return observe
end
collect("returned-target", choose()(note("returned-arg", 31), nil))
local callbacks = {observe}
collect("array-target", callbacks[1](note("array-arg", 37), nil))
local callable = setmetatable({}, {
    __call = function(_, value, ...)
        note("metacall")
        return value, select("#", ...), ...
    end,
})
local indirect = callable
indirect = note("callable-replace", indirect)
collect("callable-table", indirect(note("meta-arg", 41), nil, 43))
local function rejected(value)
    local ok, message = pcall(function() return value() end)
    return ok, type(message), string.find(tostring(message), "call", 1, true) ~= nil
end
collect("nil-call", rejected(nil))
collect("false-call", rejected(false))
print("effects", table.concat(log, "/"))
