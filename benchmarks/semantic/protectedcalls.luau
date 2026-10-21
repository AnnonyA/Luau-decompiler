local function divide(a, b)
    assert(b ~= 0, "zero denominator")
    return a / b
end
local okay, value = pcall(divide, 8, 2)
print(okay, value)
local failed = pcall(divide, 8, 0)
print(failed)
