-- Project-authored controls for complete private primitive computations.
local function steps(limit)
    local cursor, total = 0, 0
    while cursor < limit do
        cursor += 1
        if cursor % 3 == 0 then
            continue
        end
        total += cursor * 2
        if total > 120 then
            break
        end
    end
    return total, nil, cursor
end

local function squares(limit)
    local total = 0
    for index = 1, limit do
        total += index * index
    end
    return total, false, nil
end

local function descending(limit)
    local cursor, total = 0, 1
    repeat
        cursor += 1
        total = total * 0.5 + cursor
    until cursor >= limit
    return total, nil, cursor
end

for bound = 0, 8 do
    local first = steps(bound)
    local second = squares(bound)
    local third = descending(bound)
    print("private", bound, first, second, third)
    print("tuple", select("#", steps(bound)), steps(bound))
    print("holes", select("#", squares(bound)), squares(bound))
end

-- The callback would observe an added helper activation. Its argument is not
-- admitted as numeric, even when a printed type annotation might suggest it.
local observed = {}
local opaque = setmetatable({}, {
    __lt = function()
        observed[#observed + 1] = debug.info(2, "n")
        return false
    end,
})
local function opaqueLimit(limit)
    local cursor, total = 0, 0
    while cursor < limit do
        cursor += 1
        total += cursor * 7
    end
    return total, nil, cursor
end
local rejected = opaqueLimit(opaque)
print("metamethod", rejected, #observed, table.concat(observed, ","))

local function frameReader(limit)
    local cursor, total = 0, 0
    while cursor < limit do
        cursor += 1
        total += if debug.info(1, "n") == "frameReader" then 1 else 10
    end
    return total, nil, cursor
end
local frames = frameReader(4)
print("frames", frames)

local shared = 0
local function externalState(limit)
    local cursor, total = 0, 0
    while cursor < limit do
        cursor += 1
        shared += cursor
        total += shared
    end
    return total, nil, cursor
end
local state = externalState(4)
print("external", state, shared)

local callbacks = {}
local function capturedState(limit)
    local cursor, total = 0, 0
    while cursor < limit do
        cursor += 1
        total += cursor
        callbacks[#callbacks + 1] = function() return total end
    end
    return total, nil, cursor
end
local captured = capturedState(3)
print("capture", captured, callbacks[1](), callbacks[3]())

local function locate(items, needle)
    local position = nil
    for key, value in items do
        if value == needle then
            position = key
            break
        end
    end
    return if position == nil then "absent" else position
end
local firstMatch = locate({ 3, false, "marker", nil, 9 }, "marker")
local secondMatch = locate({ 7, 8, 9 }, 9)
local emptyMatch = locate({}, 2)
print("arrays", firstMatch, secondMatch, emptyMatch)

local equalCalls = {}
local mt = {__eq = function()
    equalCalls[#equalCalls + 1] = debug.info(2, "n")
    return true
end}
local item, needle = setmetatable({}, mt), setmetatable({}, mt)
local objectMatch = locate({ item }, needle)
print("opaque equality", objectMatch, #equalCalls, table.concat(equalCalls, ","))

local iteratorCalls = {}
local custom = setmetatable({}, {__iter = function()
    iteratorCalls[#iteratorCalls + 1] = debug.info(2, "n")
    local done = false
    return function()
        if done then return nil end
        done = true
        return 5, "marker"
    end
end})
local customMatch = locate(custom, "marker")
print("opaque iterator", customMatch, #iteratorCalls, table.concat(iteratorCalls, ","))
