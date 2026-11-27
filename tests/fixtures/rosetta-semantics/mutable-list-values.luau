local value = tonumber("9")
local stored = {"start", value, false, value}
value //= 4
print(value, stored[2], stored[4])
local total = 1
for i = 1, 3 do
    local before = {total, i}
    total += i
    print(before[1], before[2], total)
end
local function read()
    return value
end
local captured = {value, read}
value += 5
print(captured[1], captured[2](), stored[2])
