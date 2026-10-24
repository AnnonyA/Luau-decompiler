local function copy(input)
    local output = {}
    for key, value in pairs(input) do output[key] = value end
    return output
end
local function transaction(state, callback)
    local before = {values = copy(state.values), version = state.version, count = #state.events}
    state.version += 1
    local ok = pcall(callback, state)
    if not ok then
        state.values = before.values
        state.version = before.version
        while #state.events > before.count do table.remove(state.events) end
    end
    print(ok, state.values.amount, state.version, #state.events)
end
local state = {values = {amount = 7}, version = 1, events = {'start'}}
transaction(state, function(s)
    s.values.amount = 19
    table.insert(s.events, 'changed')
    error('cancel', 0)
end)
transaction(state, function(s)
    s.values.amount = 25
    table.insert(s.events, 'committed')
end)
