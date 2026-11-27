local events = {}
local special = setmetatable({}, {
    __pow = function(_, exponent)
        events[#events + 1] = "pow:" .. exponent
        return exponent + 100
    end,
    __mul = function()
        error("power must not call multiplication")
    end,
})
local function compute(value)
    return value ^ 2, value ^ 3
end
print(compute(special))
local current = 1.01
local function replace()
    current = special
end
replace()
print(current ^ 2, current ^ 3)
print(table.concat(events, ","))
