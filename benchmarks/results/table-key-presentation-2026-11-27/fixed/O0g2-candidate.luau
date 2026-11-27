local counter: number = 0

local function tick()
    counter += 1
    return counter
end

local now = ((true and tick)())
local now2 = ((true and tick)())
local function_ = function(value)
    return value + 3
end
local tbl = {}
tbl["run"] = function_

local function run(value)
    return value + 7
end

local key: string = "code"
local now3 = ((true and tick)())
local now4 = ((true and tick)())
local now5 = ((true and tick)())
local now6 = ((true and tick)())
local data = { code = now, ["two words"] = now2, ["end"] = now3 }
local code = data.code
local value = data["two words"]
local value2 = data["end"]
local data2 = { [key] = now5, code = now6 }
print(code, value, value2, data2.code, counter)
local print2 = print
local value3 = (true and tbl.run)(4)
local data3 = { run = run }
print2(value3, (true and data3.run)(4), not ((debug.info)(tbl.run, "n") ~= ""), (debug.info)(data3.run, "n") == "run")
