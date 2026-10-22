local seed = tonumber(...) or 1
local state = {value = seed, writes = 0}
local function attempt(delta)
    local old = state.value
    local ok, result = pcall(function()
        state.writes += 1
        state.value += delta
        if state.value < 0 then error("negative") end
        return state.value * 2
    end)
    if not ok then state.value = old end
    return ok, if ok then result else "rolled-back"
end
for _, delta in ipairs({2, -10, seed, 1}) do
    print("attempt", delta, attempt(delta))
    print("state", state.value, state.writes)
end
