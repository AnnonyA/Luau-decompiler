local first = ...
local limit = tonumber(first) or 4
local state = {}
for bias = -2, 2 do
    local function classify(value, target)
        target[1] = value * 2 + bias
        if value < -1 then
            target.kind = -1
            target.output = value * 3 + bias
            return
        elseif value > 2 then
            target.kind = 1
            target.output = value * 7 - bias
            return
        end
        target.kind = 0
        target.output = value * value + bias
    end
    for index = -3, limit do
        classify(index, state)
        print(bias, index, state[1], state.kind, state.output)
    end
end
print("complete", state[1], state.kind, state.output)
