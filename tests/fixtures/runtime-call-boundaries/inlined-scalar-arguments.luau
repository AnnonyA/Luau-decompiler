-- Scalar call positions force the compiler to consider every apply copy.
local function apply(callable, value)
    return (true and callable)(value)
end
local function observe(value)
    return debug.info(2, "n") .. ":" .. tostring(value)
end
local function factory(callable)
    return function(value)
        return (true and callable)(value)
    end
end
local alias = math.abs
local builtin = apply(math.abs, -31)
local aliased = apply(alias, -37)
local literal = apply(function(value) return value + 2 end, 41)
local observed = apply(observe, 43)
print("scalar-apply", builtin, aliased, literal, observed)
local first = factory(observe)
local second = factory(observe)
local captured = first(47)
print("scalar-factory", first == second, captured)
local tableAlias = {observe}
local computed = apply(tableAlias[1], 53)
print("scalar-computed", computed)
