-- Project-authored: a short-circuit latch observes a local captured this turn.
local trace = {}
local function finish(value, ...)
    trace[#trace + 1] = "test:" .. tostring(value) .. ":" .. select("#", ...)
    return value == 3, nil, "extra"
end
local function scan(values, ...)
    local turns = 0
    local saved = {}
    repeat
        turns += 1
        local value = values[turns]
        local token = {value = value, turn = turns}
        saved[#saved + 1] = function()
            return token, value
        end
        trace[#trace + 1] = "body:" .. turns
    until value == nil or value < 0 or finish(value, ...)
    for i, read in saved do
        local first, value = read()
        local again = read()
        print("capture", i, first == again, first.turn, value)
    end
    return turns, nil, select("#", ...)
end
print("scan", scan({1, 2, 3, 4}, false, nil, 9))
print("negative", scan({-2}, nil))
print("empty", scan({}))
print(table.concat(trace, ","))

-- Entry guards must re-evaluate their effects after a continue.
local attempts = 0
local function ready()
    attempts += 1
    return attempts < 5, "discarded"
end
local visited = {}
while true do
    if not ready() then break end
    if attempts == 3 then break end
    visited[#visited + 1] = attempts
    if attempts == 1 then continue end
    visited[#visited + 1] = -attempts
end
print("head", attempts, table.concat(visited, ","))

-- A continue that skips the latch must continue to skip that call.
local turn, tests = 0, 0
while true do
    turn += 1
    if turn < 3 then continue end
    tests += 1
    if turn >= 4 then break end
end
print("skipped", turn, tests)

local nan = 0 / 0
local rounds = 0
repeat
    rounds += 1
until not (nan < 1) or rounds == 2
print("nan", rounds)
