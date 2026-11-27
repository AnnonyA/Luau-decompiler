local calls = 0
local function values()
    calls += 1
    return 7, nil, 19
end
local a, b, c = values()
a, c = c, a
local function forward(...)
    print("arity", select("#", ...))
    return ...
end
print("fixed", a, b, c, calls)
print("open", forward(values()))
print("calls", calls)
