local counter: number = 0

local function tick()
    counter += 1
    return counter
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
print(code, value, value2, ({ code = now6 }).code, counter)
local print2 = print
local tbl = {}

function tbl.run(value)
    return value + 3
end

local value3 = (true and tbl.run)(4)
local tbl2 = {}

function tbl2.run(value)
    return value + 7
end

print2(value3, (true and tbl2.run)(4), not (debug.info(tbl.run, "n") ~= ""), debug.info(tbl2.run, "n") == "run")
