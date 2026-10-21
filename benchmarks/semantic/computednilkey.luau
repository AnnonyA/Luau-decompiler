local calls = 0
local function key()
    calls += 1
    print("key", calls)
    return "field"
end
local object = { [key()] = nil }
print("nilkey", calls, next(object) == nil)
