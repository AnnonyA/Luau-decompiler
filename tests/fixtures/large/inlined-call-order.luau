local function point(x, y, z) return setmetatable({x=x, y=y, z=z or 0}, {}) end
local function run(seed)
    local state = seed
    local nextValue = setmetatable({}, {__call = function(_, low, high)
        state = (state * 17 + 5) % 127
        return low + state % (high - low + 1)
    end})
    local out = {}
    for i = 1, 8 do
        local p = point(nextValue(-20, 20), nextValue(-20, 20), nextValue(-4, 9))
        out[i] = string.format("%d:%d:%d", p.x, p.y, p.z)
    end
    print(table.concat(out, ","), state)
end
for _, seed in ipairs({0, 1, 7, 23}) do run(seed) end
