local sharedCounter: number = 0

local function tick()
    sharedCounter += 1
    return sharedCounter
end

local now = ((if true then tick else nil)())
local now2 = ((if true then tick else nil)())
local now3 = ((if true then tick else nil)())
local now4 = ((if true then tick else nil)())
local now5 = ((if true then tick else nil)())
local now6 = ((if true then tick else nil)())
local data = { code = now, ["two words"] = now2, ["end"] = now3 }
local code = data.code
local value = data["two words"]
local value2 = data["end"]
print(code, value, value2, ({ code = now6 }).code, sharedCounter)
local print2 = print
local tbl = {}

function tbl.run(p)
    return p + 3
end

local value3 = (if true then tbl.run else nil)(4)
local tbl2 = {}

function tbl2.run(p)
    return p + 7
end

print2(value3, (if true then tbl2.run else nil)(4), not (debug.info(tbl.run, "n") ~= ""), debug.info(tbl2.run, "n") == "run")
