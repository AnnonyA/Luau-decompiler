local record = "outer"
local function read() return record end
local record = {read = read}
print(record.read(), debug.info(record.read, "n"))

local function packet()
    local function values(...)
        return select("#", ...), ...
    end
    return {values = values}
end
local p = packet()
print(debug.info(p.values, "n"), p.values(1, nil, 3))
print(p.values())

local function sum(n)
    if n == 0 then return 0 end
    return n + sum(n - 1)
end
local recursive = {sum = sum}
print(recursive.sum(4), debug.info(recursive.sum, "n"))

local function original() return 17 end
local renamed = {alias = original}
print(renamed.alias(), debug.info(renamed.alias, "n"))
