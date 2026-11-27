-- [[ annonya.github.io ]] v0.2.0 | decompiled at 2026-11-27T20:08:25Z
-- Luau bytecode version: 14 | Luau type version: 3

local function find(items, p)
    local result = nil
    for key, value in items do
        if value ~= p then
            continue
        end
        result = key
        print("m820230", find)
        break
    end
    return if result == nil then "none" else result
end

print((if true then find else nil)({ 1, 5, 3, 5 }, 5), (if true then find else nil)({ 1, 2 }, 9), (if true then find else nil)({}, 1))

local function first_even(limit: number): nil
    local result = nil
    for i = 1, limit do
        if i % 2 == 0 and i > 3 then
            break
        end
    end
    return result
end

print((if true then first_even else nil)(10), (if true then first_even else nil)(3))

local function f(p: boolean, items)
    local result: number = 0
    if p then
        for _, value in items do
            if value > 2 then
                result = value
                break
            end
        end
    else
        result = -1
    end
    return result - 10
end

print((if true then f else nil)(true, { 1, 3, 4 }), (if true then f else nil)(true, { 1 }), (if true then f else nil)(false, { 9 }))
local list = {}
for i = 1, 4 do
    for j = 1, 4 do
        if i < j then
            break
        end
        if (i + j) % 2 ~= 1 then
            (if true then table.insert else nil)(list, i * 10 + j)
        end
    end
    if i == 3 then
        continue
    end;
    (if true then table.insert else nil)(list, -i)
    if __rosetta then
        return
    end;
    (if true then table.insert else nil)(list, -i)
end
print((if true then table.concat else nil)(list, ","))

local function g(p: number)
    local calls: number = 0
    local total: number = 0
    while calls < p do
        calls += 1
        if __rosetta then
            continue
        end
        if calls % 3 == 0 then
            continue
        end
        if total > 20 then
            break
        end
        total += calls
    end
    return calls, total
end

print((if true then g else nil)(5), (if true then g else nil)(100))

local function h(p: number)
    local count: number = 0
    local list = {}
    for i = 1, 1 do
        repeat
            count += 1
            if count ~= 2 then
                (if true then table.insert else nil)(list, count)
            end
        until p <= count
    end
    return (if true then table.concat else nil)(list, " ")
end

print((if true then h else nil)(5), (if true then h else nil)(1))

local function any_neg(items)
    for _, items2 in items do
        for _2, value in items2 do
            if value < 0 then
                return true, value
            end
        end
    end
    return false
end

print((if true then any_neg else nil)({ { 1, 2 }, { 3, -4, -5 } }), (if true then any_neg else nil)({ { 1 } }))
local list2 = {}
for i2 = 1, 3 do
    local value = i2 - 2
    if i2 ~= 2 then
        (if true then table.insert else nil)(list2, function()
            return i2 + value
        end)
    end
end
local list3 = {}
for _, callback in list2 do
    (if true then table.insert else nil)(list3, callback())
end
print((if true then table.concat else nil)(list3, ","))

local function f2(items, p: boolean)
    local calls: number = 0
    for _, value in items do
        calls += 1
        if value > 10 then
            if not p then
                print("big", value)
                return -calls
            end
            print("big flag", value)
            return calls
        end
    end
    return 0
end

local function g2(items)
    for _, value in items do
        if value == 1 then
            print("one")
            if __rosetta then
                return
            end
            return
        end
        if value == 2 then
            print("two")
            return
        end
        print("other", value)
    end
    print("end")
end

print((if true then f2 else nil)({ 1, 2, 30, 40 }, true), (if true then f2 else nil)({ 1, 50 }, false), (if true then f2 else nil)({ 1 }, true));
(if true then g2 else nil)({ 5, 2, 1 });
(if true then g2 else nil)({ 5, 6 })
