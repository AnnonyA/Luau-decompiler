local trace = {}
local function note(value)
    trace[#trace + 1] = value
end

local function unrelated(kind)
    return kind .. ":unrelated"
end

local function record(label, contents)
    return setmetatable({}, {
        __index = function(_, key)
            note(label .. ":" .. key)
            return contents[key]
        end,
    })
end

local function matches(schema, value)
    if schema.kind == value.kind then
        return "equal"
    end
    return "different"
end

local function conditional(schema, value, enabled)
    local kind = schema.kind
    return enabled and kind == value.kind
end

local function captured(schema)
    local kind = schema.kind
    local function read()
        return kind
    end
    kind = kind .. ":updated"
    return read
end

local first = record("first", {kind = "item"})
local second = record("second", {kind = "item"})
local third = record("third", {kind = "other"})
print(matches(first, second), matches(first, third), unrelated("field"))
print(conditional(first, second, false), conditional(first, second, true))
local reader = captured(third)
print(reader())
print(table.concat(trace, "|"))
