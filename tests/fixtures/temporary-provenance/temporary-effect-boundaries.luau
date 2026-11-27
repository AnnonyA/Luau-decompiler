local trace = {}
local function note(label)
    trace[#trace + 1] = label
    return label
end

local active = function(value)
    note("old:" .. value)
end

local function switch()
    note("switch")
    active = function(value)
        note("new:" .. value)
    end
    return "value", "extra"
end

local value = switch()
active(value)

local function receiver()
    note("receiver")
    return function(argument)
        note("call:" .. argument)
    end
end

local ready = note("ready")
receiver()(ready)

local function invalidKey(key)
    local effect = note("effect")
    return {[key] = 7, effect}
end
print((pcall(invalidKey, nil)))
print((pcall(invalidKey, "valid")))

local function conditional(enabled)
    local effect = note("before-condition")
    return enabled and effect
end
print(conditional(false), conditional(true))
print(table.concat(trace, "|"))
