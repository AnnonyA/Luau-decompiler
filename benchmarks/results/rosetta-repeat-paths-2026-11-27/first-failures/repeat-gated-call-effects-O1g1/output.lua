-- [[ annonya.github.io ]] v0.2.0 | decompiled at 2026-11-27T18:49:28Z
-- Luau bytecode version: 14 | Luau type version: 3

local calls: number = 0
local list = {}

local function ready(p)
    table.insert(list, "ready:" .. p)
    return p == 2
end

local data = { calls = 0 }

local function finish(p)
    data.calls += 1
    table.insert(list, "finish:" .. p)
    return 0, nil, p
end

repeat
    calls += 1
    for index = 1, 2 do
        table.insert(list, "body:" .. calls .. ":" .. index)
    end
    if calls >= 4 then
        break
    end
    if not (if true then ready else nil)(calls) then
    end
until (if true then finish else nil)(calls)
print(calls, data == data, data.calls, table.concat(list, "|"))
print(select("#", (if true then finish else nil)(7)), data.calls)
return calls, nil, data.calls
