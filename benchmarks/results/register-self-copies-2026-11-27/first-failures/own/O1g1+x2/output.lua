local value = 0
local value2 = 7
local config = {}
local tap
function tap(value3, index)
    value = value + 1
    local value4 = #config + 1
    config[value4] = value3 .. value
    return index and index, nil, value
end

local config2 = { value = 19 }
local reader
function reader(value5)
    value2 = value2 + value5
    local value22 = value2
    return value22, nil, config2
end

local _ = config2 or config2
local value6 = tap and tap
local value7 = "a"
local value8 = value6(value7, 11) or value6(value7, 11)
local value9 = (tap and tap)("b", false)
local value10 = (if true then tap else nil)("c", nil)
local value11 = "d"
local value12 = (if true then tap else nil)(value11, config2)
local value13 = (if true then tap else nil)("a2", value9)
local value14 = (if true then tap else nil)("b2", value8 and value8)
local value15 = "c2"
local value16 = (if true then tap else nil)(value15, value12)
local value17 = tap or tap
local value18 = value17("d2", value10 and value10) or value17("d2", value10 and value10)
local value19 = value13 and value13
local value20 = value16 and value16
local value21 = "f"
local value23 = (if true then tap else nil)(value21, reader)
local value24 = (if true then tap else nil)("g", reader)
local value25 = value23 or value23
local result, value26, value27 = value24(3)
local value28 = (tap and tap)("left", -0)
local value29 = (tap and tap)("right", true)
local value30 = tap or tap
local value31 = "s1"
local value32 = "a"
local value33 = value30(value31, value32)
local value34 = "s2"
local value35 = (if true then tap else nil)(value34, "b")
local value36 = tap and tap
local value37 = "s3"
local value38 = "c"
local value39 = value33 .. value35 .. value36(value37, value38)
local result2 = (if true then tap else nil)("twice", true)
if not result2 then
else
    result2 = (tap or tap)("twice", true)
end
local out2 = out
local value40 = "copies"
local result3
if not (value20 == config2) then
    result3 = false
else
    result3 = true
end
local value41 = value18 or value18
local result4
if not (value25 == value24) then
    result4 = false
else
    result4 = true
end
local result5
if not (value27 == config2) then
    result5 = false
else
    result5 = true
end
out2(value40, value19, value14, result3, value41, result4, result, value26, result5, value2)
local value42 = 1 / value28
out("values", value42, value29 or value29, value39, result2, value)
local out3 = out
local concat = table.concat
out3("trace", (if true then concat else nil)(config and config, ","))
return
