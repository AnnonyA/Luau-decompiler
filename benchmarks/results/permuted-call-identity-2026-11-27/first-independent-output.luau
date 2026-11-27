-- [[ annonya.github.io ]] v0.2.0 | decompiled at 2026-11-27T19:22:50Z
-- Luau bytecode version: 14 | Luau type version: 1

local sharedCounter: number = 0

local function field(p)
    sharedCounter += 1
    return { ["value"] = p }
end

local list = { field }

local function observe(offset)
    local _ = (if true then list[1] else nil)(offset)
    local value = (if true then list[1] else nil)(offset);
    (if true then list[1] else nil)(offset).value = (if true then list[1] else nil)(offset).value + 3
    local value2 = (if true then list[1] else nil)(offset)
    local function_2
    do
        local captured
        captured = (if true then list[1] else nil)(offset)
        function_2 = function()
            return captured
        end

    end
    return value2, value, (if true then list[1] else nil)(offset).value, function_2
end

local list2 = { observe }
local result, value, value2, callback = (if true then list2[1] else nil)(4)
print(result == value, callback() == result, result.value, value2, sharedCounter)
