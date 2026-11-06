local first = ...
local rounds = tonumber(first) or 3
local operation = math.abs
local functions = {}
for i = 1, rounds do
    local invoke = operation
    functions[i] = function(x, ...)
        return invoke(x), ...
    end
end
for i = 2, rounds do
    print("identity", i, functions[i - 1] == functions[i])
    print("values", functions[i](-i, nil, "end"))
end

print("rounds", rounds, #functions)
