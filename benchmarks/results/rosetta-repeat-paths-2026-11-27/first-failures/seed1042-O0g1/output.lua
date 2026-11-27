-- [[ annonya.github.io ]] v0.2.0 | decompiled at 2026-11-27T18:43:14Z
-- Luau bytecode version: 14 | Luau type version: 3

local list = {}
for index = 1, 3 do
    local sharedCounter = index * 1
    list[index] = function(p)
        sharedCounter += p
        return index + sharedCounter
    end

end
out("L1", (if true then list[1] else nil)(1), (if true then list[1] else nil)(1), (if true then list[3] else nil)(2))
local sharedCounter2: number = 0
local list2 = {}
while sharedCounter2 < 3 do
    sharedCounter2 += 1
    local sharedCounter3 = sharedCounter2 * 10
    if sharedCounter2 ~= 2 then
        list2[sharedCounter2] = function()
            sharedCounter3 += 1
            return sharedCounter3, sharedCounter2
        end

    end
end
out("L2", (if true then list2[1] else nil)(), (if true then list2[1] else nil)(), list2[3] and (if true then list2[3] else nil)(), sharedCounter2)
local value = not rawequal(0 and false, true)
local value2: number? = tonumber("-3.5")
for value3, value4 in {
    (if true then math.max else nil)(value2, -2.5),
    (if true then string.len else nil)("  spaced  "),
    127 + 2,
} do
    local function_3
    do
        local captured
        captured = nil
        function_3 = function(p, p2)
            local formatted = not (0 / 0)
            if formatted == (captured and (captured or true)) then
                local _ = (if true then math.sign else nil)(value3)
            else
                formatted = if 0 / 0 then not (p2 or false) else ("end%*{x}%*"):format(p2, value2)
                if formatted then
                    out("L3", value4, (if true then math.clamp else nil)(value3, -4, 4), "nil", p)
                    local _2 = (" | %*end%*"):format(p2 and p2, math.pi)
                else
                    for _3, _4 in {} do
                        out("L4", (if true then string.format else nil)("%s|%g", "quote\"s", #("{x}%*%*"):format(nil, 255)), value, not true)
                        if (if true then math.clamp else nil)(3.5, -4, 4) - 0.5 ~= #"end" - math.huge then
                        end
                    end
                end
            end
            local data = {
                ["two words"] = (if true then math.max else nil)(1.7976931348623157e+308, 1e-7) + -1,
                [1.5] = ((if true then string.format else nil)("%s|%g", ("v=%*{x}%*"):format(captured, 7), 10 ^ 3)),
            }
            if data["two words"] ~= 100 then
                if not (value4 > 65536) then
                    return value4, type(0) == "boolean"
                end
                local count: number = 0
                local result
                while count < 3 do
                    if data["two words"] >= 1e-7 then
                        break
                    end
                    if not nil then
                        break
                    end
                    count += 1
                    local out2 = out
                    result = true
                    if not (value3 // data["two words"] < 1e-7 / 100) then
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
                if not nil then
                    break
                end
                count2 += 1
                local out3 = out
                result2 = true
                if not (value3 // data["two words"] < 1e-7 / 100) then
                    result2 = false
                end
                out3("L5", result2, "-3.5")
            end
            return -2.5, true
        end

    end
end
out("L6", value2, nil, value)
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
local value5: string = "L8"
count2 = if rawequal(0 / 0, 0 / 0) then if false then not 0 and "s" else "s" else not 0 and "s"
local max = math.max
max = (if true then max else nil)(1 / 0, 0.0025) and (if not 0 then "s" else false)
out2(value5, count2, 10000000000, max)
if not true then
    if true and 1 / 0 > 10 then
        value5 = if type(true) == "nil" and nil then 0 / 0 or false or -1 / 0 > 0.1 else false or -1 / 0 > 0.1
    else
        value5 = -1 / 0 > 0.1
    end
elseif 1 / 0 > 10 then
    value5 = if type(true) == "nil" and nil then 0 / 0 or false or -1 / 0 > 0.1 else false or -1 / 0 > 0.1
else
    value5 = -1 / 0 > 0.1
end
local value7 = 2 ^ 53
local result2 = "]]" .. 1 / 0
local result3 = "-3.5" == tostring((if true then math.clamp else nil)(123456789.125, -4, 4))
if rawequal(not (true or "s"), value5) then
    out("L9", "quote\"s", if -0.1 < 9007199254740992 // -1 then (1 * -0) ^ 2 else value7, result2)
    for key, _3 in next, {} do
        result2 ..= `a]]` .. 123456789.125
        if 0 then
            local field = ((if true then string.format else nil)("%s|%g", tostring(10000000000), 4294967296))
            local value8 = (if true then math.max else nil)(7, key)
            local list4 = { [1e+300] = field }
            list4["end"] = value8 + (if false then 255 else 2)
            list4[1] = (#"\000nul") ^ 0.25
            list4["_hidden"] = not (false == nil)
            break
        end
        if key ~= (if 0.30000000000000004 >= 255 then 0 else (if true then string.len else nil)("%d%%")) then
            local field2 = -1
            local value9 = -1
            local value10: string = "AA"
            local data = { [field2] = 1000 }
            if true then
                if "--not a comment" <= value10 then
                    local floor = math.floor
                    floor = (if true then floor else nil)(1000 + math.huge)
                    data[value9] = floor
                else
                    data[value9] = 1
                end
            else
                if "nil" <= value10 then
                    local floor2 = (if true then math.floor else nil)(1000 + math.huge)
                    data[value9] = floor2
                else
                    data[value9] = 1
                end
            end
        end
        local list5 = { result2 }
    end
elseif false then
    for i = 3, 1 do
        count2 = 0
        while count2 < 4 do
            if 0 / 0 then
                break
            end
            count2 += 1
        end
    end
end
out("L10", result3, result2, value7, value5, "s")
if #`😀tab\there` < (if true then -1 else 2 ^ 53) * 127 then
    for key2, value11 in {} do
        out("L11", key2, key2, value11)
        for _4, _5 in { tonumber("0x1F"), 10 ^ 2, (if true then math.clamp else nil)(1000, -4, 4) } do
            local value12: string = "\000nul"
            local value13 = "end" .. ("\000nul"):sub(-2, 2)
            local value14: number = 1.5
            local flag: boolean = true
            local data2 = { ["count"] = tonumber("-3.5"), ["y"] = value12 }
            if not (value13 <= value12) then
                flag = true
                data2[value14] = flag
                continue
            end
            data2[value14] = flag
        end
        for i2 = 0, 1, 0.25 do
            local out3 = out
            local value15: string = "L12"
            if 9007199254740992 ~= 0 then
                local value16 = `\{braces}\{braces}` .. #"-3.5" % select("#", ...)
                local value17 = -value11
                if (if true then math.clamp else nil)(1.7976931348623157e+308, -4, 4) == select("#", ...) then
                    local result4: string = "s"
                    if not result4 then
                        result4 = "s"
                        out3(value15, i2, value16, value17, result4)
                    else
                        out3(value15, i2, value16, value17, result4)
                    end
                else
                    out3(value15, i2, value16, value17, "s")
                end
            else
                local value18 = `x y😀` .. #"-3.5" % select("#", ...)
                local value19 = -value11
                if (if true then math.clamp else nil)(1.7976931348623157e+308, -4, 4) == select("#", ...) then
                    local result5: string = "s"
                    if not result5 then
                        result5 = "s"
                        out3(value15, i2, value18, value19, result5)
                    else
                        out3(value15, i2, value18, value19, result5)
                    end
                else
                    out3(value15, i2, value18, value19, "s")
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
                                        local value20 = (if true then string.rep else nil)("end", 1) .. "10"
                                        local result6, value21 = (if true then string.format else nil)("%s|%g", "-3.5", select("#", ...))
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
                                    local value22 = (if true then string.rep else nil)("end", 1) .. "10"
                                    local result7, value23 = (if true then string.format else nil)("%s|%g", "-3.5", select("#", ...))
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
                                local value24 = (if true then string.rep else nil)("end", 1) .. "10"
                                local result8, value25 = (if true then string.format else nil)("%s|%g", "-3.5", select("#", ...))
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
                            local value26 = (if true then string.rep else nil)("end", 1) .. "10"
                            local result9, value27 = (if true then string.format else nil)("%s|%g", "-3.5", select("#", ...))
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
                        local value28 = (if true then string.rep else nil)("end", 1) .. "10"
                        local result10, value29 = (if true then string.format else nil)("%s|%g", "-3.5", select("#", ...))
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
                                local value30 = (if true then string.rep else nil)("end", 1) .. "10"
                                local result11, value31 = (if true then string.format else nil)("%s|%g", "-3.5", select("#", ...))
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
                            local value32 = (if true then string.rep else nil)("end", 1) .. "10"
                            local result12, value33 = (if true then string.format else nil)("%s|%g", "-3.5", select("#", ...))
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
                        local value34 = (if true then string.rep else nil)("end", 1) .. "10"
                        local result13, value35 = (if true then string.format else nil)("%s|%g", "-3.5", select("#", ...))
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
                    local value36 = (if true then string.rep else nil)("end", 1) .. "10"
                    local result14, value37 = (if true then string.format else nil)("%s|%g", "-3.5", select("#", ...))
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
                            local value38 = (if true then string.rep else nil)("end", 1) .. "10"
                            local result15, value39 = (if true then string.format else nil)("%s|%g", "-3.5", select("#", ...))
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
                        local value40 = (if true then string.rep else nil)("end", 1) .. "10"
                        local result16, value41 = (if true then string.format else nil)("%s|%g", "-3.5", select("#", ...))
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
                    local value42 = (if true then string.rep else nil)("end", 1) .. "10"
                    local result17, value43 = (if true then string.format else nil)("%s|%g", "-3.5", select("#", ...))
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
                local value44 = (if true then string.rep else nil)("end", 1) .. "10"
                local result18, value45 = (if true then string.format else nil)("%s|%g", "-3.5", select("#", ...))
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
                        local value46 = (if true then string.rep else nil)("end", 1) .. "10"
                        local result19, value47 = (if true then string.format else nil)("%s|%g", "-3.5", select("#", ...))
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
                    local value48 = (if true then string.rep else nil)("end", 1) .. "10"
                    local result20, value49 = (if true then string.format else nil)("%s|%g", "-3.5", select("#", ...))
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
                local value50 = (if true then string.rep else nil)("end", 1) .. "10"
                local result21, value51 = (if true then string.format else nil)("%s|%g", "-3.5", select("#", ...))
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
            local value52 = (if true then string.rep else nil)("end", 1) .. "10"
            local result22, value53 = (if true then string.format else nil)("%s|%g", "-3.5", select("#", ...))
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
local result23 = "s" or not "s"
local result24 = true or 0 / 0 or false and 0 / 0
out4("L14", rawequal2(result23, result24), list6)
local out5 = out
result24 = 0.5 < (if false then 1000 else 100) - 123456789.125
out5("L15", list6, 1.7976931348623157e+308, result24);
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
local success, result25 = pcall(error, "plain")
local success2, result26 = pcall(function()
    error({ ["code"] = 5 })
end)
local success3, result27 = pcall(function()
    return (nil).field
end)

local function protected3(p)
    return 1 + p
end

local success4, result28 = pcall(protected3, {})
local success5, result29 = pcall(function(p)
    if p > 1 then
        error("big " .. p, 0)
    end
    return p
end, -1)
local success6, result30 = xpcall(function()
    error("x")
end, function(p)
    return "handled: " .. p
end)
local success7, result31, value55 = pcall(pcall, error, "nested")
local success8, result32 = pcall(error)
out("L17", success, result25, success2, result26.code, success3, result27, success4, result28, success5, result29, success6, result30, success7, result31, value55, success8, result32)
if "s" ~= 0 then
    if not false then
        if false ~= false then
            local _42 = (0 / 0 + (0.5 ^ 0 - #"AA")) / 100
            for _43, _44 in { -0.1, 4294967296 ^ 3, 65536 } do
                local count4 = #(if true then string.format else nil)("%s|%g", ("\n"):sub(2, -1), math.pi + math.pi)
                if 7 >= 0.5 then
                    if 0 and "s" then
                        count2 = 0
                    end
                elseif "s" then
                    count2 = 0
                end
                for i3 = 1, (if true then math.min else nil)(#`[[end`, 4), 1 do
                    local value56 = (`%d%%\255\128`):sub(1, 2) .. "😀"
                    local value57: string = "s"
                    local value58 = "-3.5" .. ("x y" .. "0x1F") .. #"back\\slash"
                end
            end
        else
            if "s" == (true and not true) then
            end
        end
    else
        local _45 = (0 / 0 + (0.5 ^ 0 - #"AA")) / 100
        for _46, _47 in { -0.1, 4294967296 ^ 3, 65536 } do
            local count5 = #(if true then string.format else nil)("%s|%g", ("\n"):sub(2, -1), math.pi + math.pi)
            if 7 >= 0.5 then
                if 0 and "s" then
                    count2 = 0
                end
            elseif "s" then
                count2 = 0
            end
            for i4 = 1, (if true then math.min else nil)(#`[[end`, 4), 1 do
                local value59 = (`%d%%\255\128`):sub(1, 2) .. "😀"
                local value60: string = "s"
                local value61 = "-3.5" .. ("x y" .. "0x1F") .. #"back\\slash"
            end
        end
    end
else
    local _48 = (0 / 0 + (0.5 ^ 0 - #"AA")) / 100
    for _49, _50 in { -0.1, 4294967296 ^ 3, 65536 } do
        local count6 = #(if true then string.format else nil)("%s|%g", ("\n"):sub(2, -1), math.pi + math.pi)
        if 7 >= 0.5 then
            if 0 and "s" then
                count2 = 0
            end
        elseif "s" then
            count2 = 0
        end
        for i5 = 1, (if true then math.min else nil)(#`[[end`, 4), 1 do
            local value62 = (`%d%%\255\128`):sub(1, 2) .. "😀"
            local value63: string = "s"
            local value64 = "-3.5" .. ("x y" .. "0x1F") .. #"back\\slash"
        end
    end
end
out("L18")
local tbl2 = {}
tbl2.__index = tbl2

function tbl2.new(initial)
    return setmetatable({ ["x"] = initial }, tbl2)
end

function tbl2:get()
    return self.x
end

function tbl2:add(amount)
    self.x += amount
    return self
end

function tbl2:__le(p)
    return self.x <= p.x
end

function tbl2:__unm()
    return -self.x
end

local config39 = (if true then tbl2.new else nil)(10)
local config392 = (if true then tbl2.new else nil)(-1)
out("L19", config39:get(), config39:add(2):get(), config39 <= config392, config392 <= config39, -config39)
local sharedCounter4: number = 0
while sharedCounter4 < 1 do
    sharedCounter4 += 1
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
local value65: number = 1e-7
out("L20", sharedCounter4)
local out6 = out
local result33 = 100 + -1.7976931348623157e+308 ~= tonumber(" 7 ") ^ 0.25
local result34 = type("s") == "number"
local value66 = not result34
result34 = (if true then math.clamp else nil)(tonumber("1e3"), -4, 4) == sharedCounter4
out6("L21", result33, value66, result34, value65)
local format = string.format
local value67: string = "#"
local value68: string = tostring(sharedCounter4 % 0.5 / 3.5)
local out7 = out
local list7 = { 10000000000 }
out7("L22", -(if value68 < "long\nstring" then tonumber("10") else 10000000000), sharedCounter4, value65)

local function f169(total, p)
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
            local _3: number? = tonumber("0x1F")
            total += 3.5
            value68 ..= (if true then string.rep else nil)(value68, 2) .. "single"
        until repeatCount >= 2
    end
    return list7[1], -(0.5 - sharedCounter4), -1
end

out("L23", list7, value68, value65, sharedCounter4)
local result35 = nil
for key3, value69 in { 65536 } do
    count2 = 0
    while count2 < 3 do
        count2 += 1
        for i6 = 1, 4 do
            count2 = result35 and nil and result35 and (if 0 then "s" else "s")
            result35 = count2
            local _52 = `{`x y-3.5`}--not a comment` .. 5e-324 + -2.5 + -1
            local _53 = -(10 * (-1 / 0) - (if true then math.clamp else nil)(0.1, -4, 4))
        end
        local type2 = type
        count2 = 0
        if count2 then
            count2 = true
            if not count2 then
                count2 = 0 / 0
                if type2(count2) == "nil" then
                    local result36 = "a" .. value69 - value69 == ("long\nstring" .. "\n") .. "--not a comment"
                    if true then
                        if not result35 then
                            if result35 then
                                if false then
                                    if not nil and not "s" then
                                        if result36 then
                                            if not false and not "s" then
                                            else
                                            end
                                        elseif not "s" then
                                        else
                                        end
                                    else
                                    end
                                elseif not "s" then
                                    if result36 then
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
                                    if result36 then
                                        if not false and not "s" then
                                        else
                                        end
                                    elseif not "s" then
                                    else
                                    end
                                else
                                end
                            elseif not "s" then
                                if result36 then
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
                                if result36 then
                                    if not false and not "s" then
                                    else
                                    end
                                elseif not "s" then
                                else
                                end
                            else
                            end
                        elseif not "s" then
                            if result36 then
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
                            if result36 then
                                if not false and not "s" then
                                else
                                end
                            elseif not "s" then
                            else
                            end
                        else
                        end
                    elseif not "s" then
                        if result36 then
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
                        local result37: string = "s"
                        if not result37 then
                            result37 = true
                            if rawequal3(flag2, not result37) then
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
                        elseif rawequal3(flag2, not result37) then
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
                        local result38: string = "s"
                        if not result38 then
                            result38 = true
                            if rawequal3(flag2, not result38) then
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
                        elseif rawequal3(flag2, not result38) then
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
                    local result39 = "a" .. value69 - value69 == ("long\nstring" .. "\n") .. "--not a comment"
                    if true then
                        if not result35 then
                            if result35 then
                                if false then
                                    if not nil and not "s" then
                                        if result39 then
                                            if not false and not "s" then
                                            else
                                            end
                                        elseif not "s" then
                                        else
                                        end
                                    else
                                    end
                                elseif not "s" then
                                    if result39 then
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
                                    if result39 then
                                        if not false and not "s" then
                                        else
                                        end
                                    elseif not "s" then
                                    else
                                    end
                                else
                                end
                            elseif not "s" then
                                if result39 then
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
                                if result39 then
                                    if not false and not "s" then
                                    else
                                    end
                                elseif not "s" then
                                else
                                end
                            else
                            end
                        elseif not "s" then
                            if result39 then
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
                            if result39 then
                                if not false and not "s" then
                                else
                                end
                            elseif not "s" then
                            else
                            end
                        else
                        end
                    elseif not "s" then
                        if result39 then
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
                        local result40: string = "s"
                        if not result40 then
                            result40 = true
                            if rawequal4(flag3, not result40) then
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
                        elseif rawequal4(flag3, not result40) then
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
                        local result41: string = "s"
                        if not result41 then
                            result41 = true
                            if rawequal4(flag3, not result41) then
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
                        elseif rawequal4(flag3, not result41) then
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
                local result42 = "a" .. value69 - value69 == ("long\nstring" .. "\n") .. "--not a comment"
                if true then
                    if not result35 then
                        if result35 then
                            if false then
                                if not nil and not "s" then
                                    if result42 then
                                        if not false and not "s" then
                                        else
                                        end
                                    elseif not "s" then
                                    else
                                    end
                                else
                                end
                            elseif not "s" then
                                if result42 then
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
                                if result42 then
                                    if not false and not "s" then
                                    else
                                    end
                                elseif not "s" then
                                else
                                end
                            else
                            end
                        elseif not "s" then
                            if result42 then
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
                            if result42 then
                                if not false and not "s" then
                                else
                                end
                            elseif not "s" then
                            else
                            end
                        else
                        end
                    elseif not "s" then
                        if result42 then
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
                        if result42 then
                            if not false and not "s" then
                            else
                            end
                        elseif not "s" then
                        else
                        end
                    else
                    end
                elseif not "s" then
                    if result42 then
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
                    local result43: string = "s"
                    if not result43 then
                        result43 = true
                        if rawequal5(flag4, not result43) then
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
                    elseif rawequal5(flag4, not result43) then
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
                    local result44: string = "s"
                    if not result44 then
                        result44 = true
                        if rawequal5(flag4, not result44) then
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
                    elseif rawequal5(flag4, not result44) then
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
out("L25", result35)
