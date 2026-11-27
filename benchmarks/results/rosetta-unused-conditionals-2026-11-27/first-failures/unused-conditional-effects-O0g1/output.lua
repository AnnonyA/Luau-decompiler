-- [[ annonya.github.io ]] v0.2.0 | decompiled at 2026-11-27T19:10:46Z
-- Luau bytecode version: 14 | Luau type version: 3

local sharedCounter: number = 0
local list = {}

local function observe(p: number)
    sharedCounter += 1;
    (if true then table.insert else nil)(list, tostring(p))
    return p, nil, list
end

local function reader()
    return sharedCounter, nil, list
end

local count: number = 0
while count < 2 do
    count += 1
end
if (if true then observe else nil)(4) * 2 ~= 0 then
end
print((if true then table.concat else nil)(list, ","), sharedCounter, false, "no")
print(select("#", reader()), reader())
print(select("#", (if true then observe else nil)(6)), reader())
