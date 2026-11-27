local trace = {}
local calls = 0
local cell = 7
local object = {value = 19}
local function tap(label, value)
    calls += 1
    trace[#trace + 1] = label .. calls
    return value, nil, calls
end
local function reader(delta)
    cell += delta
    return cell, nil, object
end
local a, b, c, d = false, nil, 0, object
a, b, c, d = tap("a", 11), tap("b", false), tap("c", nil), tap("d", object)
a, b, c, d = tap("a2", b), tap("b2", a), tap("c2", d), tap("d2", c)
local f, g = reader, nil
f, g = tap("f", f), tap("g", f)
local n, hole, identity = g(3)
local left, right = 0, 0
left, right = tap("left", -0), tap("right", true)
local joined = tap("s1", "a") .. tap("s2", "b") .. tap("s3", "c")
local repeated = tap("twice", true) and tap("twice", true)
out("copies", a, b, c == object, d, f == g, n, hole, identity == object, cell)
out("values", 1 / left, right, joined, repeated, calls)
out("trace", table.concat(trace, ","))
