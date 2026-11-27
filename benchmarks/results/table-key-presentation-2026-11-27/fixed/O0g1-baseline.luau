local sharedCounter: number = 0

local function tick()
    sharedCounter += 1
    return sharedCounter
end

local now = ((if true then tick else nil)())
local now2 = ((if true then tick else nil)())

local function function_(p)
    return p + 3
end

local tbl = {}
tbl["run"] = function_

local function run(p)
    return p + 7
end

local now3 = ((if true then tick else nil)())
local now4 = ((if true then tick else nil)())
local now5 = ((if true then tick else nil)())
local now6 = ((if true then tick else nil)())
local data = { ["code"] = now, ["two words"] = now2, ["end"] = now3 }
local code = data.code
local value = data["two words"]
local value2 = data["end"]
print(code, value, value2, ({ ["code"] = now6 }).code, sharedCounter)
local print2 = print
local value3 = (if true then tbl.run else nil)(4)
local data2 = { ["run"] = run }
print2(value3, (if true then data2.run else nil)(4), not ((if true then debug.info else nil)(tbl.run, "n") ~= ""), (if true then debug.info else nil)(data2.run, "n") == "run")
