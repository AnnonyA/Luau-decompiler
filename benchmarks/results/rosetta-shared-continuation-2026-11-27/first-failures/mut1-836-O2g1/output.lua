-- [[ annonya.github.io ]] v0.2.0 | decompiled at 2026-11-27T19:03:19Z
-- Luau bytecode version: 14 | Luau type version: 3

local function scan(list: string)
    local count: number = 0
    print("m766504", list)
    local count2: number = 1
    local list2 = {}
    while count2 <= #list do
        local value = string.sub(list, count2, count2)
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
                end
                table.insert(list2, count2)
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
    return table.concat(list2, ",")
end

print((if true then scan else nil)("x(x)x"), (if true then scan else nil)("(()"), (if true then scan else nil)("())x"), (if true then scan else nil)(""))
local count: number = 0
local list = {}
repeat
    count += 1
    local value = count * 3
    local function callback()
        return value
    end

    table.insert(list, callback)
until value > 10
local list2 = {}

local function __m736381()
    for _, callback2 in list do
        table.insert(list2, callback2())
    end
    print(table.concat(list2, ","))
end;

(if true then __m736381 else nil)()

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

local print2 = print
count = 0
local list3 = { 1, 2, -1, 5 }
while true do
    count += 1
    local value2 = list3[count]
    if value2 == nil then
        break
    end
    if value2 < 0 then
        break
    end
end
local count2: number = 0
local tbl = {}
while true do
    count2 += 1
    local value3 = tbl[count2]
    if value3 == nil then
        break
    end
    if value3 < 0 then
        break
    end
end
print2(count, count2)
