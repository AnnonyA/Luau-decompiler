local seen = {}
local observed = setmetatable({}, {__index = function(_, key)
    seen[#seen + 1] = key
    return #seen
end})
print(observed.x, observed.y, observed.z, observed.X, observed.Y, observed.Z)
print(table.concat(seen, ","))
