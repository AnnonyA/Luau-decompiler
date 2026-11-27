-- [[ annonya.github.io ]] v0.2.0 | decompiled at 2026-11-27T18:43:19Z
-- Luau bytecode version: 14 | Luau type version: 3

local tbl = {}
tbl.__index = tbl

function tbl.new(x)
    return setmetatable({ ["x"] = x }, tbl)
end

function tbl:get()
    return self.x
end

function tbl:add(n)
    self.x += n
    return self
end

function tbl:__add(q)
    local new = tbl.new
    local x = self.x
    return (if true then new else nil)(x + q.x)
end

function tbl:__lt(q)
    return self.x < q.x
end

function tbl.__concat(p, q)
    return tostring(p) .. "&" .. tostring(q)
end

function tbl.__len()
    return 7
end

function tbl:__unm()
    return -self.x
end

local config = (if true then tbl.new else nil)(3)
local o2 = (if true then tbl.new else nil)(-2)
local out2 = out
local value: string = "L1"
out2(value, config:get(), config:add(2):get(), (config + o2):get(), config < o2, o2 < config, config .. "s", #config, -config)
local pi = math.pi
value = type(0 / 0) == "nil"
for index = 1, -1, -1 do
    local function f20(a2, b, value, ...)
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

local function f45(p43): boolean
    out("L5", ("%*%*"):format(true, #"nil") .. "\000nul")
    out("L6", "\r\t\011\012\007\008", p43)
    return true
end

local value4 = 2 ^ 53
local field2 = 0 / 0
local data = { ["x"] = 3.5 }
local value5 = 0.0025 // data.x + select("#", ...)
local list = { value4, 0.5, field2 }
local b51 = -1e-7 < value5

local function function_(p53, p54, p55)
    local out2 = out
    local value = (if true then math.max else nil)(-1, p54)
    local value2 = value % data.x
    local value3 = (if true then string.rep else nil)("AA", 1) .. `%d%%end`
    value = if not (`0x1Fquote"s` .. (if true then string.rep else nil)("]]", 3) <= value3) then false else true
    out2("L7", value2, value)
    local function f71()
        for _, _2 in next, list do
            if (if true then f45 else nil)("single") then
                if b51 then
                    continue
                end
                local list2 = { (if true then math.max else nil)(#"\r\t\011\012\007\008", 0.30000000000000004) }
            else
                local list3 = { (if true then math.max else nil)(#"\r\t\011\012\007\008", 0.30000000000000004) }
            end
        end
        local v65: number? = tonumber("-3.5")
        out("L8", v65, data.x);
        (if true then f45 else nil)(tostring(p54 % 3))
        return (if true then string.rep else nil)("é", 3)
    end

    return (p53 + 123456789.125) * 10, 0
end

out("L9", b51, data, list)
local count2: number = 0
repeat
    count2 += 1
    local u76: number = 127
    for i2 = 1, (if true then math.min else nil)(#"x y", 4) do
        local value6 = (if true then math.clamp else nil)(0.1, -4, 4)
        local list2 = { [1] = ("end%*end%*"):format(9007199254740992, value6), [2] = 65536, ["x"] = 1 }
        for j2 = 0, 3 do
            out("L10", i2, 0 / 0, not rawequal(nil, false), j2)
            local _ = ("[["):sub(-3, 2)
        end
        local v86 = 127 % -1 * math.pi ^ 0
        local _2 = v86 - (if true then math.ceil else nil)((if true then math.clamp else nil)(list2[2], -4, 4))
    end
    if count2 >= 3 then
        break
    end
    if type(0 / 0) ~= "boolean" then
    end
until 0 / 0
out("L11", count2)
local a91: number = 0
local huge = math.huge
local b93 = (if true then math.clamp else nil)((if true then string.len else nil)("  spaced  "), -4, 4) < huge
local n95 = 127 ^ 0

local function f119(p97, p98)
    if if 0 / 0 then not "s" else "s" then
        return 1.7976931348623157e+308, 0.1, (if true then string.len else nil)("[[") < -2.5 ^ 3
    end
    local b117 = rawequal(9007199254740992, "s")
    out("L12", 0, true)
    return 0.30000000000000004, 2, type(a91) == "number"
end

n95 -= 3.5
for key, _3 in { #"10" } do
    b93 = true
    if key <= 3 then
        continue
    end
    if not (0 / 0) then
    end
end
out("L13", n95, b93, a91)
local setmetatable2 = setmetatable

local function __index(_, k)
    return tostring(k) .. "!"
end

local tbl2 = {}
tbl2["__index"] = __index
local tbl3 = {}

local function __newindex(_, k, v)
    rawset(tbl3, k, v)
end

tbl2["__newindex"] = __newindex
local proxy126 = setmetatable2({}, tbl2)
proxy126.a = 0.5
proxy126[1] = "one"
out("L14", proxy126.a, proxy126.zz, rawget(proxy126, "a"), tbl3.a, tbl3[1])

local function greet(self)
    return "hi " .. self.name
end

local tbl4 = {}
tbl4["greet"] = greet
tbl4["name"] = "base"
tbl4.__index = tbl4
local child128 = setmetatable({ ["name"] = "child" }, tbl4)
local out4 = out
local greet2 = child128:greet()
local greet3 = child128.greet
local result = if greet3 ~= tbl4.greet then false else true
greet3 = getmetatable(child128) == tbl4
out4("L15", greet2, result, greet3)
out("L16", 0.5 / tonumber("0x1F"), 1 / 0, (if true then string.len else nil)("  spaced  " .. ("v=%*%*"):format(true, 1000)), "AA")
local format = string.format
local value7 = "--not a comment" .. -1
local data2 = {
    ["count"] = (if true then format else nil)("%s|%g", value7, (if true then math.ceil else nil)(9007199254740992)),
}
for value8, _4 in {} do
    out("L17", (if true then math.clamp else nil)(value8, -4, 4))
    local rawequal2 = rawequal
    local result2 = if 0 / 0 then false else 0
    result2 = result2 and true
    if rawequal2(result2, "😀") then
        local _5 = `\{braces}hello`
    end
end
local s147 = ("%d%%" .. math.pi % 7) .. 10000000000 / (if true then math.min else nil)(2, 0 / 0)
local value9 = -100 % (1 * 1)
local out5 = out
local value10 = 3.5 + tonumber(" 7 ")
local list3 = { value9, select("#", ...) }
out5("L18", if not (-0 <= value10) then false else true, list3)
for i3 = 1, (if true then math.min else nil)(#tostring(123456789.125), 4) do
    if i3 <= -0 then
        continue
    end
    if not (tonumber(" 7 ") > 1.7976931348623157e+308) then
    end
end
out("L19", list3, s147, data2)
local n155 = #"end"
n155 += #("-3.5" .. n155)

local function f163(p157, p158)
    out("L20", true, p158, false, (if true then string.format else nil)("%s|%g", "tab\there", 1e-7):sub(1, 2) .. tostring(true))
    local value = (if true then math.clamp else nil)(-5, -4, 4)
    if not (tonumber("1e3") <= value) then
    end
    return (if true then math.sign else nil)(-1 / 0) == 0 / 0, (if true then math.ceil else nil)((if true then math.min else nil)(n155, 2))
end

out("L21", n155)

local function range165(n: number)
    local i: number = 0
    return function()
        i += 1
        if i <= n then
            return i, i * i
        end
        return nil
    end
end

local list4 = {}
for key2, value11 in (if true then range165 else nil)(4) do
    (if true then table.insert else nil)(list4, key2 + value11)
end
out("L22", list4)
local list5 = {}
for key3 in pairs({ ["x"] = 1, ["y"] = 2, ["two words"] = 3, [10] = 4 }) do
    (if true then table.insert else nil)(list5, tostring(key3))
end;
(if true then table.sort else nil)(list5)
out("L23", (if true then table.concat else nil)(list5, ","))
local count3 = #list4
local list6 = {}
for i4 = count3, 1, -1 do
    (if true then table.insert else nil)(list6, list4[i4])
end

local function stateless(t, i)
    i += 1
    if t[i] then
        return i, t[i]
    end
    return nil
end

for key4, value12 in stateless, list6, 0 do
    list4[key4] = value12 * 2
end
out("L24", list6, list4)
local s168 = (if true then string.format else nil)("%s|%g", `long\nstring{`😀\000nul`}`, -2.5)
for _6 in (if true then string.gmatch else nil)("", "%w+") do
    for i5 = 3, 1 do
        out("L25", 123456789.125, select("#", ...) - (10000000000 // 100) ^ 2, s168)
    end
    local a174 = nil
    local f186
    do
        local s1682
        s1682 = s168
        function f186(p176, p177, p178)
            local out2 = out
            local result = 0 / 0 and false
            local flag: boolean = true
            if p176 == "a]]b" .. 65536 then
                flag = true
            end
            out2("L26", result, flag)
            a174 = if rawequal(0.0025, false) then if p178 < 127 then "s" else p178 or not true else not true
            local s184 = ("%d%%"):sub(0, 3) .. tostring((if true then string.len else nil)(s1682))
            return s1682, `--not a commenthello`
        end

    end
    local function f206(a2, b, c, ...)
        if not ((if true then math.round else nil)(1000) <= 10000000000 // c / c) then
            local b196: boolean = false
        end
        if "]]" <= tostring(127) then
        end
        for _, _2 in { tonumber("10"), -0 } do
            local list = {}
            list[1], list[2] = "nil", if c < 10 then (if true then string.rep else nil)("x y", 0) else "quote\"s" .. -1
        end
    end

end
out("L27", s168)
