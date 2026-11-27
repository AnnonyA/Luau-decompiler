local counter: number = 0

local function tick()
    counter += 1
    return counter
end

counter += 1
local data = { code = counter }
counter += 1
data["two words"] = counter
counter += 1
data["end"] = counter
counter += 1
local data2 = { code = counter }
counter += 1
data2.code = counter
counter += 1
data2.code = counter
local code = data.code
local value = data["two words"]
local value2 = data["end"]
print(code, value, value2, data2.code, counter)
local print2 = print
local info = debug.info
local tbl = {}

function tbl.run(value)
    return value + 3
end

local tbl2 = {}

function tbl2.run(value)
    return value + 7
end

value2 = not (info(tbl.run, "n") ~= "")
print2(7, 11, value2, debug.info(tbl2.run, "n") == "run")
