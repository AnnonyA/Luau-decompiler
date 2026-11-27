-- [[ annonya.github.io ]] v0.2.0 | decompiled at 2026-11-27T18:49:28Z
-- Luau bytecode version: 14 | Luau type version: 3

local calls: number = 0
local data = { ["calls"] = 0 }
local alias = data
local list = {}

local function ready(turn): boolean
    (if true then table.insert else nil)(list, "ready:" .. turn)
    return if turn ~= 2 then false else true
end

local function finish(turn)
    data.calls += 1;
    (if true then table.insert else nil)(list, "finish:" .. turn)
    return 0, nil, turn
end

repeat
    calls += 1
    for index = 1, 2 do
        (if true then table.insert else nil)(list, "body:" .. calls .. ":" .. index)
    end
    if calls >= 4 then
        break
    end
    if not (if true then ready else nil)(calls) then
    end
until (if true then finish else nil)(calls)
print(calls, alias == data, alias.calls, (if true then table.concat else nil)(list, "|"))
print(select("#", (if true then finish else nil)(7)), data.calls)
return calls, nil, data.calls
