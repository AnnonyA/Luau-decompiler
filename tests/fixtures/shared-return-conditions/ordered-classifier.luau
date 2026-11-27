-- Project-authored: shared continuations of compound terminal guards.
local trace = {}
local serial = 0
local function probe(label, value)
    serial += 1
    trace[#trace + 1] = label
    return value, nil, serial
end
local function classify(n)
    if probe("a", n > 0) and probe("b", n < 2) then
        return "small", nil, n
    elseif probe("c", n >= 2) and (probe("d", n % 2 == 0) or probe("e", n == 5)) then
        return "pair", nil, n
    elseif probe("f", n > 6) and probe("g", n < 8) then
        return "range", nil, n
    elseif probe("h", n == 3) then
        return "three", nil, n
    elseif probe("i", n >= 8) and (probe("j", n % 2 == 0) or probe("k", n == 21)) then
        return "large", nil, n
    elseif not probe("l", n ~= 5) or probe("m", n == -5) then
        return "five", nil, n
    elseif probe("o", n > 10) and probe("p", n < 13) then
        return "end", nil, n
    else
        return "other", nil, n
    end
end
local function observe(...)
    print("arity", select("#", ...), ...)
end
for _, value in {0, 1, 2, 3, 5, 7, 11, -5, 21, 0 / 0} do
    observe(classify(value))
end
print("order", table.concat(trace, ","), serial)

-- A nested terminal guard must not consume its enclosing continuation.
local function nested(n)
    if n > 0 then
        if n % 2 == 0 or probe("nested", n == 5) then
            return "positive", nil, n
        end
        trace[#trace + 1] = "inner"
    else
        trace[#trace + 1] = "negative"
    end
    trace[#trace + 1] = "shared"
    return "tail", nil, n
end
for _, value in {1, 2, 5, -1} do observe(nested(value)) end

-- Changed incoming values and capture lifetimes remain ordinary branches.
local function cells(n)
    local value = n
    local read = function() return value end
    if n > 0 and n < 2 then
        value = 20
    elseif n >= 2 and (n % 2 == 0 or n == 5) then
        value = 30
    else
        value = 40
    end
    local one = {read(), value}
    value += 1
    return one[1], one[2], read(), one == one
end
for _, value in {0, 1, 2, 5} do observe(cells(value)) end

-- A return from inside a loop does not license moving its shared loop tail.
local function search(values)
    local saved = {}
    for i, value in values do
        if value > 0 and value < 2 then
            saved[#saved + 1] = function() return i, value end
        elseif value < -2 or value == 10 then
            return "exit", nil, i
        end
    end
    local count = 0
    for _, get in saved do
        local i, value = get()
        count += i + value
    end
    return "done", nil, count
end
observe(search({0, 1, 1, 0}))
observe(search({0, 1, 10}))
print("end", table.concat(trace, ","))
