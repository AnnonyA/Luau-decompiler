-- [[ annonya.github.io ]] v0.2.0 | decompiled at 2026-11-27T18:43:16Z
-- Luau bytecode version: 14 | Luau type version: 3

local list = {}
for index = 1, 3 do
    local j = index * 1
    list[index] = function(x)
        j += x
        return index + j
    end

end
out("L1", (if true then list[1] else nil)(1), (if true then list[1] else nil)(1), (if true then list[3] else nil)(2))
local sharedCounter: number = 0
local list2 = {}
while sharedCounter < 3 do
    sharedCounter += 1
    local c = sharedCounter * 10
    if sharedCounter ~= 2 then
        list2[sharedCounter] = function()
            c += 1
            return c, sharedCounter
        end

    end
end
out("L2", (if true then list2[1] else nil)(), (if true then list2[1] else nil)(), list2[3] and (if true then list2[3] else nil)(), sharedCounter)
local b3 = not rawequal(0 and false, true)
local a5 = nil
local n7: number? = tonumber("-3.5")
for value, value2 in {
    (if true then math.max else nil)(n7, -2.5),
    (if true then string.len else nil)("  spaced  "),
    127 + 2,
} do
    local a13 = nil
    local function_3
    do
        local n72
        n72 = n7
        function_3 = function(p15, p16)
            local formatted = not (0 / 0)
            if formatted == (a13 and (a13 or true)) then
                local _ = (if true then math.sign else nil)(value)
            else
                formatted = if 0 / 0 then not (p16 or false) else ("end%*{x}%*"):format(p16, n72)
                if formatted then
                    out("L3", value2, (if true then math.clamp else nil)(value, -4, 4), "nil", p15)
                    local _2 = (" | %*end%*"):format(p16 and p16, math.pi)
                else
                    for _3, _4 in {} do
                        out("L4", (if true then string.format else nil)("%s|%g", "quote\"s", #("{x}%*%*"):format(nil, 255)), b3, not true)
                        if (if true then math.clamp else nil)(3.5, -4, 4) - 0.5 ~= #"end" - math.huge then
                        end
                    end
                end
            end
            local data = {
                ["two words"] = (if true then math.max else nil)(1.7976931348623157e+308, 1e-7) + -1,
                [1.5] = ((if true then string.format else nil)("%s|%g", ("v=%*{x}%*"):format(a13, 7), 10 ^ 3)),
            }
            if data["two words"] ~= 100 then
                if not (value2 > 65536) then
                    return value2, type(0) == "boolean"
                end
                local count: number = 0
                local result
                while count < 3 do
                    if data["two words"] >= 1e-7 then
                        break
                    end
                    if not a5 then
                        break
                    end
                    count += 1
                    local out2 = out
                    result = true
                    if not (value // data["two words"] < 1e-7 / 100) then
                        result = false
                    end
                    out2("L5", result, "-3.5")
                end
                return -2.5, true
            end
            local count2: number = 0
            local result2
            while count2 < 3 do
                if data["two words"] >= 1e-7 then
                    break
                end
                if not a5 then
                    break
                end
                count2 += 1
                local out3 = out
                result2 = true
                if not (value // data["two words"] < 1e-7 / 100) then
                    result2 = false
                end
                out3("L5", result2, "-3.5")
            end
            return -2.5, true
        end

    end
end
out("L6", n7, a5, b3)
local result: string = "end"
local count: number = 0
repeat
    count += 1;
    ({
        ["1abc"] = ((if true then string.len else nil)((if true then string.rep else nil)("%d%%", 3))),
    })["name"] = if math.huge > 0.5 then 0 / 0 else -2.5 + 1e-7
    local list3 = {
        (if true then string.format else nil)("%s|%g", ("v=%*%*"):format(true, 1 / 0), 1.7976931348623157e+308),
        "single" .. result,
        tostring(false),
    }
    if count >= 4 then
        break
    end
    if true and "s" then
        break
    end
    if not nil then
    end
until 0
local count2: number = 0
while count2 < 4 do
    count2 += 1
    if math.huge * (if true then math.max else nil)(math.huge, 10000000000) < -(-0) then
        result = (("long\nstring" .. "\000nul") .. ("a"):lower()) .. (if 3.5 ~= 100 then "[[" else "]]")
    elseif not false and not (tonumber("10") < 123456789.125) then
        if -1 >= 0.30000000000000004 then
            local _ = (if true then math.ceil else nil)((if true then math.abs else nil)(if true then 10 else 10))
        end
    else
        local _2: number? = tonumber(" 7 ")
    end
end
out("L7", count2, count, result)
local out2 = out
local value3: string = "L8"
count2 = if rawequal(0 / 0, 0 / 0) then if false then not 0 and "s" else "s" else not 0 and "s"
local max = math.max
max = (if true then max else nil)(1 / 0, 0.0025) and (if not 0 then "s" else false)
out2(value3, count2, 10000000000, max)
if not true then
    if true and 1 / 0 > 10 then
        value3 = if type(true) == "nil" and nil then 0 / 0 or false or -1 / 0 > 0.1 else false or -1 / 0 > 0.1
    else
        value3 = -1 / 0 > 0.1
    end
elseif 1 / 0 > 10 then
    value3 = if type(true) == "nil" and nil then 0 / 0 or false or -1 / 0 > 0.1 else false or -1 / 0 > 0.1
else
    value3 = -1 / 0 > 0.1
end
local value4 = 2 ^ 53
local result2 = "]]" .. 1 / 0
local b58 = "-3.5" == tostring((if true then math.clamp else nil)(123456789.125, -4, 4))
if rawequal(not (true or "s"), value3) then
    out("L9", "quote\"s", if -0.1 < 9007199254740992 // -1 then (1 * -0) ^ 2 else value4, result2)
    for key, _3 in next, {} do
        result2 ..= `a]]` .. 123456789.125
        if 0 then
            local field = ((if true then string.format else nil)("%s|%g", tostring(10000000000), 4294967296))
            local value5 = (if true then math.max else nil)(7, key)
            local list4 = { [1e+300] = field }
            list4["end"] = value5 + (if false then 255 else 2)
            list4[1] = (#"\000nul") ^ 0.25
            list4["_hidden"] = not (false == nil)
            break
        end
        if key ~= (if 0.30000000000000004 >= 255 then 0 else (if true then string.len else nil)("%d%%")) then
            local field2 = -1
            local value6 = -1
            local value7: string = "AA"
            local data = { [field2] = 1000 }
            if true then
                if "--not a comment" <= value7 then
                    local floor = math.floor
                    floor = (if true then floor else nil)(1000 + math.huge)
                    data[value6] = floor
                else
                    data[value6] = 1
                end
            else
                if "nil" <= value7 then
                    local floor2 = (if true then math.floor else nil)(1000 + math.huge)
                    data[value6] = floor2
                else
                    data[value6] = 1
                end
            end
        end
        local list5 = { result2 }
    end
elseif false then
    for i = 3, 1 do
        local n74 = value4
        count2 = 0
        while count2 < 4 do
            if 0 / 0 then
                break
            end
            count2 += 1
        end
    end
end
out("L10", b58, result2, value4, value3, "s")
if #`😀tab\there` < (if true then -1 else 2 ^ 53) * 127 then
    for key2, value8 in {} do
        out("L11", key2, key2, value8)
        for _4, _5 in { tonumber("0x1F"), 10 ^ 2, (if true then math.clamp else nil)(1000, -4, 4) } do
            local value9: string = "\000nul"
            local s90 = "end" .. ("\000nul"):sub(-2, 2)
            local value10: number = 1.5
            local flag: boolean = true
            local data2 = { ["count"] = tonumber("-3.5"), ["y"] = value9 }
            if not (s90 <= value9) then
                flag = true
                data2[value10] = flag
                continue
            end
            data2[value10] = flag
        end
        for i2 = 0, 1, 0.25 do
            local out3 = out
            local value11: string = "L12"
            if 9007199254740992 ~= 0 then
                local value12 = `\{braces}\{braces}` .. #"-3.5" % select("#", ...)
                local value13 = -value8
                if (if true then math.clamp else nil)(1.7976931348623157e+308, -4, 4) == select("#", ...) then
                    local result3: string = "s"
                    if not result3 then
                        result3 = "s"
                        out3(value11, i2, value12, value13, result3)
                    else
                        out3(value11, i2, value12, value13, result3)
                    end
                else
                    out3(value11, i2, value12, value13, "s")
                end
            else
                local value14 = `x y😀` .. #"-3.5" % select("#", ...)
                local value15 = -value8
                if (if true then math.clamp else nil)(1.7976931348623157e+308, -4, 4) == select("#", ...) then
                    local result4: string = "s"
                    if not result4 then
                        result4 = "s"
                        out3(value11, i2, value14, value15, result4)
                    else
                        out3(value11, i2, value14, value15, result4)
                    end
                else
                    out3(value11, i2, value14, value15, "s")
                end
            end
        end
    end
    if true then
        if false then
            if true then
                if not "s" then
                    if not false then
                        if not true then
                            if 0 then
                                if not 0 then
                                    for _6, _7 in {
                                        (if true then math.clamp else nil)(255, -4, 4),
                                        (if true then math.ceil else nil)(-0),
                                    } do
                                        if false then
                                            continue
                                        end
                                        if false then
                                            continue
                                        end
                                        local value16 = (if true then string.rep else nil)("end", 1) .. "10"
                                        local result5, value17 = (if true then string.format else nil)("%s|%g", "-3.5", select("#", ...))
                                    end
                                else
                                    if (if true then string.len else nil)("]]") <= (if true then math.clamp else nil)(-2.5, -4, 4) + 0.0025 // 1e+300 then
                                        if select("#", ...) == 100 then
                                        else
                                            if rawequal(not (true or 0), false) or 127 == -0 then
                                            end
                                        end
                                    end
                                end
                            else
                                for _8, _9 in {
                                    (if true then math.clamp else nil)(255, -4, 4),
                                    (if true then math.ceil else nil)(-0),
                                } do
                                    if false then
                                        continue
                                    end
                                    if false then
                                        continue
                                    end
                                    local value18 = (if true then string.rep else nil)("end", 1) .. "10"
                                    local result6, value19 = (if true then string.format else nil)("%s|%g", "-3.5", select("#", ...))
                                end
                            end
                        else
                            for _10, _11 in {
                                (if true then math.clamp else nil)(255, -4, 4),
                                (if true then math.ceil else nil)(-0),
                            } do
                                if false then
                                    continue
                                end
                                if false then
                                    continue
                                end
                                local value20 = (if true then string.rep else nil)("end", 1) .. "10"
                                local result7, value21 = (if true then string.format else nil)("%s|%g", "-3.5", select("#", ...))
                            end
                        end
                    else
                        for _12, _13 in {
                            (if true then math.clamp else nil)(255, -4, 4),
                            (if true then math.ceil else nil)(-0),
                        } do
                            if false then
                                continue
                            end
                            if false then
                                continue
                            end
                            local value22 = (if true then string.rep else nil)("end", 1) .. "10"
                            local result8, value23 = (if true then string.format else nil)("%s|%g", "-3.5", select("#", ...))
                        end
                    end
                else
                    for _14, _15 in {
                        (if true then math.clamp else nil)(255, -4, 4),
                        (if true then math.ceil else nil)(-0),
                    } do
                        if false then
                            continue
                        end
                        if false then
                            continue
                        end
                        local value24 = (if true then string.rep else nil)("end", 1) .. "10"
                        local result9, value25 = (if true then string.format else nil)("%s|%g", "-3.5", select("#", ...))
                    end
                end
            elseif not false then
                if not true then
                    if 0 then
                        if not 0 then
                            for _16, _17 in {
                                (if true then math.clamp else nil)(255, -4, 4),
                                (if true then math.ceil else nil)(-0),
                            } do
                                if false then
                                    continue
                                end
                                if false then
                                    continue
                                end
                                local value26 = (if true then string.rep else nil)("end", 1) .. "10"
                                local result10, value27 = (if true then string.format else nil)("%s|%g", "-3.5", select("#", ...))
                            end
                        else
                            if (if true then string.len else nil)("]]") <= (if true then math.clamp else nil)(-2.5, -4, 4) + 0.0025 // 1e+300 then
                                if select("#", ...) == 100 then
                                else
                                    if rawequal(not (true or 0), false) or 127 == -0 then
                                    end
                                end
                            end
                        end
                    else
                        for _18, _19 in {
                            (if true then math.clamp else nil)(255, -4, 4),
                            (if true then math.ceil else nil)(-0),
                        } do
                            if false then
                                continue
                            end
                            if false then
                                continue
                            end
                            local value28 = (if true then string.rep else nil)("end", 1) .. "10"
                            local result11, value29 = (if true then string.format else nil)("%s|%g", "-3.5", select("#", ...))
                        end
                    end
                else
                    for _20, _21 in {
                        (if true then math.clamp else nil)(255, -4, 4),
                        (if true then math.ceil else nil)(-0),
                    } do
                        if false then
                            continue
                        end
                        if false then
                            continue
                        end
                        local value30 = (if true then string.rep else nil)("end", 1) .. "10"
                        local result12, value31 = (if true then string.format else nil)("%s|%g", "-3.5", select("#", ...))
                    end
                end
            else
                for _22, _23 in {
                    (if true then math.clamp else nil)(255, -4, 4),
                    (if true then math.ceil else nil)(-0),
                } do
                    if false then
                        continue
                    end
                    if false then
                        continue
                    end
                    local value32 = (if true then string.rep else nil)("end", 1) .. "10"
                    local result13, value33 = (if true then string.format else nil)("%s|%g", "-3.5", select("#", ...))
                end
            end
        elseif not false then
            if not true then
                if 0 then
                    if not 0 then
                        for _24, _25 in {
                            (if true then math.clamp else nil)(255, -4, 4),
                            (if true then math.ceil else nil)(-0),
                        } do
                            if false then
                                continue
                            end
                            if false then
                                continue
                            end
                            local value34 = (if true then string.rep else nil)("end", 1) .. "10"
                            local result14, value35 = (if true then string.format else nil)("%s|%g", "-3.5", select("#", ...))
                        end
                    else
                        if (if true then string.len else nil)("]]") <= (if true then math.clamp else nil)(-2.5, -4, 4) + 0.0025 // 1e+300 then
                            if select("#", ...) == 100 then
                            else
                                if rawequal(not (true or 0), false) or 127 == -0 then
                                end
                            end
                        end
                    end
                else
                    for _26, _27 in {
                        (if true then math.clamp else nil)(255, -4, 4),
                        (if true then math.ceil else nil)(-0),
                    } do
                        if false then
                            continue
                        end
                        if false then
                            continue
                        end
                        local value36 = (if true then string.rep else nil)("end", 1) .. "10"
                        local result15, value37 = (if true then string.format else nil)("%s|%g", "-3.5", select("#", ...))
                    end
                end
            else
                for _28, _29 in {
                    (if true then math.clamp else nil)(255, -4, 4),
                    (if true then math.ceil else nil)(-0),
                } do
                    if false then
                        continue
                    end
                    if false then
                        continue
                    end
                    local value38 = (if true then string.rep else nil)("end", 1) .. "10"
                    local result16, value39 = (if true then string.format else nil)("%s|%g", "-3.5", select("#", ...))
                end
            end
        else
            for _30, _31 in {
                (if true then math.clamp else nil)(255, -4, 4),
                (if true then math.ceil else nil)(-0),
            } do
                if false then
                    continue
                end
                if false then
                    continue
                end
                local value40 = (if true then string.rep else nil)("end", 1) .. "10"
                local result17, value41 = (if true then string.format else nil)("%s|%g", "-3.5", select("#", ...))
            end
        end
    elseif not false then
        if not true then
            if 0 then
                if not 0 then
                    for _32, _33 in {
                        (if true then math.clamp else nil)(255, -4, 4),
                        (if true then math.ceil else nil)(-0),
                    } do
                        if false then
                            continue
                        end
                        if false then
                            continue
                        end
                        local value42 = (if true then string.rep else nil)("end", 1) .. "10"
                        local result18, value43 = (if true then string.format else nil)("%s|%g", "-3.5", select("#", ...))
                    end
                else
                    if (if true then string.len else nil)("]]") <= (if true then math.clamp else nil)(-2.5, -4, 4) + 0.0025 // 1e+300 then
                        if select("#", ...) == 100 then
                        else
                            if rawequal(not (true or 0), false) or 127 == -0 then
                            end
                        end
                    end
                end
            else
                for _34, _35 in {
                    (if true then math.clamp else nil)(255, -4, 4),
                    (if true then math.ceil else nil)(-0),
                } do
                    if false then
                        continue
                    end
                    if false then
                        continue
                    end
                    local value44 = (if true then string.rep else nil)("end", 1) .. "10"
                    local result19, value45 = (if true then string.format else nil)("%s|%g", "-3.5", select("#", ...))
                end
            end
        else
            for _36, _37 in {
                (if true then math.clamp else nil)(255, -4, 4),
                (if true then math.ceil else nil)(-0),
            } do
                if false then
                    continue
                end
                if false then
                    continue
                end
                local value46 = (if true then string.rep else nil)("end", 1) .. "10"
                local result20, value47 = (if true then string.format else nil)("%s|%g", "-3.5", select("#", ...))
            end
        end
    else
        for _38, _39 in {
            (if true then math.clamp else nil)(255, -4, 4),
            (if true then math.ceil else nil)(-0),
        } do
            if false then
                continue
            end
            if false then
                continue
            end
            local value48 = (if true then string.rep else nil)("end", 1) .. "10"
            local result21, value49 = (if true then string.format else nil)("%s|%g", "-3.5", select("#", ...))
        end
    end
elseif true then
else
    if (if true then math.abs else nil)(-0) * (if true then math.clamp else nil)(1 / 0, -4, 4) then
    end
end
out("L13")
local tbl = {}
for _40, _41 in { if true then 100 else -2.5, -0 / -0, tonumber(" 7 ") } do
    if if false then if not 0 then if true then 0 / 0 else 0 / 0 or "s" else 0 / 0 else if true then 0 / 0 else 0 / 0 or "s" then
        break
    end
end
local list6 = {}
list6[1], list6[2] = (if false then -0 else 255) + (if true then math.min else nil)(math.pi, 123456789.125), 1 ^ 0 // 1e+300
local out4 = out
local rawequal2 = rawequal
local result22 = "s" or not "s"
local result23 = true or 0 / 0 or false and 0 / 0
out4("L14", rawequal2(result22, result23), list6)
local out5 = out
result23 = 0.5 < (if false then 1000 else 100) - 123456789.125
out5("L15", list6, 1.7976931348623157e+308, result23);
(if true then table.insert else nil)(list6, -(if true then math.abs else nil)(list6[2]))
if "\000nul" < (if true then string.rep else nil)(`--not a comment[[`, 2) then
    count2 = 0
    while count2 < 1 do
        if rawequal(0 / 0, true) then
            break
        end
        count2 += 1
    end
elseif #"\255\128" >= 255 then
else
    local count3 = select("#", ...)
end
out("L16", "back\\slash", list6)
local ok1, e1 = pcall(error, "plain")
local ok2, e2 = pcall(function()
    error({ ["code"] = 5 })
end)
local ok3, e3 = pcall(function()
    local z = nil
    return z.field
end)

local function protected3(t)
    return 1 + t
end

local ok4, e4 = pcall(protected3, {})
local ok5, e5 = pcall(function(a)
    if a > 1 then
        error("big " .. a, 0)
    end
    return a
end, -1)
local ok6, e6 = xpcall(function()
    error("x")
end, function(m)
    return "handled: " .. m
end)
local ok7, e7, e8 = pcall(pcall, error, "nested")
local ok9, e9 = pcall(error)
out("L17", ok1, e1, ok2, e2.code, ok3, e3, ok4, e4, ok5, e5, ok6, e6, ok7, e7, e8, ok9, e9)
if "s" ~= 0 then
    if not false then
        if false ~= false then
            local n118 = 0 / 0 + (0.5 ^ 0 - #"AA")
            local _42 = n118 / 100
            for _43, _44 in { -0.1, 4294967296 ^ 3, 65536 } do
                local n124 = #(if true then string.format else nil)("%s|%g", ("\n"):sub(2, -1), math.pi + math.pi)
                if 7 >= 0.5 then
                    if 0 and "s" then
                        local a126: number = 0
                    end
                elseif "s" then
                    local a1262: number = 0
                end
                for i3 = 1, (if true then math.min else nil)(#`[[end`, 4), 1 do
                    local s130 = (`%d%%\255\128`):sub(1, 2) .. "😀"
                    local a132: string = "s"
                    local value50 = "-3.5" .. ("x y" .. "0x1F") .. #"back\\slash"
                end
            end
        else
            if "s" == (true and not true) then
            end
        end
    else
        local _45 = (0 / 0 + (0.5 ^ 0 - #"AA")) / 100
        for _46, _47 in { -0.1, 4294967296 ^ 3, 65536 } do
            local n1242 = #(if true then string.format else nil)("%s|%g", ("\n"):sub(2, -1), math.pi + math.pi)
            if 7 >= 0.5 then
                if 0 and "s" then
                    local a1263: number = 0
                end
            elseif "s" then
                local a1264: number = 0
            end
            for i4 = 1, (if true then math.min else nil)(#`[[end`, 4), 1 do
                local s1302 = (`%d%%\255\128`):sub(1, 2) .. "😀"
                local a1322: string = "s"
                local value51 = "-3.5" .. ("x y" .. "0x1F") .. #"back\\slash"
            end
        end
    end
else
    local _48 = (0 / 0 + (0.5 ^ 0 - #"AA")) / 100
    for _49, _50 in { -0.1, 4294967296 ^ 3, 65536 } do
        local n1243 = #(if true then string.format else nil)("%s|%g", ("\n"):sub(2, -1), math.pi + math.pi)
        if 7 >= 0.5 then
            if 0 and "s" then
                local a1265: number = 0
            end
        elseif "s" then
            local a1266: number = 0
        end
        for i5 = 1, (if true then math.min else nil)(#`[[end`, 4), 1 do
            local s1303 = (`%d%%\255\128`):sub(1, 2) .. "😀"
            local a1323: string = "s"
            local value52 = "-3.5" .. ("x y" .. "0x1F") .. #"back\\slash"
        end
    end
end
out("L18")
local tbl2 = {}
tbl2.__index = tbl2

function tbl2.new(x)
    return setmetatable({ ["x"] = x }, tbl2)
end

function tbl2:get()
    return self.x
end

function tbl2:add(n)
    self.x += n
    return self
end

function tbl2:__le(q)
    local x = self.x
    return x <= q.x
end

function tbl2:__unm()
    return -self.x
end

local config39 = (if true then tbl2.new else nil)(10)
local o2 = (if true then tbl2.new else nil)(-1)
out("L19", config39:get(), config39:add(2):get(), config39 <= o2, o2 <= config39, -config39)
local sharedCounter2: number = 0
while sharedCounter2 < 1 do
    sharedCounter2 += 1
    count2 = 0
    repeat
        count2 += 1;
        ({})["y"] = ("%*v=%*"):format(nil or 0 / 0, 65536 + -5)
        for _51 in (if true then string.gmatch else nil)("a bb ccc", "%w+") do
            local data3 = { ["y"] = -1, ["nil"] = -(0 - -5) }
        end
        local data4 = { [2] = "😀", [-1] = ("{x}%* | %*"):format("s", #"\r\t\011\012\007\008") }
    until count2 >= 3 or `-3.5\{braces}` == "]]"
end
local n149: number = 1e-7
out("L20", sharedCounter2)
local out6 = out
local result24 = 100 + -1.7976931348623157e+308 ~= tonumber(" 7 ") ^ 0.25
local result25 = type("s") == "number"
local value53 = not result25
result25 = (if true then math.clamp else nil)(tonumber("1e3"), -4, 4) == sharedCounter2
out6("L21", result24, value53, result25, n149)
local s151 = (if true then string.format else nil)("%s|%g", "a", select("#", ...))
local s1512: string = tostring(sharedCounter2 % 0.5 / 3.5)
local out7 = out
local list7 = { 10000000000 }
out7("L22", -(if s1512 < "long\nstring" then tonumber("10") else 10000000000), sharedCounter2, n149)

local function f169(p155, p156)
    for _, _2 in next, list7 do
        if type("s") == "boolean" then
            break
        end
        if type("s") == "string" then
            break
        end
        local repeatCount: number = 0
        repeat
            repeatCount += 1
            local u166: number? = tonumber("0x1F")
            p155 += 3.5
            s1512 ..= (if true then string.rep else nil)(s1512, 2) .. "single"
        until repeatCount >= 2
    end
    return list7[1], -(0.5 - sharedCounter2), -1
end

out("L23", list7, s1512, n149, sharedCounter2)
local result26 = nil
for key3, value54 in { 65536 } do
    count2 = 0
    while count2 < 3 do
        count2 += 1
        for i6 = 1, 4 do
            count2 = result26 and nil and result26 and (if 0 then "s" else "s")
            result26 = count2
            local s180 = `{`x y-3.5`}--not a comment` .. 5e-324 + -2.5 + -1
            local a182 = result26
            local _52 = -(10 * (-1 / 0) - (if true then math.clamp else nil)(0.1, -4, 4))
        end
        local type2 = type
        count2 = 0
        if count2 then
            count2 = true
            if not count2 then
                count2 = 0 / 0
                if type2(count2) == "nil" then
                    local n186: number = 3
                    local b188 = "a" .. value54 - value54 == ("long\nstring" .. "\n") .. "--not a comment"
                    if true then
                        if not result26 then
                            if result26 then
                                if false then
                                    if not nil and not "s" then
                                        if b188 then
                                            if not false and not "s" then
                                            else
                                            end
                                        elseif not "s" then
                                        else
                                        end
                                    else
                                    end
                                elseif not "s" then
                                    if b188 then
                                        if not false and not "s" then
                                        else
                                        end
                                    elseif not "s" then
                                    else
                                    end
                                else
                                end
                            else
                                local a190: boolean = false
                                if false then
                                    if not nil and not "s" then
                                        if b188 then
                                            if not false and not "s" then
                                            else
                                            end
                                        elseif not "s" then
                                        else
                                        end
                                    else
                                    end
                                elseif not "s" then
                                    if b188 then
                                        if not false and not "s" then
                                        else
                                        end
                                    elseif not "s" then
                                    else
                                    end
                                else
                                end
                            end
                        elseif false then
                            if not nil and not "s" then
                                if b188 then
                                    if not false and not "s" then
                                    else
                                    end
                                elseif not "s" then
                                else
                                end
                            else
                            end
                        elseif not "s" then
                            if b188 then
                                if not false and not "s" then
                                else
                                end
                            elseif not "s" then
                            else
                            end
                        else
                        end
                    elseif false then
                        if not nil and not "s" then
                            if b188 then
                                if not false and not "s" then
                                else
                                end
                            elseif not "s" then
                            else
                            end
                        else
                        end
                    elseif not "s" then
                        if b188 then
                            if not false and not "s" then
                            else
                            end
                        elseif not "s" then
                        else
                        end
                    else
                    end
                else
                    local rawequal3 = rawequal
                    local flag2: boolean = true
                    if not flag2 then
                        flag2 = "tab\there"
                        local result27: string = "s"
                        if not result27 then
                            result27 = true
                            if rawequal3(flag2, not result27) then
                                out("L24", select("#", ...))
                            else
                                local list8 = {
                                    math.huge,
                                    select("#", ...) * key3 ^ (-1),
                                    tonumber(" 7 "),
                                    key3,
                                    (if true then math.clamp else nil)((if true then math.min else nil)(0.1, -1), -4, 4),
                                }
                            end
                        elseif rawequal3(flag2, not result27) then
                            out("L24", select("#", ...))
                        else
                            local list9 = {
                                math.huge,
                                select("#", ...) * key3 ^ (-1),
                                tonumber(" 7 "),
                                key3,
                                (if true then math.clamp else nil)((if true then math.min else nil)(0.1, -1), -4, 4),
                            }
                        end
                    else
                        local result28: string = "s"
                        if not result28 then
                            result28 = true
                            if rawequal3(flag2, not result28) then
                                out("L24", select("#", ...))
                            else
                                local list10 = {
                                    math.huge,
                                    select("#", ...) * key3 ^ (-1),
                                    tonumber(" 7 "),
                                    key3,
                                    (if true then math.clamp else nil)((if true then math.min else nil)(0.1, -1), -4, 4),
                                }
                            end
                        elseif rawequal3(flag2, not result28) then
                            out("L24", select("#", ...))
                        else
                            local list11 = {
                                math.huge,
                                select("#", ...) * key3 ^ (-1),
                                tonumber(" 7 "),
                                key3,
                                (if true then math.clamp else nil)((if true then math.min else nil)(0.1, -1), -4, 4),
                            }
                        end
                    end
                end
            else
                if type2(count2) == "nil" then
                    local n1862: number = 3
                    local b1882 = "a" .. value54 - value54 == ("long\nstring" .. "\n") .. "--not a comment"
                    if true then
                        if not result26 then
                            if result26 then
                                if false then
                                    if not nil and not "s" then
                                        if b1882 then
                                            if not false and not "s" then
                                            else
                                            end
                                        elseif not "s" then
                                        else
                                        end
                                    else
                                    end
                                elseif not "s" then
                                    if b1882 then
                                        if not false and not "s" then
                                        else
                                        end
                                    elseif not "s" then
                                    else
                                    end
                                else
                                end
                            else
                                local a1902: boolean = false
                                if false then
                                    if not nil and not "s" then
                                        if b1882 then
                                            if not false and not "s" then
                                            else
                                            end
                                        elseif not "s" then
                                        else
                                        end
                                    else
                                    end
                                elseif not "s" then
                                    if b1882 then
                                        if not false and not "s" then
                                        else
                                        end
                                    elseif not "s" then
                                    else
                                    end
                                else
                                end
                            end
                        elseif false then
                            if not nil and not "s" then
                                if b1882 then
                                    if not false and not "s" then
                                    else
                                    end
                                elseif not "s" then
                                else
                                end
                            else
                            end
                        elseif not "s" then
                            if b1882 then
                                if not false and not "s" then
                                else
                                end
                            elseif not "s" then
                            else
                            end
                        else
                        end
                    elseif false then
                        if not nil and not "s" then
                            if b1882 then
                                if not false and not "s" then
                                else
                                end
                            elseif not "s" then
                            else
                            end
                        else
                        end
                    elseif not "s" then
                        if b1882 then
                            if not false and not "s" then
                            else
                            end
                        elseif not "s" then
                        else
                        end
                    else
                    end
                else
                    local rawequal4 = rawequal
                    local flag3: boolean = true
                    if not flag3 then
                        flag3 = "tab\there"
                        local result29: string = "s"
                        if not result29 then
                            result29 = true
                            if rawequal4(flag3, not result29) then
                                out("L24", select("#", ...))
                            else
                                local list12 = {
                                    math.huge,
                                    select("#", ...) * key3 ^ (-1),
                                    tonumber(" 7 "),
                                    key3,
                                    (if true then math.clamp else nil)((if true then math.min else nil)(0.1, -1), -4, 4),
                                }
                            end
                        elseif rawequal4(flag3, not result29) then
                            out("L24", select("#", ...))
                        else
                            local list13 = {
                                math.huge,
                                select("#", ...) * key3 ^ (-1),
                                tonumber(" 7 "),
                                key3,
                                (if true then math.clamp else nil)((if true then math.min else nil)(0.1, -1), -4, 4),
                            }
                        end
                    else
                        local result30: string = "s"
                        if not result30 then
                            result30 = true
                            if rawequal4(flag3, not result30) then
                                out("L24", select("#", ...))
                            else
                                local list14 = {
                                    math.huge,
                                    select("#", ...) * key3 ^ (-1),
                                    tonumber(" 7 "),
                                    key3,
                                    (if true then math.clamp else nil)((if true then math.min else nil)(0.1, -1), -4, 4),
                                }
                            end
                        elseif rawequal4(flag3, not result30) then
                            out("L24", select("#", ...))
                        else
                            local list15 = {
                                math.huge,
                                select("#", ...) * key3 ^ (-1),
                                tonumber(" 7 "),
                                key3,
                                (if true then math.clamp else nil)((if true then math.min else nil)(0.1, -1), -4, 4),
                            }
                        end
                    end
                end
            end
        else
            if type2(count2) == "nil" then
                local n1863: number = 3
                local b1883 = "a" .. value54 - value54 == ("long\nstring" .. "\n") .. "--not a comment"
                if true then
                    if not result26 then
                        if result26 then
                            if false then
                                if not nil and not "s" then
                                    if b1883 then
                                        if not false and not "s" then
                                        else
                                        end
                                    elseif not "s" then
                                    else
                                    end
                                else
                                end
                            elseif not "s" then
                                if b1883 then
                                    if not false and not "s" then
                                    else
                                    end
                                elseif not "s" then
                                else
                                end
                            else
                            end
                        else
                            local a1903: boolean = false
                            if false then
                                if not nil and not "s" then
                                    if b1883 then
                                        if not false and not "s" then
                                        else
                                        end
                                    elseif not "s" then
                                    else
                                    end
                                else
                                end
                            elseif not "s" then
                                if b1883 then
                                    if not false and not "s" then
                                    else
                                    end
                                elseif not "s" then
                                else
                                end
                            else
                            end
                        end
                    elseif false then
                        if not nil and not "s" then
                            if b1883 then
                                if not false and not "s" then
                                else
                                end
                            elseif not "s" then
                            else
                            end
                        else
                        end
                    elseif not "s" then
                        if b1883 then
                            if not false and not "s" then
                            else
                            end
                        elseif not "s" then
                        else
                        end
                    else
                    end
                elseif false then
                    if not nil and not "s" then
                        if b1883 then
                            if not false and not "s" then
                            else
                            end
                        elseif not "s" then
                        else
                        end
                    else
                    end
                elseif not "s" then
                    if b1883 then
                        if not false and not "s" then
                        else
                        end
                    elseif not "s" then
                    else
                    end
                else
                end
            else
                local rawequal5 = rawequal
                local flag4: boolean = true
                if not flag4 then
                    flag4 = "tab\there"
                    local result31: string = "s"
                    if not result31 then
                        result31 = true
                        if rawequal5(flag4, not result31) then
                            out("L24", select("#", ...))
                        else
                            local list16 = {
                                math.huge,
                                select("#", ...) * key3 ^ (-1),
                                tonumber(" 7 "),
                                key3,
                                (if true then math.clamp else nil)((if true then math.min else nil)(0.1, -1), -4, 4),
                            }
                        end
                    elseif rawequal5(flag4, not result31) then
                        out("L24", select("#", ...))
                    else
                        local list17 = {
                            math.huge,
                            select("#", ...) * key3 ^ (-1),
                            tonumber(" 7 "),
                            key3,
                            (if true then math.clamp else nil)((if true then math.min else nil)(0.1, -1), -4, 4),
                        }
                    end
                else
                    local result32: string = "s"
                    if not result32 then
                        result32 = true
                        if rawequal5(flag4, not result32) then
                            out("L24", select("#", ...))
                        else
                            local list18 = {
                                math.huge,
                                select("#", ...) * key3 ^ (-1),
                                tonumber(" 7 "),
                                key3,
                                (if true then math.clamp else nil)((if true then math.min else nil)(0.1, -1), -4, 4),
                            }
                        end
                    elseif rawequal5(flag4, not result32) then
                        out("L24", select("#", ...))
                    else
                        local list19 = {
                            math.huge,
                            select("#", ...) * key3 ^ (-1),
                            tonumber(" 7 "),
                            key3,
                            (if true then math.clamp else nil)((if true then math.min else nil)(0.1, -1), -4, 4),
                        }
                    end
                end
            end
        end
    end
end
out("L25", result26)
