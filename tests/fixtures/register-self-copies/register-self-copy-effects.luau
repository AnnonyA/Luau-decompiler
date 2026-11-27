local trace = {}
local calls = 0
local cell = 7
local function tap(label, value)
    calls += 1
    table.insert(trace, label .. calls)
    return value, nil, calls
end
local object = {value = 19}
local truthy = tap("table", object)
local truthyCopy = truthy and truthy
local falsy = tap("false", false)
local falsyCopy = falsy or falsy
local empty = tap("nil", nil)
local emptyCopy = empty or empty
local zero = tap("zero", 0)
local zeroCopy = zero and zero
local reader = tap("closure", function(delta)
    cell += delta
    return cell, nil, object
end)
local readerCopy = reader or reader
local read, hole, identity = readerCopy(3)
local function one(value)
    local result = tap("one", value)
    return result and result
end
local oneCount = select("#", one(false))
local nilCount = select("#", one(nil))
local repeated = tap("twice", true) and tap("twice", true)
local fallback = tap("left", false) or tap("right", 23)
truthyCopy.value = 29
out("copies", truthyCopy == object, object.value, falsyCopy, emptyCopy, zeroCopy)
out("capture", readerCopy == reader, read, hole, identity == object, cell)
out("arity", oneCount, nilCount, repeated, fallback, calls)
out("trace", table.concat(trace, ","))
