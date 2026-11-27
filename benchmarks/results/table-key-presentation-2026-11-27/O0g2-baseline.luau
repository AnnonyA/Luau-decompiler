local counter: number = 0

local function tick()
    counter += 1
    return counter
end

local now = ((if true then tick else nil)())
local now2 = ((if true then tick else nil)())

local function function_(value)
    return value + 3
end

local tbl = {}
tbl["run"] = function_

local function run(value)
    return value + 7
end

local key: string = "code"
local now3 = ((if true then tick else nil)())
local now4 = ((if true then tick else nil)())
local now5 = ((if true then tick else nil)())
local now6 = ((if true then tick else nil)())
local data = { ["code"] = now, ["two words"] = now2, ["end"] = now3 }
local code = data.code
local value = data["two words"]
local value2 = data["end"]
local data2 = { [key] = now5, ["code"] = now6 }
print(code, value, value2, data2.code, counter)
local print2 = print
local value3 = (if true then tbl.run else nil)(4)
local data3 = { ["run"] = run }
print2(value3, (if true then data3.run else nil)(4), not ((if true then debug.info else nil)(tbl.run, "n") ~= ""), (if true then debug.info else nil)(data3.run, "n") == "run")
