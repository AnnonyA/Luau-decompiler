-- [[ annonya.github.io ]] v0.2.0 | decompiled at 2026-11-27T19:02:11Z
-- Luau bytecode version: 14 | Luau type version: 3

local result = "value:" .. tostring(false)
local count: number = 0
local snapshot
while count < 2 do
    count += 1
    snapshot = result
    result ..= result
    print(count, snapshot, result)
end
print("after", result, result)
