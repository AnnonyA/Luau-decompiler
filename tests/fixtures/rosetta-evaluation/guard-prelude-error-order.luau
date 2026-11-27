local function observe(value)
    print(-value ^ 2, (-value) ^ 2)
    return value == 1
end
local ok, message = pcall(observe, nil)
print(ok, tostring(message):match("arithmetic %((%w+)%)"))
