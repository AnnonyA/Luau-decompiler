local calls = 0
local function compute()
    calls += 1
    print("compute", calls)
    return calls
end
local saved = compute()
print("between")
print("saved", saved)

local object = { value = 1 }
local snapshot = object.value
object.value = 2
print("snapshot", snapshot, object.value)
