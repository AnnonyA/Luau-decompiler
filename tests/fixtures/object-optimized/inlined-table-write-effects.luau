local function record(state, value)
    state.score = value * 3 + 1
    state.tag = value * 7 - 2
end
local first = ...
local limit = tonumber(first) or 3
local trace = {}
local state = setmetatable({}, {
    __newindex = function(target, key, value)
        trace[#trace + 1] = key .. ":" .. tostring(value)
        rawset(target, key, value)
    end,
})
for index = -3, limit do
    state.score = nil
    state.tag = nil
    record(state, index)
    print("metatable", index, state.score, state.tag, table.concat(trace, ","))
end
local frozen = table.freeze({})
local ok = pcall(function()
    record(frozen, 2)
end)
print("frozen", ok, frozen.score)
local plain = {}
local alias = plain
for index = -3, limit do
    record(plain, index)
    print("alias", alias.score, alias.tag, alias == plain)
end
