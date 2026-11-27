-- [[ annonya.github.io ]] v0.2.0 | decompiled at 2026-11-27T21:20:50Z
-- Luau bytecode version: 14 | Luau type version: 3

local list = {}

local function note(value)
    list[#list + 1] = value
end

local function unrelated(kind)
    return kind .. ":unrelated"
end

local function record(label: string, contents)
    local data = {}
    data.__index = function(_, key)
        local value = label .. ":" .. key
        list[#list + 1] = value
        return contents[key]
    end

    return (setmetatable({}, data))
end

local function matches(schema, value): string
    local kind = schema.kind
    return if kind == value.kind then "equal" else "different"
end

local function conditional(schema, value, enabled)
    local kind = schema.kind
    return enabled and kind == value.kind
end

local function captured(schema)
    local kind = schema.kind
    local read
    function read()
        return kind
    end

    kind ..= ":updated"
    return read
end

local schema = (if true then record else nil)("first", { kind = "item" })
local value = (if true then record else nil)("second", { kind = "item" })
local data = { kind = "other" }
local third = (if true then record else nil)("third", data)
local print2 = print
data = if schema.kind == value.kind then "equal" else "different"
print2(data, if schema.kind == third.kind then "equal" else "different", "field:unrelated")
print(false, schema.kind == value.kind)
local kind2 = third.kind
local read
function read()
    return kind2
end

kind2 ..= ":updated"
print(read())
print(table.concat(list, "|"))
