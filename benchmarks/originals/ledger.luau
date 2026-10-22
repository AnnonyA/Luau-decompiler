local seed = tonumber(...) or 1
local function account(start)
    local balance, revision = start, 0
    local history = {}
    local function change(delta)
        if balance + delta < 0 then return false, balance end
        balance += delta
        revision += 1
        history[revision] = balance
        return true, balance
    end
    local function snapshot()
        local saved = balance
        return function() return saved, balance, revision end
    end
    return change, snapshot, history
end
local change, snapshot, history = account(seed + 5)
local before = snapshot()
for i = 1, 5 do
    local delta = if i % 2 == 0 then -i * 3 else i + seed
    print("change", i, change(delta))
end
local after = snapshot()
print("before", before())
print("after", after())
for i, amount in ipairs(history) do print("history", i, amount) end
