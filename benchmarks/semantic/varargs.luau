-- Project-owned deterministic check for GETVARARGS and open CALL/RETURN packs.
local function pass(...)
    return select("#", ...), ...
end
local function values()
    return 9, nil, 27
end
local function collect(...)
    return ...
end
local count, first, middle, last = pass(values())
print("varargs", count, tostring(first), tostring(middle), tostring(last))
print("forward", collect("alpha", "beta", "gamma"))
