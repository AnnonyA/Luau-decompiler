local sharedCounter: number = 0

local function tick()
    sharedCounter += 1
    return sharedCounter
end

sharedCounter += 1
local data = { code = sharedCounter }
sharedCounter += 1
data["two words"] = sharedCounter
sharedCounter += 1
data["end"] = sharedCounter
sharedCounter += 1
local data2 = { code = sharedCounter }
sharedCounter += 1
data2.code = sharedCounter
sharedCounter += 1
data2.code = sharedCounter
local code = data.code
local value = data["two words"]
local value2 = data["end"]
print(code, value, value2, data2.code, sharedCounter)
local print2 = print
local info = debug.info
local tbl = {}

function tbl.run(p)
    return p + 3
end

local tbl2 = {}

function tbl2.run(p)
    return p + 7
end

value2 = not (info(tbl.run, "n") ~= "")
print2(7, 11, value2, debug.info(tbl2.run, "n") == "run")
