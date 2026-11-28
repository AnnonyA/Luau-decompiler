local events = {}
local mode = 3
local function formatObserve(fmt, ...)
    local caller = debug.info(2, "n")
    local n = select("#", ...)
    local words = {caller, tostring(#fmt), tostring(n)}
    for index = 1, #fmt do table.insert(words, tostring(string.byte(fmt, index))) end
    for index = 1, n do
        local value = select(index, ...)
        local kind = type(value)
        if kind == "function" then table.insert(words, "fn:" .. debug.info(value, "n"))
        elseif kind == "table" then table.insert(words, "table:" .. tostring(value.marker))
        else table.insert(words, kind .. ":" .. tostring(value)) end
    end
    table.insert(events, table.concat(words, "|"))
    if mode == 0 then return end
    if mode == 1 then return nil, false, 7 end
    if mode == 2 then return false, nil, 7 end
    return "replaced", nil, 7
end
replace_format(formatObserve)
local function probe1(x)
    local size = 0
    local value0 = ("n%*"):format(x + 0)
    size += #value0
    return size
end
local function probe2(x)
    local size = 0
    local value0 = ("n%*"):format(x + 0)
    size += #value0
    local value1 = ("n%*"):format(x + 1)
    size += #value1
    return size
end
local function probe3(x)
    local size = 0
    local value0 = ("n%*"):format(x + 0)
    size += #value0
    local value1 = ("n%*"):format(x + 1)
    size += #value1
    local value2 = ("n%*"):format(x + 2)
    size += #value2
    return size
end
local function probe4(x)
    local size = 0
    local value0 = ("n%*"):format(x + 0)
    size += #value0
    local value1 = ("n%*"):format(x + 1)
    size += #value1
    local value2 = ("n%*"):format(x + 2)
    size += #value2
    local value3 = ("n%*"):format(x + 3)
    size += #value3
    return size
end
local function probe5(x)
    local size = 0
    local value0 = ("n%*"):format(x + 0)
    size += #value0
    local value1 = ("n%*"):format(x + 1)
    size += #value1
    local value2 = ("n%*"):format(x + 2)
    size += #value2
    local value3 = ("n%*"):format(x + 3)
    size += #value3
    local value4 = ("n%*"):format(x + 4)
    size += #value4
    return size
end
local function probe6(x)
    local size = 0
    local value0 = ("n%*"):format(x + 0)
    size += #value0
    local value1 = ("n%*"):format(x + 1)
    size += #value1
    local value2 = ("n%*"):format(x + 2)
    size += #value2
    local value3 = ("n%*"):format(x + 3)
    size += #value3
    local value4 = ("n%*"):format(x + 4)
    size += #value4
    local value5 = ("n%*"):format(x + 5)
    size += #value5
    return size
end
local function probe7(x)
    local size = 0
    local value0 = ("n%*"):format(x + 0)
    size += #value0
    local value1 = ("n%*"):format(x + 1)
    size += #value1
    local value2 = ("n%*"):format(x + 2)
    size += #value2
    local value3 = ("n%*"):format(x + 3)
    size += #value3
    local value4 = ("n%*"):format(x + 4)
    size += #value4
    local value5 = ("n%*"):format(x + 5)
    size += #value5
    local value6 = ("n%*"):format(x + 6)
    size += #value6
    return size
end
local function probe8(x)
    local size = 0
    local value0 = ("n%*"):format(x + 0)
    size += #value0
    local value1 = ("n%*"):format(x + 1)
    size += #value1
    local value2 = ("n%*"):format(x + 2)
    size += #value2
    local value3 = ("n%*"):format(x + 3)
    size += #value3
    local value4 = ("n%*"):format(x + 4)
    size += #value4
    local value5 = ("n%*"):format(x + 5)
    size += #value5
    local value6 = ("n%*"):format(x + 6)
    size += #value6
    local value7 = ("n%*"):format(x + 7)
    size += #value7
    return size
end
local function probe9(x)
    local size = 0
    local value0 = ("n%*"):format(x + 0)
    size += #value0
    local value1 = ("n%*"):format(x + 1)
    size += #value1
    local value2 = ("n%*"):format(x + 2)
    size += #value2
    local value3 = ("n%*"):format(x + 3)
    size += #value3
    local value4 = ("n%*"):format(x + 4)
    size += #value4
    local value5 = ("n%*"):format(x + 5)
    size += #value5
    local value6 = ("n%*"):format(x + 6)
    size += #value6
    local value7 = ("n%*"):format(x + 7)
    size += #value7
    local value8 = ("n%*"):format(x + 8)
    size += #value8
    return size
end
local function probe10(x)
    local size = 0
    local value0 = ("n%*"):format(x + 0)
    size += #value0
    local value1 = ("n%*"):format(x + 1)
    size += #value1
    local value2 = ("n%*"):format(x + 2)
    size += #value2
    local value3 = ("n%*"):format(x + 3)
    size += #value3
    local value4 = ("n%*"):format(x + 4)
    size += #value4
    local value5 = ("n%*"):format(x + 5)
    size += #value5
    local value6 = ("n%*"):format(x + 6)
    size += #value6
    local value7 = ("n%*"):format(x + 7)
    size += #value7
    local value8 = ("n%*"):format(x + 8)
    size += #value8
    local value9 = ("n%*"):format(x + 9)
    size += #value9
    return size
end
local function probe11(x)
    local size = 0
    local value0 = ("n%*"):format(x + 0)
    size += #value0
    local value1 = ("n%*"):format(x + 1)
    size += #value1
    local value2 = ("n%*"):format(x + 2)
    size += #value2
    local value3 = ("n%*"):format(x + 3)
    size += #value3
    local value4 = ("n%*"):format(x + 4)
    size += #value4
    local value5 = ("n%*"):format(x + 5)
    size += #value5
    local value6 = ("n%*"):format(x + 6)
    size += #value6
    local value7 = ("n%*"):format(x + 7)
    size += #value7
    local value8 = ("n%*"):format(x + 8)
    size += #value8
    local value9 = ("n%*"):format(x + 9)
    size += #value9
    local value10 = ("n%*"):format(x + 10)
    size += #value10
    return size
end
local function probe12(x)
    local size = 0
    local value0 = ("n%*"):format(x + 0)
    size += #value0
    local value1 = ("n%*"):format(x + 1)
    size += #value1
    local value2 = ("n%*"):format(x + 2)
    size += #value2
    local value3 = ("n%*"):format(x + 3)
    size += #value3
    local value4 = ("n%*"):format(x + 4)
    size += #value4
    local value5 = ("n%*"):format(x + 5)
    size += #value5
    local value6 = ("n%*"):format(x + 6)
    size += #value6
    local value7 = ("n%*"):format(x + 7)
    size += #value7
    local value8 = ("n%*"):format(x + 8)
    size += #value8
    local value9 = ("n%*"):format(x + 9)
    size += #value9
    local value10 = ("n%*"):format(x + 10)
    size += #value10
    local value11 = ("n%*"):format(x + 11)
    size += #value11
    return size
end
local function probe13(x)
    local size = 0
    local value0 = ("n%*"):format(x + 0)
    size += #value0
    local value1 = ("n%*"):format(x + 1)
    size += #value1
    local value2 = ("n%*"):format(x + 2)
    size += #value2
    local value3 = ("n%*"):format(x + 3)
    size += #value3
    local value4 = ("n%*"):format(x + 4)
    size += #value4
    local value5 = ("n%*"):format(x + 5)
    size += #value5
    local value6 = ("n%*"):format(x + 6)
    size += #value6
    local value7 = ("n%*"):format(x + 7)
    size += #value7
    local value8 = ("n%*"):format(x + 8)
    size += #value8
    local value9 = ("n%*"):format(x + 9)
    size += #value9
    local value10 = ("n%*"):format(x + 10)
    size += #value10
    local value11 = ("n%*"):format(x + 11)
    size += #value11
    local value12 = ("n%*"):format(x + 12)
    size += #value12
    return size
end
local function probe14(x)
    local size = 0
    local value0 = ("n%*"):format(x + 0)
    size += #value0
    local value1 = ("n%*"):format(x + 1)
    size += #value1
    local value2 = ("n%*"):format(x + 2)
    size += #value2
    local value3 = ("n%*"):format(x + 3)
    size += #value3
    local value4 = ("n%*"):format(x + 4)
    size += #value4
    local value5 = ("n%*"):format(x + 5)
    size += #value5
    local value6 = ("n%*"):format(x + 6)
    size += #value6
    local value7 = ("n%*"):format(x + 7)
    size += #value7
    local value8 = ("n%*"):format(x + 8)
    size += #value8
    local value9 = ("n%*"):format(x + 9)
    size += #value9
    local value10 = ("n%*"):format(x + 10)
    size += #value10
    local value11 = ("n%*"):format(x + 11)
    size += #value11
    local value12 = ("n%*"):format(x + 12)
    size += #value12
    local value13 = ("n%*"):format(x + 13)
    size += #value13
    return size
end
local function probe15(x)
    local size = 0
    local value0 = ("n%*"):format(x + 0)
    size += #value0
    local value1 = ("n%*"):format(x + 1)
    size += #value1
    local value2 = ("n%*"):format(x + 2)
    size += #value2
    local value3 = ("n%*"):format(x + 3)
    size += #value3
    local value4 = ("n%*"):format(x + 4)
    size += #value4
    local value5 = ("n%*"):format(x + 5)
    size += #value5
    local value6 = ("n%*"):format(x + 6)
    size += #value6
    local value7 = ("n%*"):format(x + 7)
    size += #value7
    local value8 = ("n%*"):format(x + 8)
    size += #value8
    local value9 = ("n%*"):format(x + 9)
    size += #value9
    local value10 = ("n%*"):format(x + 10)
    size += #value10
    local value11 = ("n%*"):format(x + 11)
    size += #value11
    local value12 = ("n%*"):format(x + 12)
    size += #value12
    local value13 = ("n%*"):format(x + 13)
    size += #value13
    local value14 = ("n%*"):format(x + 14)
    size += #value14
    return size
end
local function probe16(x)
    local size = 0
    local value0 = ("n%*"):format(x + 0)
    size += #value0
    local value1 = ("n%*"):format(x + 1)
    size += #value1
    local value2 = ("n%*"):format(x + 2)
    size += #value2
    local value3 = ("n%*"):format(x + 3)
    size += #value3
    local value4 = ("n%*"):format(x + 4)
    size += #value4
    local value5 = ("n%*"):format(x + 5)
    size += #value5
    local value6 = ("n%*"):format(x + 6)
    size += #value6
    local value7 = ("n%*"):format(x + 7)
    size += #value7
    local value8 = ("n%*"):format(x + 8)
    size += #value8
    local value9 = ("n%*"):format(x + 9)
    size += #value9
    local value10 = ("n%*"):format(x + 10)
    size += #value10
    local value11 = ("n%*"):format(x + 11)
    size += #value11
    local value12 = ("n%*"):format(x + 12)
    size += #value12
    local value13 = ("n%*"):format(x + 13)
    size += #value13
    local value14 = ("n%*"):format(x + 14)
    size += #value14
    local value15 = ("n%*"):format(x + 15)
    size += #value15
    return size
end
local function probe17(x)
    local size = 0
    local value0 = ("n%*"):format(x + 0)
    size += #value0
    local value1 = ("n%*"):format(x + 1)
    size += #value1
    local value2 = ("n%*"):format(x + 2)
    size += #value2
    local value3 = ("n%*"):format(x + 3)
    size += #value3
    local value4 = ("n%*"):format(x + 4)
    size += #value4
    local value5 = ("n%*"):format(x + 5)
    size += #value5
    local value6 = ("n%*"):format(x + 6)
    size += #value6
    local value7 = ("n%*"):format(x + 7)
    size += #value7
    local value8 = ("n%*"):format(x + 8)
    size += #value8
    local value9 = ("n%*"):format(x + 9)
    size += #value9
    local value10 = ("n%*"):format(x + 10)
    size += #value10
    local value11 = ("n%*"):format(x + 11)
    size += #value11
    local value12 = ("n%*"):format(x + 12)
    size += #value12
    local value13 = ("n%*"):format(x + 13)
    size += #value13
    local value14 = ("n%*"):format(x + 14)
    size += #value14
    local value15 = ("n%*"):format(x + 15)
    size += #value15
    local value16 = ("n%*"):format(x + 16)
    size += #value16
    return size
end
local function probe18(x)
    local size = 0
    local value0 = ("n%*"):format(x + 0)
    size += #value0
    local value1 = ("n%*"):format(x + 1)
    size += #value1
    local value2 = ("n%*"):format(x + 2)
    size += #value2
    local value3 = ("n%*"):format(x + 3)
    size += #value3
    local value4 = ("n%*"):format(x + 4)
    size += #value4
    local value5 = ("n%*"):format(x + 5)
    size += #value5
    local value6 = ("n%*"):format(x + 6)
    size += #value6
    local value7 = ("n%*"):format(x + 7)
    size += #value7
    local value8 = ("n%*"):format(x + 8)
    size += #value8
    local value9 = ("n%*"):format(x + 9)
    size += #value9
    local value10 = ("n%*"):format(x + 10)
    size += #value10
    local value11 = ("n%*"):format(x + 11)
    size += #value11
    local value12 = ("n%*"):format(x + 12)
    size += #value12
    local value13 = ("n%*"):format(x + 13)
    size += #value13
    local value14 = ("n%*"):format(x + 14)
    size += #value14
    local value15 = ("n%*"):format(x + 15)
    size += #value15
    local value16 = ("n%*"):format(x + 16)
    size += #value16
    local value17 = ("n%*"):format(x + 17)
    size += #value17
    return size
end
local function probe19(x)
    local size = 0
    local value0 = ("n%*"):format(x + 0)
    size += #value0
    local value1 = ("n%*"):format(x + 1)
    size += #value1
    local value2 = ("n%*"):format(x + 2)
    size += #value2
    local value3 = ("n%*"):format(x + 3)
    size += #value3
    local value4 = ("n%*"):format(x + 4)
    size += #value4
    local value5 = ("n%*"):format(x + 5)
    size += #value5
    local value6 = ("n%*"):format(x + 6)
    size += #value6
    local value7 = ("n%*"):format(x + 7)
    size += #value7
    local value8 = ("n%*"):format(x + 8)
    size += #value8
    local value9 = ("n%*"):format(x + 9)
    size += #value9
    local value10 = ("n%*"):format(x + 10)
    size += #value10
    local value11 = ("n%*"):format(x + 11)
    size += #value11
    local value12 = ("n%*"):format(x + 12)
    size += #value12
    local value13 = ("n%*"):format(x + 13)
    size += #value13
    local value14 = ("n%*"):format(x + 14)
    size += #value14
    local value15 = ("n%*"):format(x + 15)
    size += #value15
    local value16 = ("n%*"):format(x + 16)
    size += #value16
    local value17 = ("n%*"):format(x + 17)
    size += #value17
    local value18 = ("n%*"):format(x + 18)
    size += #value18
    return size
end
local function probe20(x)
    local size = 0
    local value0 = ("n%*"):format(x + 0)
    size += #value0
    local value1 = ("n%*"):format(x + 1)
    size += #value1
    local value2 = ("n%*"):format(x + 2)
    size += #value2
    local value3 = ("n%*"):format(x + 3)
    size += #value3
    local value4 = ("n%*"):format(x + 4)
    size += #value4
    local value5 = ("n%*"):format(x + 5)
    size += #value5
    local value6 = ("n%*"):format(x + 6)
    size += #value6
    local value7 = ("n%*"):format(x + 7)
    size += #value7
    local value8 = ("n%*"):format(x + 8)
    size += #value8
    local value9 = ("n%*"):format(x + 9)
    size += #value9
    local value10 = ("n%*"):format(x + 10)
    size += #value10
    local value11 = ("n%*"):format(x + 11)
    size += #value11
    local value12 = ("n%*"):format(x + 12)
    size += #value12
    local value13 = ("n%*"):format(x + 13)
    size += #value13
    local value14 = ("n%*"):format(x + 14)
    size += #value14
    local value15 = ("n%*"):format(x + 15)
    size += #value15
    local value16 = ("n%*"):format(x + 16)
    size += #value16
    local value17 = ("n%*"):format(x + 17)
    size += #value17
    local value18 = ("n%*"):format(x + 18)
    size += #value18
    local value19 = ("n%*"):format(x + 19)
    size += #value19
    return size
end
print(probe1(3), probe2(3), probe3(3), probe4(3), probe5(3), probe6(3), probe7(3), probe8(3), probe9(3), probe10(3), probe11(3), probe12(3), probe13(3), probe14(3), probe15(3), probe16(3), probe17(3), probe18(3), probe19(3), probe20(3))
for m = 0, 3 do
    mode = m
    local object = ("%%* { %* }\000\255"):format({marker = 11})
    local callback = ("fn%*"):format(function() return 17 end)
    local boolean = ("b%*"):format(not false)
    local integer = ("number%*"):format(0 / 0)
    local missing = ("nil%*"):format(nil)
    print("scalar", type(object), type(callback), type(boolean), type(integer), type(missing))
end
print(table.concat(events, "\n"))
