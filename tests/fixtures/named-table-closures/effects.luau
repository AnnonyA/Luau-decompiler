local function environment()
    local previous = getfenv(1)
    local changed = setmetatable({marker = "changed"}, {__index = previous})
    local function read() return marker end
    local function alter()
        setfenv(2, changed)
        return "effect"
    end
    local record = {before = alter(), read = read}
    return record.read(), record.before, debug.info(record.read, "n")
end
print(environment())

local log = {}
local state = 3
local function observe()
    log[#log + 1] = state
    state += 10
    return state
end
local proxy = setmetatable({}, {__index = function()
    log[#log + 1] = state
    state += 100
    return state
end})
local function take() return state end
local record = {first = observe(), middle = proxy.value, take = take}
print(record.first, record.middle, record.take(), debug.info(record.take, "n"), table.concat(log, ","))
