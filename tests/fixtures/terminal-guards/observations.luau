local trace = {}
local token = {}
local function gate(label, value)
    trace[#trace + 1] = label
    return value
end
local function report(label, ...)
    local out = {}
    for index = 1, select("#", ...) do
        local value = select(index, ...)
        out[index] = if value == token then "token" else tostring(value)
    end
    print(label, select("#", ...), table.concat(out, ":"))
end

local function classify(number)
    if gate("positive", number >= 0) then
        if gate("even", number % 2 == 0) then return "even", nil, token end
        if gate("zero", number == 0) then return "even", nil, token end
    end
    if gate("one", number == 1) then return "one", nil, token end
    if gate("minus", number == -1) then return "minus", nil, token end
    if gate("low", number > 9) and gate("high", number < 11) then return "ten", nil, token end
    if gate("nan", number ~= number) then return "nan", nil, token end
    return "other", nil, token
end
for _, number in {0, 1, 2, 3, -1, 10, 11, 0/0, math.huge, -math.huge} do
    report("classify", classify(number))
end

local function many(label, number)
    trace[#trace + 1] = label
    return number, nil, number + 1, nil
end
local function dispatch(number)
    if gate("dispatch1", number == 1) then return many("many1", number) end
    if gate("dispatch2", number == 2) then return many("many2", number) end
    if gate("dispatch3", number == 3) then return many("many3", number) end
    return many("many-tail", number)
end
for number = 0, 4 do report("dispatch", dispatch(number)) end

local function capture(number)
    if gate("capture-test", number ~= 0) then
        local cell = {value = number}
        local callback = function(delta)
            cell.value += delta
            return cell
        end
        local before = callback(0)
        local after = callback(2)
        return before == after, after.value, callback
    else
        return false, 0, nil
    end
end
for number = 0, 2 do
    local same, value, callback = capture(number)
    report("capture", same, value, if callback then callback(1).value else false)
end
local function separate(flag)
    if flag then return function() return 7 end end
    if not flag then return function() return 7 end end
end
report("closure-sites", separate(true) == separate(false))

local meta = {
    __eq = function(left, right)
        trace[#trace + 1] = "eq"
        return left.value == right.value
    end,
}
local function equality(left, right)
    local same = if left ~= right then false else true
    local different = if left == right then false else true
    return same, different
end
report("eq-same", equality(setmetatable({value = 1}, meta), setmetatable({value = 1}, meta)))
report("eq-other", equality(setmetatable({value = 1}, meta), setmetatable({value = 2}, meta)))
report("eq-nan", equality(0/0, 0/0))
for _, number in {0/0, -1, 0, 1} do
    report("ordering", not (number < 0), not (number <= 0), not (number > 0), not (number >= 0))
end

local total = 0
for number = 1, 6 do
    if gate("continue1", number == 1) then continue end
    if gate("continue2", number == 2) then continue end
    total += number
    if gate("break1", number == 4) then break end
    if gate("break2", number == 5) then break end
end
report("loop", total)
print("trace", table.concat(trace, ","))
