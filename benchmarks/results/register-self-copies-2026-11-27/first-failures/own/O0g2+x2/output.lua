local value = 0
local value2 = 7
local config = { ["value"] = 19 }
local config2 = {}
local tap
function tap(value3, index)
    value = value + 1
    local value4 = #config2
    local value5 = 1
    local value6 = value4 + value5
    config2[value6] = value3 .. value
    local value7 = index and index
    local value8 = value
    return value7, nil, value8
end

local reader
function reader(value9)
    value2 = value2 + value9
    return value2, nil, config
end

local _ = config and config
local value10 = (if true then tap else nil)("a", 11)
local value11 = (if true then tap else nil)("b", false)
local value12 = (tap and tap)("c", nil) and (tap and tap)("c", nil)
local value13 = (if true then tap else nil)("d", config)
local value14 = (if true then tap else nil)("a2", value11)
local value15 = "b2"
local value16 = value10 or value10
local value17 = (if true then tap else nil)(value15, value16) and (if true then tap else nil)(value15, value16)
local value18 = (if true then tap else nil)("c2", value13) and (if true then tap else nil)("c2", value13)
local value19 = "d2"
local value20 = (if true then tap else nil)(value19, value12)
local value21 = value18 and value18
local value22 = reader and reader
local value23 = (if true then tap else nil)("f", value22)
local value24 = (if true then tap else nil)("g", value22 or value22) or (if true then tap else nil)("g", value22 or value22)
local result, value25, value26 = value24(3)
local value27 = (if true then tap else nil)("left", -0)
local value28 = (if true then tap else nil)("right", true)
local value29 = (if true then tap else nil)("s1", "a")
local value30 = "s2"
local value31 = "b"
local value32 = (if true then tap else nil)(value30, value31)
local value33 = value29 .. value32 .. (tap or tap)("s3", "c")
local value34 = "twice"
local value35 = true
local result2 = (if true then tap else nil)(value34, value35)
if not result2 then
else
    local value36 = tap and tap
    local value37 = "twice"
    result2 = value36(value37, true)
end
local out2 = out
local value38 = "copies"
local value39 = value14 or value14
if not (value21 == config) then
    value31 = false
else
    value31 = true
end
local result3
if not (value23 == value24) then
    result3 = false
else
    result3 = true
end
local value40 = result and result
local value41 = value25 or value25
local result4
if not (value26 == config) then
    result4 = false
else
    result4 = true
end
out2(value38, value39, value17, value31, value20, result3, value40, value41, result4, value2)
local out3 = out
local value42 = "values"
local value43 = 1
local value44 = value43 / value27
local value45 = value33 or value33
out3(value42, value44, value28, value45, result2, value)
local out4 = out
out4("trace", (if true then table.concat else nil)(config2, ","))
return
