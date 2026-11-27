local sharedCounter: number = 0

local function tick()
    sharedCounter += 1
    return sharedCounter
end

local now = ((true and tick)())
local now2 = ((true and tick)())

local function function_(p)
    return p + 3
end

local tbl = {}
tbl["run"] = function_

local function run(p)
    return p + 7
end

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
local value3 = (true and tbl.run)(4)
local data2 = { run = run }
print2(value3, (true and data2.run)(4), not ((debug.info)(tbl.run, "n") ~= ""), (debug.info)(data2.run, "n") == "run")
