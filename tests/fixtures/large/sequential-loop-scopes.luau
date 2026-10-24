local Point = {}
Point.__index = Point
local function point(x) return setmetatable({x=x}, Point) end
function Point.__mul(p, scale) return point(p.x * scale) end
local function normalize(p)
    local length = math.abs(p.x)
    if length < 0.001 then return point(0), 0 end
    return p * (1 / length), length
end
local worker = {}
function worker:make(value) return point(value), 2 end
local function build(values)
    local out = {}
    for i = 1, #values do out[i] = point(0) end
    for i, value in ipairs(values) do
        local p, scale = worker:make(value)
        for _, offset in ipairs({1, 2}) do out[i].x += p.x * scale / offset end
    end
    for i, value in ipairs(out) do out[i] = normalize(value) end
    local sum = 0
    for i, p in ipairs(out) do sum += i * p.x end
    return #out, sum
end
for _, values in ipairs({{2, -3, 0, 8}, {0, 0, 0}, {}, {-4, 6}}) do print(build(values)) end
