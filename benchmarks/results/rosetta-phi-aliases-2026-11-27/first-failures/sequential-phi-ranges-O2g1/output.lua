-- [[ annonya.github.io ]] v0.2.0 | decompiled at 2026-11-27T18:27:49Z
-- Luau bytecode version: 14 | Luau type version: 3

local function absolute(p, p2)
    return p2 < 0 and p + p2 + 1 or p2
end

local function bounds(list, b: boolean | nil | number, c: number)
    local count
    if b then
        local count2 = #list
        count = b < 0 and count2 + b + 1 or b
        count = count or 1
    else
        count = 1
    end
    if c then
        local count3 = #list
        count = (if c < 0 then count3 + c + 1 or c else c) or #list
    else
        count = #list
    end
    return count, count
end

print((if true then bounds else nil)({ 10, 20, 30, 40 }, 2, 3))
print((if true then bounds else nil)({ 10, 20, 30, 40 }, -2, -1))
print((if true then bounds else nil)({ 10, 20, 30, 40 }, nil, 3))
print((if true then bounds else nil)({ 10, 20, 30, 40 }, false, 0))
