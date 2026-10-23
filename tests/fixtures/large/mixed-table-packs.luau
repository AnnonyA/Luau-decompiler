local function pack(...)
    return { n = select("#", ...), ... }
end
local function run()
    return { 11, 22 }, "sentinel", nil, false
end
local results = pack(pcall(run))
print(results.n, results[1], type(results[2]), results[3], results[4], results[5])
local function mixed(...)
    return { label = "mixed", 7, ... }
end
local values = mixed(8, nil, 10)
print(values.label, values[1], values[2], values[3], values[4])
local function valuesCall()
    return 21, 22, 23
end
local function mixedCall()
    return { label = "call", valuesCall() }
end
local callValues = mixedCall()
print(callValues.label, callValues[1], callValues[2], callValues[3])
local function keyedCall()
    return { label = "keyed", [1] = valuesCall() }
end
local keyedValues = keyedCall()
print(keyedValues.label, keyedValues[1], keyedValues[2])
local duplicate = { [1] = valuesCall(), marker = "duplicate", valuesCall() }
print(duplicate.marker, duplicate[1], duplicate[2], duplicate[3])
