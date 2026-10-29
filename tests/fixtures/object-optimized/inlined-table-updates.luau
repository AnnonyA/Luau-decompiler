local function record(state, value)
    if value < 0 then
        state.low = value * 3 - 1
        state.tag = -1
        return
    end
    state.high = value * 7 + 2
    state.tag = 1
end
local first = ...
local limit = tonumber(first) or 3
local state = { low = 0, high = 0, tag = 0 }
for index = -3, limit do
    print("before", index, state.tag)
    record(state, index)
    print("after", index, state.low, state.high, state.tag)
end
print("final", state.low, state.high, state.tag)
