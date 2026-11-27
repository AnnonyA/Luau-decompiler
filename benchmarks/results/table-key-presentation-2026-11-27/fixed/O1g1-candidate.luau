local sharedCounter: number = 0

local function tick()
    sharedCounter += 1
    return sharedCounter
end

local now = ((true and tick)())
local now2 = ((true and tick)())
local now3 = ((true and tick)())
local now4 = ((true and tick)())
local now5 = ((true and tick)())
local now6 = ((true and tick)())
local data = { code = now, ["two words"] = now2, ["end"] = now3 }
local code = data.code
local value = data["two words"]
local value2 = data["end"]
print(code, value, value2, ({ code = now6 }).code, sharedCounter)
local print2 = print
local data2 = {}
data2.run = function(p)
    return p + 3
end

local value3 = (true and data2.run)(4)
local tbl = {}

function tbl.run(p)
    return p + 7
end

print2(value3, (true and tbl.run)(4), not (debug.info(data2.run, "n") ~= ""), debug.info(tbl.run, "n") == "run")
