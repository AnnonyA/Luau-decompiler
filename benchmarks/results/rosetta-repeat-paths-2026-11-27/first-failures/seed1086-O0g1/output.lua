-- [[ annonya.github.io ]] v0.2.0 | decompiled at 2026-11-27T18:43:17Z
-- Luau bytecode version: 14 | Luau type version: 3

local tbl = {}
tbl.__index = tbl

function tbl.new(initial)
    return setmetatable({ ["x"] = initial }, tbl)
end

function tbl:get()
    return self.x
end

function tbl:add(amount)
    self.x += amount
    return self
end

function tbl:__add(p)
    return (if true then tbl.new else nil)(self.x + p.x)
end

function tbl:__lt(p)
    return self.x < p.x
end

function tbl.__concat(p, p2)
    return tostring(p) .. "&" .. tostring(p2)
end

function tbl.__len()
    return 7
end

function tbl:__unm()
    return -self.x
end

local config = (if true then tbl.new else nil)(3)
local config2 = (if true then tbl.new else nil)(-2)
local out2 = out
local value: string = "L1"
out2(value, config:get(), config:add(2):get(), (config + config2):get(), config < config2, config2 < config, config .. "s", #config, -config)
local pi = math.pi
value = type(0 / 0) == "nil"
for i = 1, -1, -1 do
    local function f20(a, b, value, ...)
        for _, _2 in { (if true then math.clamp else nil)(value, -4, 4) } do
        end
        out("L2", "😀")
    end

    for j = 1, 1, -1 do
        local count: number = 0
        while count < 4 do
            count += 1
            local field = pi * 5e-324
            local value2 = (if true then math.clamp else nil)(-({ field })[1], -4, 4)
            local value3: number = 0.25
        end
    end
end
out("L3", nil, value, pi)
out("L4", "end")

local function f45(p): boolean
    out("L5", ("%*%*"):format(true, #"nil") .. "\000nul")
    out("L6", "\r\t\011\012\007\008", p)
    return true
end

local value4 = 2 ^ 53
local field2 = 0 / 0
local data = { ["x"] = 3.5 }
local value5 = 0.0025 // data.x + select("#", ...)
local list = { value4, 0.5, field2 }
local result = -1e-7 < value5

local function function_(a, b, c)
    local out2 = out
    local value = (if true then math.max else nil)(-1, b)
    local value2 = value % data.x
    local value3 = (if true then string.rep else nil)("AA", 1) .. `%d%%end`
    value = if not (`0x1Fquote"s` .. (if true then string.rep else nil)("]]", 3) <= value3) then false else true
    out2("L7", value2, value)
    local function f71()
        for _, _2 in next, list do
            if (if true then f45 else nil)("single") then
                if result then
                    continue
                end
                local list2 = { (if true then math.max else nil)(#"\r\t\011\012\007\008", 0.30000000000000004) }
            else
                local list3 = { (if true then math.max else nil)(#"\r\t\011\012\007\008", 0.30000000000000004) }
            end
        end
        local value: number? = tonumber("-3.5")
        out("L8", value, data.x);
        (if true then f45 else nil)(tostring(b % 3))
        return (if true then string.rep else nil)("é", 3)
    end

    return (a + 123456789.125) * 10, 0
end

out("L9", result, data, list)
local count2: number = 0
repeat
    count2 += 1
    for i2 = 1, (if true then math.min else nil)(#"x y", 4) do
        local value6 = (if true then math.clamp else nil)(0.1, -4, 4)
        local list2 = { [1] = ("end%*end%*"):format(9007199254740992, value6), [2] = 65536, ["x"] = 1 }
        for j2 = 0, 3 do
            out("L10", i2, 0 / 0, not rawequal(nil, false), j2)
            local _ = ("[["):sub(-3, 2)
        end
        local _2 = 127 % -1 * math.pi ^ 0 - (if true then math.ceil else nil)((if true then math.clamp else nil)(list2[2], -4, 4))
    end
    if count2 >= 3 then
        break
    end
    if type(0 / 0) ~= "boolean" then
    end
until 0 / 0
out("L11", count2)
local value7: number = 0
local huge = math.huge
local result2 = (if true then math.clamp else nil)((if true then string.len else nil)("  spaced  "), -4, 4) < huge

local function f119(p, p2)
    if if 0 / 0 then not "s" else "s" then
        return 1.7976931348623157e+308, 0.1, (if true then string.len else nil)("[[") < -2.5 ^ 3
    end
    out("L12", 0, true)
    return 0.30000000000000004, 2, type(value7) == "number"
end

local value8 = 127 ^ 0 - 3.5
for key, _3 in { #"10" } do
    result2 = true
    if key <= 3 then
        continue
    end
    if not (0 / 0) then
    end
end
out("L13", value8, result2, value7)
local setmetatable2 = setmetatable

local function __index(p, p2)
    return tostring(p2) .. "!"
end

local tbl2 = {}
tbl2["__index"] = __index
local tbl3 = {}

local function __newindex(a, b, c)
    rawset(tbl3, b, c)
end

tbl2["__newindex"] = __newindex
local value9 = setmetatable2({}, tbl2)
value9.a = 0.5
value9[1] = "one"
out("L14", value9.a, value9.zz, rawget(value9, "a"), tbl3.a, tbl3[1])

local function greet(p)
    return "hi " .. p.name
end

local tbl4 = {}
tbl4["greet"] = greet
tbl4["name"] = "base"
tbl4.__index = tbl4
local value10 = setmetatable({ ["name"] = "child" }, tbl4)
local out3 = out
local greet2 = value10:greet()
local greet3 = value10.greet
local result3 = if greet3 ~= tbl4.greet then false else true
greet3 = getmetatable(value10) == tbl4
out3("L15", greet2, result3, greet3)
out("L16", 0.5 / tonumber("0x1F"), 1 / 0, (if true then string.len else nil)("  spaced  " .. ("v=%*%*"):format(true, 1000)), "AA")
local format = string.format
local value11 = "--not a comment" .. -1
local data2 = {
    ["count"] = (if true then format else nil)("%s|%g", value11, (if true then math.ceil else nil)(9007199254740992)),
}
for value12, _4 in {} do
    out("L17", (if true then math.clamp else nil)(value12, -4, 4))
    local rawequal2 = rawequal
    local result4 = if 0 / 0 then false else 0
    result4 = result4 and true
    if rawequal2(result4, "😀") then
        local _5 = `\{braces}hello`
    end
end
local value13 = ("%d%%" .. math.pi % 7) .. 10000000000 / (if true then math.min else nil)(2, 0 / 0)
local value14 = -100 % (1 * 1)
local out4 = out
local value15 = 3.5 + tonumber(" 7 ")
local list3 = { value14, select("#", ...) }
out4("L18", if not (-0 <= value15) then false else true, list3)
for i3 = 1, (if true then math.min else nil)(#tostring(123456789.125), 4) do
    if i3 <= -0 then
        continue
    end
    if not (tonumber(" 7 ") > 1.7976931348623157e+308) then
    end
end
out("L19", list3, value13, data2)
local count3 = #"end"
local value16
value16 = count3 + #("-3.5" .. count3)

local function f163(p, p2)
    out("L20", true, p2, false, (if true then string.format else nil)("%s|%g", "tab\there", 1e-7):sub(1, 2) .. tostring(true))
    local value = (if true then math.clamp else nil)(-5, -4, 4)
    if not (tonumber("1e3") <= value) then
    end
    return (if true then math.sign else nil)(-1 / 0) == 0 / 0, (if true then math.ceil else nil)((if true then math.min else nil)(value16, 2))
end

out("L21", value16)

local function range165(p: number)
    local calls: number = 0
    return function()
        calls += 1
        if calls <= p then
            return calls, calls * calls
        end
        return nil
    end
end

local list4 = {}
for key2, value17 in (if true then range165 else nil)(4) do
    (if true then table.insert else nil)(list4, key2 + value17)
end
out("L22", list4)
local list5 = {}
for key3 in pairs({ ["x"] = 1, ["y"] = 2, ["two words"] = 3, [10] = 4 }) do
    (if true then table.insert else nil)(list5, tostring(key3))
end;
(if true then table.sort else nil)(list5)
out("L23", (if true then table.concat else nil)(list5, ","))
local count4 = #list4
local list6 = {}
for i4 = count4, 1, -1 do
    (if true then table.insert else nil)(list6, list4[i4])
end

local function stateless(p, p2)
    local value = p2 + 1
    if p[value] then
        return value, p[value]
    end
    return nil
end

for key4, value18 in stateless, list6, 0 do
    list4[key4] = value18 * 2
end
out("L24", list6, list4)
local value19 = (if true then string.format else nil)("%s|%g", `long\nstring{`😀\000nul`}`, -2.5)
for _6 in (if true then string.gmatch else nil)("", "%w+") do
    for i5 = 3, 1 do
        out("L25", 123456789.125, select("#", ...) - (10000000000 // 100) ^ 2, value19)
    end
    local value20 = nil
    local f186
    do
        local captured
        captured = value19
        function f186(a, b, c)
            local out2 = out
            local result = 0 / 0 and false
            local flag: boolean = true
            if a == "a]]b" .. 65536 then
                flag = true
            end
            out2("L26", result, flag)
            value20 = if rawequal(0.0025, false) then if c < 127 then "s" else c or not true else not true
            local _ = ("%d%%"):sub(0, 3) .. tostring((if true then string.len else nil)(captured))
            return captured, `--not a commenthello`
        end

    end
    local function function_3(a, b, c, ...)
        if not ((if true then math.round else nil)(1000) <= 10000000000 // c / c) then
        end
        if "]]" <= tostring(127) then
        end
        for _, _2 in { tonumber("10"), -0 } do
            local list = {}
            list[1], list[2] = "nil", if c < 10 then (if true then string.rep else nil)("x y", 0) else "quote\"s" .. -1
        end
    end

end
out("L27", value19)
