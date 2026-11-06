local count, checksum = 0, 1
local function record(state, value)
    count += 1
    checksum = checksum * 3 + count
    state.score = value * 7 + count
    if value < 0 then
        state.tag = -1
        return
    end
    state.tag = checksum
end
local first = ...
local limit = tonumber(first) or 4
local state = {}
for index = -2, limit do
    record(state, index)
    print("record", index, count, checksum, state.score, state.tag)
end
local function observe()
    return count, checksum
end
print("final", observe())
