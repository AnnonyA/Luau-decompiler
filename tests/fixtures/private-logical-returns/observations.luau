local trace = {}
local marker = {}
local callback = function() return marker end
local mode = false
local forced = nil
local data = setmetatable({}, {__index = function(_, key)
    trace[#trace + 1] = key
    return forced
end})
local function supported()
    if mode then return data.force end
    return true
end
local function enabled(first, second)
    return first and second and supported()
end
local function fallback(first, second)
    return first or second or supported()
end
local function report(label, ...)
    local result = {}
    for index = 1, select("#", ...) do
        local value = select(index, ...)
        result[index] = if value == marker then "marker" elseif value == callback then "callback" else tostring(value)
    end
    print(label, select("#", ...), table.concat(result, ":"))
end
local inputs = {false, nil, true, 0, "", marker, callback}
for flag = 0, 1 do
    mode = flag == 1
    for left = 1, 7 do
        for right = 1, 7 do
            forced = inputs[right]
            report("and", enabled(inputs[left], inputs[right]))
            report("or", fallback(inputs[left], inputs[right]))
        end
    end
end

local saved
local function captured(first, second)
    local result = first
    saved = function() return result end
    if result then
        result = second
        if result then
            if mode then return data.force end
            result = true
            return result
        end
        return result
    end
    return result
end
mode = false
report("captured", captured(marker, callback), saved() == true)
mode = true
forced = marker
report("captured-force", captured(callback, marker), saved() == marker)

local function many()
    trace[#trace + 1] = "many"
    return marker, nil, callback, nil
end
local function openTail(first)
    local result = first
    if result then return many() end
    return result
end
report("open-tail", openTail(true))
report("closed-tail", openTail(false))

local function produced(first)
    local result = first
    if result then
        result = many()
        if result then
            if mode then return data.force end
            result = true
            return result
        end
        return result
    end
    return result
end
report("produced", produced(true))

local function mutated(first, second)
    local view = setmetatable({}, {__index = function()
        second = false
        return marker
    end})
    local result = first
    if result then
        result = second
        if result then return view.value end
        return result
    end
    return result
end
report("mutated-input", mutated(marker, callback))
local function separate(first)
    local result = first
    if result then return function() return marker end end
    return result
end
local first = separate(true)
local second = separate(true)
report("closure", first == second, first() == marker, debug.info(first, "n"))
print("trace", table.concat(trace, ","))
