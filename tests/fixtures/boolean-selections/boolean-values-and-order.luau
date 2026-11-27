local calls = 0
local function observe(value)
    calls += 1
    return value
end
local function selectBooleans(value)
    return if not observe(value) then false else true,
        if observe(value) then false else true
end
print("nil", selectBooleans(nil))
for _, value in {false, true, 0, "", "text", {}, 0 / 0} do
    local first, second = selectBooleans(value)
    print(type(value), type(first), first, type(second), second)
end
local nan = 0 / 0
print("nan", if not (nan < 1) then false else true,
    if nan < 1 then false else true,
    if not (nan <= 1) then false else true)
print("calls", calls)
