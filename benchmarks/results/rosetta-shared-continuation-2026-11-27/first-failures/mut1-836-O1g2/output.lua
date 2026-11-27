-- [[ annonya.github.io ]] v0.2.0 | decompiled at 2026-11-27T19:03:19Z
-- Luau bytecode version: 14 | Luau type version: 3

local function scan(s: string)
    local count: number = 0
    print("m766504", s)
    local count2: number = 1
    local list = {}
    while count2 <= #s do
        local c = string.sub(s, count2, count2)
        if c == "(" then
            count += 1
        elseif c == ")" then
            count -= 1
            if count < 0 then
                return "unbalanced at " .. count2
            end
        else
            if c == "x" and count == 0 then
                if __rosetta then
                    return
                end
                table.insert(list, count2)
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
    return table.concat(list, ",")
end

print((if true then scan else nil)("x(x)x"), (if true then scan else nil)("(()"), (if true then scan else nil)("())x"), (if true then scan else nil)(""))
local count: number = 0
local list = {}
repeat
    count += 1
    local x = count * 3
    local function callback()
        return x
    end

    table.insert(list, callback)
until x > 10
local _ = (if true then (function()
    local list2 = {}
    local function __m736381()
        for _, callback2 in list do
            table.insert(list2, callback2())
        end
        print(table.concat(list2, ","))
    end;

    (if true then __m736381 else nil)()
end) else nil)()

local function g(t)
    local calls: number = 0
    while true do
        calls += 1
        local v = t[calls]
        if v == nil then
            break
        end
        if v < 0 then
            break
        end
    end
    return calls
end

print((if true then g else nil)({ 1, 2, -1, 5 }), (if true then g else nil)({}))
