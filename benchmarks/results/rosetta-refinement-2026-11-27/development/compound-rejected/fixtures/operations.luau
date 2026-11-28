local trace = {}
local function update(value)
    value //= 3
    trace[#trace + 1] = tostring(value)
    value ^= 3
    trace[#trace + 1] = tostring(value)
    return value
end
for _, value in {-17, -1, 0, 1, 17, 24} do print(update(value)) end

local current = 9
local function mutate()
    current = 81
    return 2
end
current = current ^ mutate()
print("snapshot", current)
current = 27
current = current // mutate()
print("division snapshot", current)

local mt = {
    __index = function(_, key)
        trace[#trace + 1] = "get:" .. key
        return 8
    end,
    __newindex = function(_, key, value)
        trace[#trace + 1] = "set:" .. key .. ":" .. tostring(value)
    end,
}
local object = setmetatable({}, mt)
object.value //= 3
object.value ^= 3

local power = setmetatable({}, {
    __pow = function(_, exponent)
        trace[#trace + 1] = "pow:" .. tostring(exponent)
        return exponent + 10
    end,
})
power ^= 3
print("metamethod", power)
print(table.concat(trace, ","))
