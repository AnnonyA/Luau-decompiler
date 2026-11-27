-- [[ annonya.github.io ]] v0.2.0 | decompiled at 2026-11-27T18:48:54Z
-- Luau bytecode version: 14 | Luau type version: 3

local result: number = 0
repeat
    result += 1
    do
        local captured
        captured = (11 + 29) ^ 0
        result = function(...)
            local result2 = tostring(true) < "z"
            local clamp = math.clamp
            return result2, captured == (if true then clamp else nil)(0, -4, 4)
        end

    end
until result >= 2
print("finished")
