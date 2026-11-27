local turns = 0
local trace = {}
local state = {calls = 0}
local alias = state
local function ready(turn)
    table.insert(trace, "ready:" .. turn)
    return turn == 2
end
local function finish(turn)
    state.calls += 1
    table.insert(trace, "finish:" .. turn)
    return 0, nil, turn
end
repeat
    turns += 1
    for inner = 1, 2 do
        table.insert(trace, "body:" .. turns .. ":" .. inner)
    end
until turns >= 4 or (ready(turns) and finish(turns))
print(turns, alias == state, alias.calls, table.concat(trace, "|"))
print(select("#", finish(7)), state.calls)
return turns, nil, state.calls
