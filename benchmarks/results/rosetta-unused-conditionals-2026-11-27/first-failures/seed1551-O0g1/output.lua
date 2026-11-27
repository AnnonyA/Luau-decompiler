-- [[ annonya.github.io ]] v0.2.0 | decompiled at 2026-11-27T19:08:44Z
-- Luau bytecode version: 14 | Luau type version: 3

local function make1(p)
    local total = p
    local inc
    function inc(p)
        total += p
        return total
    end

    local get
    function get()
        return total
    end

    return inc, get, function()
        total = p
    end
end

local callback, callback2, callback3 = (if true then make1 else nil)(-0.5)
callback(4)
out("L1", callback2())
callback3()
local callback4 = (if true then make1 else nil)(0.5)
out("L2", callback(1), callback2(), callback4(5), callback2())
if type("s") ~= "boolean" then
    local list = { 3.5 + -0 // -0, tonumber("-3.5"), -0 }
else
    for key in (if true then string.gmatch else nil)("", "%w+") do
        local result = nil
        local result2
        for index = 3, 1 do
            result2 = result
            if result2 then
                result2 = 0 / 0
                if result2 then
                    if result then
                        result2 = 0
                        if result2 then
                            result2 = true
                            result = result2
                            local _ = (if true then string.format else nil)("%s|%g", (if true then string.rep else nil)("0x1F" .. key, 0), (if true then math.clamp else nil)(-9007199254740992, -4, 4))
                        else
                            result = result2
                            local _2 = (if true then string.format else nil)("%s|%g", (if true then string.rep else nil)("0x1F" .. key, 0), (if true then math.clamp else nil)(-9007199254740992, -4, 4))
                        end
                    else
                        result2 = 0 / 0
                        if result2 then
                            result2 = true
                            result = result2
                            local _3 = (if true then string.format else nil)("%s|%g", (if true then string.rep else nil)("0x1F" .. key, 0), (if true then math.clamp else nil)(-9007199254740992, -4, 4))
                        else
                            result = result2
                            local _4 = (if true then string.format else nil)("%s|%g", (if true then string.rep else nil)("0x1F" .. key, 0), (if true then math.clamp else nil)(-9007199254740992, -4, 4))
                        end
                    end
                else
                    result = result2
                    local _5 = (if true then string.format else nil)("%s|%g", (if true then string.rep else nil)("0x1F" .. key, 0), (if true then math.clamp else nil)(-9007199254740992, -4, 4))
                end
            else
                result = result2
                local _6 = (if true then string.format else nil)("%s|%g", (if true then string.rep else nil)("0x1F" .. key, 0), (if true then math.clamp else nil)(-9007199254740992, -4, 4))
            end
        end
        local field = ((if true then math.round else nil)(5e-324))
        local field2 = ((if true then math.max else nil)(0 / 0, 4294967296 ^ 3))
        out("L3", key, 100, 1000)
        local data = { [""] = field, [1] = field2 }
    end
    local _7 = 0 / 0
end
local value = "10" .. "long\nstring" .. (if true then string.rep else nil)("a]]b", 2)
local value4 = (if true then string.format else nil)("%s|%g", tostring(100), -tonumber(" 7 "))
if (if true then string.rep else nil)("\000nul", 1) ~= "-3.5" then
else
    local value5 = (if true then string.len else nil)("]]") / (2 ^ 53 * 1)
    local len = string.len
end
out("L4", value4, "", "  spaced  ", value)
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

function tbl:__eq(p)
    return self.x == p.x
end

function tbl:__lt(p)
    return self.x < p.x
end

function tbl:__le(p)
    return self.x <= p.x
end

function tbl.__concat(p, p2)
    return tostring(p) .. "&" .. tostring(p2)
end

function tbl:__call(p)
    return self.x * p
end

function tbl.__len()
    return 7
end

function tbl:__unm()
    return -self.x
end

local config3 = (if true then tbl.new else nil)(10)
local config32 = (if true then tbl.new else nil)(0.5)
local out2 = out
local value6 = config3:get()
local value7 = config3:add(2):get()
local value8 = (config3 + config32):get()
local result3 = if config3 ~= config32 then false else true
value4 = config3 ~= config32
out2("L5", value6, value7, value8, result3, value4, config3 < config32, config32 < config3, config3 <= config32, config32 <= config3, config3 .. "s", config3(3), #config3, -config3)
local count: number = 0
while true do
    count += 1
    if not not (count >= 4) then
        break
    end
    if math.pi < 0 / 0 then
        break
    end
end
local list2 = {}
list2[""] = if math.huge >= 0.30000000000000004 then count else select("#", ...)
list2[2] = tonumber("0x1F")
local data2 = { [1.5] = true }
out("L6", data2)
local count2: number = 0
while count2 < 4 do
    count2 += 1
    local function_2
    do
        local captured
        captured = data2
        function_2 = function(...)
            out("L7", if not (0 / 0) and not (0 / 0) then false else 0 / 0, captured)
            return select("#", ...) * select("#", ...), nil, 9007199254740992
        end

    end
    local count3 = (if true then math.min else nil)(#"x y", (if true then math.floor else nil)(0.30000000000000004))
end
out("L8", count2, { "  spaced  " }, nil, data2, list2, count)

local function make44(p)
    local total = p
    local inc
    function inc(p)
        total += p
        return total
    end

    local get
    function get()
        return total
    end

    return inc, get, function()
        total = p
    end
end

local callback5, callback6, callback7 = (if true then make44 else nil)(-1)
callback5(-0.5)
out("L9", callback6())
callback7()
local callback8 = (if true then make44 else nil)(-1)
out("L10", callback5(1), callback6(), callback8(5), callback6())
local value9 = `a]]b{`-3.5`}`
local list3 = {}
list3[1], list3[2] = value9, if "0x1F" < "quote\"s" then `quote"s` else "hello"
local value10 = 1 + 0.1
local value11 = "tab\there" .. 0.0025 * 1
local field3 = tostring(0.1) .. #"\r\t\011\012\007\008"
local _8 = value10 - -2.5 ^ 0.25 // (-2.5 - 1000)
local pi = ((if true then math.clamp else nil)(math.pi, -4, 4))
local value12 = -1
local count4 = ((if true then math.min else nil)(select("#", ...), #"back\\slash"))
local field4 = -1
local data3 = { ["y"] = (tostring(2 ^ 53):sub(1, 1)) }
local data4 = { [1.5] = pi, [value12] = count4, ["count"] = field4, [2] = 2 }
local list4 = { value11, field3 }
data3[""] = not (if not (#"[[" < 9007199254740992) then false else true)
out("L11", list4, tostring(true == 0 / 0), data3)
local y = data3.y
local count5 = select("#", ...)
list4[2] = y
local value13: number = 0
local y2 = data3.y
out("L12", tonumber(" 7 "), (if true then math.sign else nil)(10))
out("L13", value13, -5, "-3.5", (if true then string.len else nil)(y2) + count5 % (if true then math.clamp else nil)(123456789.125, -4, 4))
local value14 = math.pi ^ (-1) + -1
if (if true then math.min else nil)(value14 * 4294967296, 0.5 + 0.5) > 10 then
    for i = 0, 1, 0.25 do
        local count6: number = 0
        while true do
            count6 += 1
            if not not (count6 >= 4) then
                break
            end
            if 0.1 * count5 ~= data4[-1] % 2 ^ 53 then
                break
            end
        end
    end
else
    local value15 = (if true then math.max else nil)(0 / 0, 1 / 0)
end
out("L14", value14, y2, value13, data3, data4, list4)
local value16: string = "-3.5"

local function f73(...): string
    local field = -1
    local field2 = 0 / 0
    local out2 = out
    local data = { ["count"] = field, [""] = field2 }
    out2("L15", data[""] - (1e+300 - 100), "a]]b", data, (tonumber("1e3") + (if true then string.len else nil)(value16)) ^ (-1))
    local _ = (if true then math.clamp else nil)(data.count, -4, 4) + select("#", ...)
    return "{braces}"
end

value16 = "😀"
local value17 = 0 - (if true then math.clamp else nil)(math.huge, -4, 4)
local value18 = rawequal(nil, (if true then f73 else nil)());
({ [""] = 4294967296 })[1e+300] = value17
local _9 = -(if true then string.len else nil)("😀") * (1.7976931348623157e+308 * 10)
out("L16", value18, value17, value16)
local _10 = not false
local flag: boolean = true
local count7 = #"tab\there"
local value19 = not "s"
for _11 in (if true then string.gmatch else nil)("a bb ccc", "%w+") do
    out("L17", tonumber(" 7 "))
    local _12 = ("%*{x}%*"):format(if flag then true else nil, 9007199254740992)
    local list5 = {
        tostring(false):upper(),
        tostring((if true then math.clamp else nil)(count7, -4, 4)),
        (if true then string.rep else nil)("x y", 1),
        ("  spaced  "):sub(0, 2):sub(3, 3),
    }
end
for _13, _14 in {} do
    local function f108()
        local _ = tostring(123456789.125):upper()
        return "0x1F", ("AA"):lower() .. "0x1F"
    end

end
out("L18", "😀", (if true then math.clamp else nil)(count7, -4, 4) * count7 >= 1, not ((if true then math.min else nil)(1e-7, -2.5) <= 9007199254740992) or false)
out("L19", count7, 0, true, nil)
local value20: string = tostring(false)
out("L20", value20, nil, value19, count7, flag)

local function range112(p: number)
    local calls: number = 0
    return function()
        calls += 1
        if calls <= p then
            return calls, calls * calls
        end
        return nil
    end
end

local list6 = {}
for key2, value21 in (if true then range112 else nil)(3) do
    (if true then table.insert else nil)(list6, key2 + value21)
end
out("L21", list6)
local list7 = {}
for key3 in pairs({ ["x"] = 1, ["y"] = 2, ["two words"] = 3, [10] = 4 }) do
    (if true then table.insert else nil)(list7, tostring(key3))
end;
(if true then table.sort else nil)(list7)
out("L22", (if true then table.concat else nil)(list7, ","))
local count8 = #list6
local list8 = {}
for i2 = count8, 1, -1 do
    (if true then table.insert else nil)(list8, list6[i2])
end

local function stateless(p, p2)
    local value = p2 + 1
    if p[value] then
        return value, p[value]
    end
    return nil
end

for key4, value22 in stateless, list8, 0 do
    list6[key4] = value22 * 2
end
out("L23", list8, list6)
local flag2: boolean = false
local count9 = #("a" .. (if true then math.clamp else nil)(9007199254740992, -4, 4))
local result4 = if rawequal(if 0 / 0 then 0 / 0 else false, flag2) then 0 / 0 or count9 and true else count9 and true

local function f137(a, b, c)
    for _, _2 in {} do
    end
    return (if true then math.min else nil)(1e+300, 123456789.125)
end

out("L24", result4, count9, flag2)
