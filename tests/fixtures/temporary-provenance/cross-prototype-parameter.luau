local trace = {}
local function unrelated(kind)
    return kind .. ":tag"
end

local function record(label, contents)
    return setmetatable({}, {
        __index = function(_, key)
            trace[#trace + 1] = label .. ":" .. key
            return contents[key]
        end,
    })
end

local function matches(schema, value)
    if schema.kind == value.kind then
        return unrelated("equal")
    end
    return unrelated("different")
end

local left = record("left", {kind = "item"})
local right = record("right", {kind = "item"})
local other = record("other", {kind = "different"})
print(matches(left, right), matches(left, other))
print(table.concat(trace, "|"))
