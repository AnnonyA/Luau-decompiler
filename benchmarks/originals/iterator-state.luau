local seed = tonumber(...) or 1
local visits = 0
local function iterator(state, control)
    visits += 1
    local nextIndex = control + 1
    if nextIndex <= state.limit then return nextIndex, state.base + nextIndex * 2 end
end
local function make(limit)
    print("make", limit)
    return iterator, {limit = limit, base = seed}, 0
end
local sum = 0
for key, value in make(seed + 3) do
    if key % 2 == 0 then sum += value else sum -= value end
end
print("iterator", sum, visits)
