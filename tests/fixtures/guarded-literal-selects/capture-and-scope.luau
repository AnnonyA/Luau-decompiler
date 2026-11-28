-- Captured destinations retain the original assignment boundaries. A later
-- closure must still observe that its captured local is mutable/fresh.
local events = {}
local saved = {}
local function make(flag)
    local value = false
    if flag then value = 7 end
    local function read() return value end
    table.insert(saved, read)
    return read
end
local first = make(true)
local second = make(true)
local third = make(false)
print("identity", first == second, second == third, first(), second(), third())
local keyset = {[first] = "first", [second] = "second", [third] = "third"}
print("keys", keyset[first], keyset[second], keyset[third])
local function observed(flag)
    local value = false
    local function watch()
        table.insert(events, "watch:" .. tostring(value))
        value = "mutated"
        return flag
    end
    if watch() then value = nil end
    return value
end
print("observed", observed(false), observed(true))
local function shadow(flag)
    local value = "outer"
    do
        local value = false
        if flag then value = value or "inner" end
        table.insert(events, "inner:" .. tostring(value))
    end
    return value
end
print("scope", shadow(false), shadow(true))
local function initialize()
    table.insert(events, "initialize")
    return {tag = "initial"}
end
local function decide(flag)
    table.insert(events, "test:" .. tostring(flag))
    return flag
end
local function choose(flag)
    local value = initialize()
    if decide(flag) then value = "replacement" end
    return type(value)
end
print("default-effects", choose(false), choose(true))
local function closures(flag)
    local result = nil
    if flag then result = function() return "named" end end
    return result
end
local closure = closures(true)
print("creation", debug.info(closure, "n"), closure(), closures(false))
print("saved", saved[1](), saved[2](), saved[3]())
print(table.concat(events, ","))
