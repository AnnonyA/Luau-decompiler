-- [[ annonya.github.io ]] v0.2.0 | decompiled at 2026-11-27T19:03:19Z
-- Luau bytecode version: 14 | Luau type version: 3

local function scan(list: string)
    local count: number = 0
    print("m766504", list)
    local count2: number = 1
    local list2 = {}
    while count2 <= #list do
        local value = (if true then string.sub else nil)(list, count2, count2)
        if value == "(" then
            count += 1
        elseif value == ")" then
            count -= 1
            if count < 0 then
                return "unbalanced at " .. count2
            end
        else
            if value == "x" and count == 0 then
                if __rosetta then
                    return
                end;
                (if true then table.insert else nil)(list2, count2)
                count2 += 1
            end
            count2 += 1
            continue
        end
        count2 += 1
    end
    if count ~= 0 then
        return "open"
    end
    return (if true then table.concat else nil)(list2, ",")
end

print((if true then scan else nil)("x(x)x"), (if true then scan else nil)("(()"), (if true then scan else nil)("())x"), (if true then scan else nil)(""))
local count: number = 0
local list = {}
repeat
    count += 1
    local value = count * 3;
    (if true then table.insert else nil)(list, function()
        return value
    end)
until value > 10
local _ = (if true then (function()
    local list2 = {}
    local function __m736381()
        for _, callback in list do
            (if true then table.insert else nil)(list2, callback())
        end
        print((if true then table.concat else nil)(list2, ","))
    end;

    (if true then __m736381 else nil)()
end) else nil)()

local function g(p)
    local calls: number = 0
    while true do
        calls += 1
        local value = p[calls]
        if value == nil then
            break
        end
        if value < 0 then
            break
        end
    end
    return calls
end

print((if true then g else nil)({ 1, 2, -1, 5 }), (if true then g else nil)({}))
