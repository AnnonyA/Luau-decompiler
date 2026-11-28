-- Authored control: `%*` is interpolation's exact format protocol.
local trace = {}
local function mark(n)
    table.insert(trace, n)
    return n, nil, 99
end
local first = ("before%% {%*} after `%*"):format(mark(1) + 2, not mark(2))
local second = ("zero\0%*\255"):format(-0)
print(first, #second, string.byte(second, 5, #second))
print(table.concat(trace, ","))
local function report(...)
    print(select("#", ...), ...)
end
local text = "constant"
local literalString = ("%*"):format("literal")
local propagatedString = ("%*"):format(text)
print(literalString, propagatedString)
print(("%d / %s"):format(3, "four"))

if replace_format then
    local original = string.format
    replace_format(function(format, ...)
        print("format", format, select("#", ...), ...)
        return "first", nil, "third", nil
    end)
    local scalar = ("a%*%%"):format(7 + mark(3))
    print("scalar", scalar)
    report(("b%*"):format(8))
    local a, b, c, d = ("c%*"):format(9)
    report(a, b, c, d);
    ("unused%*"):format(10)
    local stringArg = ("literal%*"):format("held")
    local propagated = ("propagated%*"):format(text)
    print(stringArg, propagated)
    local function switch()
        replace_format(function(format, value)
            print("replacement", format, value)
            return "switched", "extra"
        end)
        return 11
    end
    local switched = ("late%*"):format(switch() + 1)
    print(switched)
    replace_format(original)
end

local object = setmetatable({}, {__unm = function()
    table.insert(trace, "unm")
    return "from metamethod"
end})
local result = ("%*"):format(-object)
print(result, table.concat(trace, ","))
