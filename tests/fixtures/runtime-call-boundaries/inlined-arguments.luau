-- No getfenv/setfenv here: fixed-arity helpers remain eligible for inlining.
local function apply(callable, value)
    return (true and callable)(value)
end
local function frame(value)
    return value, debug.info(2, "n")
end
local function factory(callable)
    return function(value)
        return (true and callable)(value)
    end
end
local alias = math.abs
print("builtin", apply(math.abs, -11), apply(alias, -13))
print("literal", apply(function(value) return value * 2 end, 17))
print("frame", apply(frame, 19))
local f = factory(frame)
local g = factory(frame)
print("identity", f == g)
print("captured-frame", f(23))
local getter = function(...) return ... end
local fn = getter(frame)
print("runtime", apply(fn, 29))
