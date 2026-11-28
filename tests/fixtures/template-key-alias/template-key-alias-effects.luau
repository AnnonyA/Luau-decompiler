local trace = {}
local function observe(label, value)
    table.insert(trace, label)
    return value, "extra"
end
local record = { ready = 41 }
local repeated = { ready = observe("first", 2), ["ready"] = observe("second", 3) }
local function dynamic(key)
    return { ready = observe("named", 7), [key] = observe("dynamic", 11) }
end
local same, different = dynamic("ready"), dynamic("other")
print(table.concat(trace, "|"), record.ready, repeated.ready, same.ready, different.ready, different.other)
local function keys(value)
    local list = {}
    for key in value do
        table.insert(list, key)
    end
    return table.concat(list, ",")
end
print(keys(record), #record)
record.alpha = 1
record.beta = 2
record.gamma = 3
record.ready = nil
record.delta = 4
record.ready = false
print(keys(record), #record, record.ready)
record.beta = nil
record.epsilon = 5
print(keys(record), record.alpha, record.gamma, record.delta, record.epsilon)
local callbacks = { ready = function() return 1 end, ["ready"] = function() return 2 end }
print(debug.info(callbacks.ready, "n"), callbacks.ready())
local first = { ready = observe("single", false) }
local alias = first
alias.ready = 19
print(first == alias, first.ready, table.concat(trace, "|"))
