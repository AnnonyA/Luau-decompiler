local trace = {}
local function record(value)
    table.insert(trace, value)
end
local item = setmetatable({}, {
    __lt = function(a, b) record("lt") return false end,
    __le = function(a, b) record("le") return true end,
    __eq = function(a, b) record("eq") return true end,
})
local other = setmetatable({}, getmetatable(item))
if item < other then end
if item <= other then end
if item == other then end
local ok, failure = pcall(function()
    record("before-error")
    if {} < 3 then end
    record("after-error")
end)
print(table.concat(trace, ","), ok, type(failure))
