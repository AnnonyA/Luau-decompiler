-- Independently authored geometry laboratory. Coordinates start as integers;
-- clipping and projection retain rational intermediate results until reporting.
local rawSeed, rawMode = ...
local seed = tonumber(rawSeed) or 0
local mode = tonumber(rawMode) or 0
local EPS = 0.000001
local MOD = 1000000007
local abs = math.abs
local floor = math.floor
local min = math.min
local max = math.max

local function round(value)
    if value < 0 then
        return -floor(-value + 0.5)
    end
    return floor(value + 0.5)
end

local function clamp(value, low, high)
    if value < low then
        return low
    elseif value > high then
        return high
    end
    return value
end

local function hashStep(hash, value)
    return (hash * 131 + round(value * 1000)) % MOD
end

local traceHash = 19
local traceCount = 0
local function emit(label, ...)
    local values = {...}
    local fields = {label}
    for i, value in ipairs(values) do
        if type(value) == "number" then
            local quantized = round(value * 1000)
            fields[#fields + 1] = tostring(quantized)
            traceHash = hashStep(traceHash, quantized / 1000)
        else
            local text = tostring(value)
            fields[#fields + 1] = text
            for j = 1, #text do
                traceHash = (traceHash * 31 + string.byte(text, j)) % MOD
            end
        end
    end
    traceCount += 1
    print(table.concat(fields, ":"))
end

local Point = {}
Point.__index = Point
local function point(x, y, z)
    return setmetatable({x = x, y = y, z = z or 0}, Point)
end

function Point:clone()
    return point(self.x, self.y, self.z)
end

function Point.__add(a, b)
    return point(a.x + b.x, a.y + b.y, a.z + b.z)
end

function Point.__sub(a, b)
    return point(a.x - b.x, a.y - b.y, a.z - b.z)
end

function Point.__mul(a, b)
    if type(a) == "number" then
        return point(a * b.x, a * b.y, a * b.z)
    end
    return point(a.x * b, a.y * b, a.z * b)
end

function Point.__unm(a)
    return point(-a.x, -a.y, -a.z)
end

local function dot(a, b)
    return a.x * b.x + a.y * b.y + a.z * b.z
end

local function cross(a, b)
    return point(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x)
end

local function lengthSquared(a)
    return dot(a, a)
end

local function distanceSquared(a, b)
    local delta = a - b
    return dot(delta, delta)
end

local function normalize(a)
    local length = math.sqrt(lengthSquared(a))
    if length <= EPS then
        return point(0, 0, 0), 0
    end
    return a * (1 / length), length
end

local function orient(a, b, c)
    return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
end

local function samePoint(a, b)
    return abs(a.x - b.x) <= EPS and abs(a.y - b.y) <= EPS and abs(a.z - b.z) <= EPS
end

local function lerp(a, b, t)
    return a + (b - a) * t
end

local function pointKey(p)
    return tostring(round(p.x * 1000)) .. "/" .. tostring(round(p.y * 1000)) .. "/" .. tostring(round(p.z * 1000))
end

local function pointsHash(points)
    local h = 7
    for i, p in ipairs(points) do
        h = hashStep(h, p.x + i)
        h = hashStep(h, p.y)
        h = hashStep(h, p.z)
    end
    return h
end

local function makeGenerator(initial)
    local state = (abs(initial) * 97 + 31) % 65521
    local calls = 0
    return function(low, high)
        state = (state * 109 + 89) % 65521
        calls += 1
        return low + state % (high - low + 1), calls
    end, function()
        return state, calls
    end
end

local Matrix = {}
Matrix.__index = Matrix
local function matrix(a, b, c, d, tx, ty)
    return setmetatable({a = a, b = b, c = c, d = d, tx = tx, ty = ty}, Matrix)
end

function Matrix:apply(p)
    return point(self.a * p.x + self.c * p.y + self.tx, self.b * p.x + self.d * p.y + self.ty, p.z)
end

function Matrix:direction(p)
    return point(self.a * p.x + self.c * p.y, self.b * p.x + self.d * p.y, p.z)
end

function Matrix:compose(rhs)
    local a = self.a * rhs.a + self.c * rhs.b
    local b = self.b * rhs.a + self.d * rhs.b
    local c = self.a * rhs.c + self.c * rhs.d
    local d = self.b * rhs.c + self.d * rhs.d
    local tx = self.a * rhs.tx + self.c * rhs.ty + self.tx
    local ty = self.b * rhs.tx + self.d * rhs.ty + self.ty
    return matrix(a, b, c, d, tx, ty)
end

function Matrix:inverse()
    local determinant = self.a * self.d - self.b * self.c
    if abs(determinant) <= EPS then
        return nil, "singular"
    end
    local a = self.d / determinant
    local b = -self.b / determinant
    local c = -self.c / determinant
    local d = self.a / determinant
    return matrix(a, b, c, d, -(a * self.tx + c * self.ty), -(b * self.tx + d * self.ty)), determinant
end

local function transformed(points, transform)
    local result = {}
    for i, p in ipairs(points) do
        result[i] = transform:apply(p)
    end
    return result
end

local function signedArea(poly)
    local total = 0
    for i, p in ipairs(poly) do
        local q = poly[i % #poly + 1]
        total += p.x * q.y - q.x * p.y
    end
    return total / 2
end

local function perimeter(poly)
    local total = 0
    for i, p in ipairs(poly) do
        total += math.sqrt(distanceSquared(p, poly[i % #poly + 1]))
    end
    return total
end

local function centroid(poly)
    local sx = 0
    local sy = 0
    local weight = 0
    for i, p in ipairs(poly) do
        local q = poly[i % #poly + 1]
        local wedge = p.x * q.y - q.x * p.y
        sx += (p.x + q.x) * wedge
        sy += (p.y + q.y) * wedge
        weight += wedge
    end
    if abs(weight) > EPS then
        return point(sx / (3 * weight), sy / (3 * weight)), weight / 2
    end
    sx = 0
    sy = 0
    for _, p in ipairs(poly) do
        sx += p.x
        sy += p.y
    end
    return point(sx / max(1, #poly), sy / max(1, #poly)), 0
end

local function cleanPolygon(poly)
    local result = {}
    for _, p in ipairs(poly) do
        if #result == 0 or not samePoint(p, result[#result]) then
            result[#result + 1] = p:clone()
        end
    end
    if #result > 1 and samePoint(result[1], result[#result]) then
        table.remove(result)
    end
    local changed = true
    while changed and #result > 3 do
        changed = false
        for i = #result, 1, -1 do
            local previous = result[(i - 2) % #result + 1]
            local following = result[i % #result + 1]
            if abs(orient(previous, result[i], following)) <= EPS then
                table.remove(result, i)
                changed = true
                break
            end
        end
    end
    if signedArea(result) < 0 then
        local reversed = {}
        for i = #result, 1, -1 do
            reversed[#reversed + 1] = result[i]
        end
        return reversed
    end
    return result
end

local function convexHull(points)
    local sorted = table.clone(points)
    table.sort(sorted, function(a, b)
        if a.x ~= b.x then
            return a.x < b.x
        end
        return a.y < b.y
    end)
    local unique = {}
    for _, p in ipairs(sorted) do
        if #unique == 0 or not samePoint(unique[#unique], p) then
            unique[#unique + 1] = p
        end
    end
    if #unique < 3 then
        return unique
    end
    local lower = {}
    for _, p in ipairs(unique) do
        while #lower >= 2 and orient(lower[#lower - 1], lower[#lower], p) <= 0 do
            table.remove(lower)
        end
        lower[#lower + 1] = p
    end
    local upper = {}
    for i = #unique, 1, -1 do
        local p = unique[i]
        while #upper >= 2 and orient(upper[#upper - 1], upper[#upper], p) <= 0 do
            table.remove(upper)
        end
        upper[#upper + 1] = p
    end
    table.remove(lower)
    table.remove(upper)
    for _, p in ipairs(upper) do
        lower[#lower + 1] = p
    end
    return lower
end

local function pointOnSegment(p, a, b)
    if abs(orient(a, b, p)) > EPS then
        return false
    end
    return p.x >= min(a.x, b.x) - EPS and p.x <= max(a.x, b.x) + EPS
        and p.y >= min(a.y, b.y) - EPS and p.y <= max(a.y, b.y) + EPS
end

local function contains(poly, p)
    local winding = 0
    for i, a in ipairs(poly) do
        local b = poly[i % #poly + 1]
        if pointOnSegment(p, a, b) then
            return true, "boundary"
        end
        if a.y <= p.y and b.y > p.y and orient(a, b, p) > 0 then
            winding += 1
        elseif a.y > p.y and b.y <= p.y and orient(a, b, p) < 0 then
            winding -= 1
        end
    end
    return winding ~= 0, winding
end

local function segmentIntersection(a, b, c, d)
    local ab = b - a
    local cd = d - c
    local determinant = ab.x * cd.y - ab.y * cd.x
    local delta = c - a
    if abs(determinant) <= EPS then
        if pointOnSegment(c, a, b) then
            return c:clone(), 0, "overlap"
        elseif pointOnSegment(a, c, d) then
            return a:clone(), 0, "overlap"
        end
        return nil, 0, "parallel"
    end
    local t = (delta.x * cd.y - delta.y * cd.x) / determinant
    local u = (delta.x * ab.y - delta.y * ab.x) / determinant
    if t >= -EPS and t <= 1 + EPS and u >= -EPS and u <= 1 + EPS then
        return lerp(a, b, t), t, "crossing"
    end
    return nil, t, "outside"
end

local function closestSegment(p, a, b)
    local delta = b - a
    local divisor = lengthSquared(delta)
    local t = 0
    if divisor > EPS then
        t = clamp(dot(p - a, delta) / divisor, 0, 1)
    end
    local nearest = lerp(a, b, t)
    return nearest, distanceSquared(p, nearest), t
end

local function nearestBoundary(poly, p)
    local bestPoint = nil
    local bestDistance = math.huge
    local bestEdge = 0
    for i, a in ipairs(poly) do
        local q, distance = closestSegment(p, a, poly[i % #poly + 1])
        if distance < bestDistance then
            bestPoint = q
            bestDistance = distance
            bestEdge = i
        end
    end
    return bestPoint, bestDistance, bestEdge
end

local function clipHalfPlane(poly, a, b)
    local result = {}
    if #poly == 0 then
        return result
    end
    local previous = poly[#poly]
    local previousSide = orient(a, b, previous)
    for _, current in ipairs(poly) do
        local currentSide = orient(a, b, current)
        local previousInside = previousSide >= -EPS
        local currentInside = currentSide >= -EPS
        if previousInside ~= currentInside then
            local t = previousSide / (previousSide - currentSide)
            result[#result + 1] = lerp(previous, current, t)
        end
        if currentInside then
            result[#result + 1] = current:clone()
        end
        previous = current
        previousSide = currentSide
    end
    return cleanPolygon(result)
end

local function clipConvex(subject, clipper)
    local result = subject
    local history = {}
    for i, a in ipairs(clipper) do
        result = clipHalfPlane(result, a, clipper[i % #clipper + 1])
        history[i] = #result
        if #result == 0 then
            break
        end
    end
    return result, history
end

local function insideTriangle(p, a, b, c)
    local first = orient(a, b, p)
    local second = orient(b, c, p)
    local third = orient(c, a, p)
    return first >= -EPS and second >= -EPS and third >= -EPS
end

local function triangulate(poly)
    local indices = {}
    local triangles = {}
    for i = 1, #poly do
        indices[i] = i
    end
    local attempts = 0
    while #indices > 3 do
        local removed = false
        for position, current in ipairs(indices) do
            attempts += 1
            local previous = indices[(position - 2) % #indices + 1]
            local following = indices[position % #indices + 1]
            local a, b, c = poly[previous], poly[current], poly[following]
            if orient(a, b, c) > EPS then
                local blocked = false
                for _, other in ipairs(indices) do
                    if other ~= previous and other ~= current and other ~= following then
                        if insideTriangle(poly[other], a, b, c) then
                            blocked = true
                            break
                        end
                    end
                end
                if not blocked then
                    triangles[#triangles + 1] = {previous, current, following}
                    table.remove(indices, position)
                    removed = true
                    break
                end
            end
        end
        if not removed then
            error("triangulation stalled", 0)
        end
    end
    if #indices == 3 then
        triangles[#triangles + 1] = {indices[1], indices[2], indices[3]}
    end
    return triangles, attempts
end

local function polygonMoments(poly)
    local xx, yy, xy = 0, 0, 0
    for i, a in ipairs(poly) do
        local b = poly[i % #poly + 1]
        local wedge = a.x * b.y - b.x * a.y
        xx += (a.x * a.x + a.x * b.x + b.x * b.x) * wedge
        yy += (a.y * a.y + a.y * b.y + b.y * b.y) * wedge
        xy += (2 * a.x * a.y + a.x * b.y + b.x * a.y + 2 * b.x * b.y) * wedge
    end
    return xx / 12, yy / 12, xy / 24
end

local function support(poly, direction)
    local bestIndex = 0
    local bestValue = -math.huge
    for i, p in ipairs(poly) do
        local value = dot(p, direction)
        if value > bestValue then
            bestIndex = i
            bestValue = value
        end
    end
    return poly[bestIndex], bestValue, bestIndex
end

local function project(poly, axis)
    local low = math.huge
    local high = -math.huge
    for _, p in ipairs(poly) do
        local value = dot(p, axis)
        low = min(low, value)
        high = max(high, value)
    end
    return low, high
end

local function separatingAxis(first, second)
    local minimumOverlap = math.huge
    local minimumAxis = point(0, 0)
    local tested = 0
    for _, poly in ipairs({first, second}) do
        for i, a in ipairs(poly) do
            local edge = poly[i % #poly + 1] - a
            local axis, length = normalize(point(-edge.y, edge.x))
            if length > EPS then
                tested += 1
                local lowA, highA = project(first, axis)
                local lowB, highB = project(second, axis)
                local overlap = min(highA, highB) - max(lowA, lowB)
                if overlap < -EPS then
                    return false, overlap, axis, tested
                end
                if overlap < minimumOverlap then
                    minimumOverlap = overlap
                    minimumAxis = axis
                end
            end
        end
    end
    return true, minimumOverlap, minimumAxis, tested
end

local function minkowskiSum(first, second)
    local cloud = {}
    for _, a in ipairs(first) do
        for _, b in ipairs(second) do
            cloud[#cloud + 1] = a + b
        end
    end
    return convexHull(cloud)
end

local function resample(poly, count)
    local distances = {0}
    local total = 0
    for i, p in ipairs(poly) do
        total += math.sqrt(distanceSquared(p, poly[i % #poly + 1]))
        distances[i + 1] = total
    end
    local result = {}
    local edge = 1
    for i = 0, count - 1 do
        local target = i * total / count
        while edge < #poly and distances[edge + 1] < target do
            edge += 1
        end
        local width = distances[edge + 1] - distances[edge]
        local t = width > EPS and (target - distances[edge]) / width or 0
        result[#result + 1] = lerp(poly[edge], poly[edge % #poly + 1], t)
    end
    return result, total
end

local function simplifyPath(points, tolerance)
    local kept = {}
    local function visit(first, last)
        local farthest = 0
        local distance = tolerance * tolerance
        for i = first + 1, last - 1 do
            local _, candidate = closestSegment(points[i], points[first], points[last])
            if candidate > distance then
                farthest = i
                distance = candidate
            end
        end
        if farthest == 0 then
            kept[first] = true
            kept[last] = true
            return
        end
        visit(first, farthest)
        visit(farthest, last)
    end
    if #points > 0 then
        visit(1, #points)
    end
    local result = {}
    for i, p in ipairs(points) do
        if kept[i] then
            result[#result + 1] = p
        end
    end
    return result
end

local function bounds(points)
    local low = point(math.huge, math.huge, math.huge)
    local high = point(-math.huge, -math.huge, -math.huge)
    for _, p in ipairs(points) do
        low.x = min(low.x, p.x)
        low.y = min(low.y, p.y)
        low.z = min(low.z, p.z)
        high.x = max(high.x, p.x)
        high.y = max(high.y, p.y)
        high.z = max(high.z, p.z)
    end
    return {low = low, high = high}
end

local function unionBounds(a, b)
    return {
        low = point(min(a.low.x, b.low.x), min(a.low.y, b.low.y), min(a.low.z, b.low.z)),
        high = point(max(a.high.x, b.high.x), max(a.high.y, b.high.y), max(a.high.z, b.high.z)),
    }
end

local function boxesOverlap(a, b)
    return a.low.x <= b.high.x and a.high.x >= b.low.x
        and a.low.y <= b.high.y and a.high.y >= b.low.y
        and a.low.z <= b.high.z and a.high.z >= b.low.z
end

local function boxDistanceSquared(box, p)
    local x = max(box.low.x - p.x, 0, p.x - box.high.x)
    local y = max(box.low.y - p.y, 0, p.y - box.high.y)
    local z = max(box.low.z - p.z, 0, p.z - box.high.z)
    return x * x + y * y + z * z
end

local function rayBox(origin, direction, box, limit)
    local near = 0
    local far = limit
    for _, axis in ipairs({"x", "y", "z"}) do
        local velocity = direction[axis]
        if abs(velocity) <= EPS then
            if origin[axis] < box.low[axis] or origin[axis] > box.high[axis] then
                return false, near, far
            end
        else
            local a = (box.low[axis] - origin[axis]) / velocity
            local b = (box.high[axis] - origin[axis]) / velocity
            if a > b then
                a, b = b, a
            end
            near = max(near, a)
            far = min(far, b)
            if near > far then
                return false, near, far
            end
        end
    end
    return true, near, far
end

local Mesh = {}
Mesh.__index = Mesh
local function mesh(vertices, faces)
    return setmetatable({vertices = vertices, faces = faces, revision = 0, cachedEdges = nil}, Mesh)
end

function Mesh:clone()
    local vertices = {}
    local faces = {}
    for i, p in ipairs(self.vertices) do
        vertices[i] = p:clone()
    end
    for i, face in ipairs(self.faces) do
        faces[i] = table.clone(face)
    end
    return mesh(vertices, faces)
end

function Mesh:faceGeometry(index)
    local face = self.faces[index]
    local a = self.vertices[face[1]]
    local b = self.vertices[face[2]]
    local c = self.vertices[face[3]]
    local normal, doubleArea = normalize(cross(b - a, c - a))
    return normal, doubleArea / 2, (a + b + c) * (1 / 3)
end

function Mesh:measure()
    local area = 0
    local volume = 0
    local weightedCenter = point(0, 0, 0)
    for i, face in ipairs(self.faces) do
        local _, faceArea, center = self:faceGeometry(i)
        local a, b, c = self.vertices[face[1]], self.vertices[face[2]], self.vertices[face[3]]
        area += faceArea
        volume += dot(a, cross(b, c)) / 6
        weightedCenter = weightedCenter + center * faceArea
    end
    if area > EPS then
        weightedCenter = weightedCenter * (1 / area)
    end
    return area, volume, weightedCenter
end

function Mesh:edges()
    if self.cachedEdges then
        return self.cachedEdges
    end
    local records = {}
    local ordered = {}
    for faceIndex, face in ipairs(self.faces) do
        for i = 1, 3 do
            local a = face[i]
            local b = face[i % 3 + 1]
            local low, high = min(a, b), max(a, b)
            local key = tostring(low) .. ":" .. tostring(high)
            local record = records[key]
            if not record then
                record = {a = low, b = high, faces = {}, orientation = 0}
                records[key] = record
                ordered[#ordered + 1] = record
            end
            record.faces[#record.faces + 1] = faceIndex
            record.orientation += a == low and 1 or -1
        end
    end
    table.sort(ordered, function(a, b)
        return a.a < b.a or a.a == b.a and a.b < b.b
    end)
    self.cachedEdges = ordered
    return ordered
end

function Mesh:topology()
    local edges = self:edges()
    local boundary = 0
    local nonmanifold = 0
    local inconsistent = 0
    for _, edge in ipairs(edges) do
        if #edge.faces == 1 then
            boundary += 1
        elseif #edge.faces > 2 then
            nonmanifold += 1
        end
        if #edge.faces == 2 and edge.orientation ~= 0 then
            inconsistent += 1
        end
    end
    local euler = #self.vertices - #edges + #self.faces
    return euler, boundary, nonmanifold, inconsistent
end

function Mesh:vertexNormals()
    local accumulators = {}
    for i = 1, #self.vertices do
        accumulators[i] = point(0, 0, 0)
    end
    for index, face in ipairs(self.faces) do
        local normal, area = self:faceGeometry(index)
        for _, vertex in ipairs(face) do
            accumulators[vertex] = accumulators[vertex] + normal * area
        end
    end
    for i, normal in ipairs(accumulators) do
        accumulators[i] = normalize(normal)
    end
    return accumulators
end

function Mesh:adjacency()
    local neighbors = {}
    for i = 1, #self.vertices do
        neighbors[i] = {}
    end
    for _, edge in ipairs(self:edges()) do
        neighbors[edge.a][#neighbors[edge.a] + 1] = edge.b
        neighbors[edge.b][#neighbors[edge.b] + 1] = edge.a
    end
    for _, list in ipairs(neighbors) do
        table.sort(list)
    end
    return neighbors
end

function Mesh:smooth(iterations, strength)
    local adjacency = self:adjacency()
    local pinned = {}
    for _, edge in ipairs(self:edges()) do
        if #edge.faces == 1 then
            pinned[edge.a] = true
            pinned[edge.b] = true
        end
    end
    for _ = 1, iterations do
        local nextVertices = {}
        for index, p in ipairs(self.vertices) do
            local neighbors = adjacency[index]
            local sum = point(0, 0, 0)
            for _, neighbor in ipairs(neighbors) do
                sum = sum + self.vertices[neighbor]
            end
            if pinned[index] or #neighbors == 0 then
                nextVertices[index] = p:clone()
            else
                nextVertices[index] = lerp(p, sum * (1 / #neighbors), strength)
            end
        end
        self.vertices = nextVertices
        self.revision += 1
    end
    return self
end

function Mesh:subdivide()
    local vertices = table.clone(self.vertices)
    local faces = {}
    local midpoints = {}
    local function midpoint(a, b)
        local key = tostring(min(a, b)) .. ":" .. tostring(max(a, b))
        local index = midpoints[key]
        if not index then
            vertices[#vertices + 1] = (vertices[a] + vertices[b]) * 0.5
            index = #vertices
            midpoints[key] = index
        end
        return index
    end
    for _, face in ipairs(self.faces) do
        local a, b, c = face[1], face[2], face[3]
        local ab, bc, ca = midpoint(a, b), midpoint(b, c), midpoint(c, a)
        faces[#faces + 1] = {a, ab, ca}
        faces[#faces + 1] = {ab, b, bc}
        faces[#faces + 1] = {ca, bc, c}
        faces[#faces + 1] = {ab, bc, ca}
    end
    return mesh(vertices, faces)
end

function Mesh:weld()
    local vertices = {}
    local remap = {}
    local lookup = {}
    local faces = {}
    local dropped = 0
    for i, p in ipairs(self.vertices) do
        local key = pointKey(p)
        local index = lookup[key]
        if not index then
            vertices[#vertices + 1] = p:clone()
            index = #vertices
            lookup[key] = index
        end
        remap[i] = index
    end
    for _, face in ipairs(self.faces) do
        local a, b, c = remap[face[1]], remap[face[2]], remap[face[3]]
        if a ~= b and b ~= c and c ~= a then
            faces[#faces + 1] = {a, b, c}
        else
            dropped += 1
        end
    end
    return mesh(vertices, faces), #self.vertices - #vertices, dropped
end

function Mesh:transform(transform, verticalScale, verticalShift)
    for i, p in ipairs(self.vertices) do
        local changed = transform:apply(p)
        changed.z = p.z * verticalScale + verticalShift
        self.vertices[i] = changed
    end
    self.revision += 1
    return self
end

function Mesh:faceIterator(predicate)
    local index = 0
    return function()
        repeat
            index += 1
            if index > #self.faces then
                return nil
            end
            local normal, area, center = self:faceGeometry(index)
            if predicate(index, normal, area, center) then
                return index, self.faces[index], normal, area, center
            end
        until false
    end
end

local function extrude(poly, height)
    local vertices = {}
    local faces = {}
    local cap = triangulate(poly)
    local count = #poly
    for _, p in ipairs(poly) do
        vertices[#vertices + 1] = point(p.x, p.y, 0)
    end
    for _, p in ipairs(poly) do
        vertices[#vertices + 1] = point(p.x, p.y, height)
    end
    for _, triangle in ipairs(cap) do
        faces[#faces + 1] = {triangle[3], triangle[2], triangle[1]}
        faces[#faces + 1] = {triangle[1] + count, triangle[2] + count, triangle[3] + count}
    end
    for i = 1, count do
        local nextIndex = i % count + 1
        faces[#faces + 1] = {i, nextIndex, nextIndex + count}
        faces[#faces + 1] = {i, nextIndex + count, i + count}
    end
    return mesh(vertices, faces)
end

local function rayTriangle(origin, direction, a, b, c)
    local firstEdge = b - a
    local secondEdge = c - a
    local h = cross(direction, secondEdge)
    local determinant = dot(firstEdge, h)
    if abs(determinant) <= EPS then
        return nil, "parallel"
    end
    local inverse = 1 / determinant
    local s = origin - a
    local u = inverse * dot(s, h)
    if u < -EPS or u > 1 + EPS then
        return nil, "u"
    end
    local q = cross(s, firstEdge)
    local v = inverse * dot(direction, q)
    if v < -EPS or u + v > 1 + EPS then
        return nil, "v"
    end
    local distance = inverse * dot(secondEdge, q)
    if distance < -EPS then
        return nil, "behind"
    end
    return distance, u, v
end

local function triangleClosest(p, a, b, c)
    local ab, ac, ap = b - a, c - a, p - a
    local d1, d2 = dot(ab, ap), dot(ac, ap)
    if d1 <= 0 and d2 <= 0 then
        return a, distanceSquared(p, a), 1
    end
    local bp = p - b
    local d3, d4 = dot(ab, bp), dot(ac, bp)
    if d3 >= 0 and d4 <= d3 then
        return b, distanceSquared(p, b), 2
    end
    local vc = d1 * d4 - d3 * d2
    if vc <= 0 and d1 >= 0 and d3 <= 0 then
        local q = lerp(a, b, d1 / (d1 - d3))
        return q, distanceSquared(p, q), 4
    end
    local cp = p - c
    local d5, d6 = dot(ab, cp), dot(ac, cp)
    if d6 >= 0 and d5 <= d6 then
        return c, distanceSquared(p, c), 3
    end
    local vb = d5 * d2 - d1 * d6
    if vb <= 0 and d2 >= 0 and d6 <= 0 then
        local q = lerp(a, c, d2 / (d2 - d6))
        return q, distanceSquared(p, q), 5
    end
    local va = d3 * d6 - d5 * d4
    if va <= 0 and d4 - d3 >= 0 and d5 - d6 >= 0 then
        local q = lerp(b, c, (d4 - d3) / (d4 - d3 + d5 - d6))
        return q, distanceSquared(p, q), 6
    end
    local denominator = 1 / (va + vb + vc)
    local q = a + ab * (vb * denominator) + ac * (vc * denominator)
    return q, distanceSquared(p, q), 7
end

local function buildBVH(surface, leafSize)
    local records = {}
    for index, face in ipairs(surface.faces) do
        local triangle = {surface.vertices[face[1]], surface.vertices[face[2]], surface.vertices[face[3]]}
        local box = bounds(triangle)
        records[index] = {id = index, box = box, center = (box.low + box.high) * 0.5}
    end
    local nodes = 0
    local function build(items, depth)
        nodes += 1
        local box = items[1].box
        for i = 2, #items do
            box = unionBounds(box, items[i].box)
        end
        local node = {box = box, depth = depth}
        if #items <= leafSize then
            node.items = items
            return node
        end
        local extent = box.high - box.low
        local axis = "x"
        if extent.y > extent.x and extent.y >= extent.z then
            axis = "y"
        elseif extent.z > extent.x and extent.z > extent.y then
            axis = "z"
        end
        table.sort(items, function(a, b)
            if a.center[axis] == b.center[axis] then
                return a.id < b.id
            end
            return a.center[axis] < b.center[axis]
        end)
        local left, right = {}, {}
        local middle = floor(#items / 2)
        for i, record in ipairs(items) do
            local destination = i <= middle and left or right
            destination[#destination + 1] = record
        end
        node.left = build(left, depth + 1)
        node.right = build(right, depth + 1)
        node.axis = axis
        return node
    end
    return {root = build(records, 0), surface = surface, nodes = nodes}
end

local function queryBox(tree, target)
    local hits = {}
    local visited = 0
    local function visit(node)
        visited += 1
        if not boxesOverlap(node.box, target) then
            return
        end
        if node.items then
            for _, item in ipairs(node.items) do
                if boxesOverlap(item.box, target) then
                    hits[#hits + 1] = item.id
                end
            end
        else
            visit(node.left)
            visit(node.right)
        end
    end
    visit(tree.root)
    table.sort(hits)
    return hits, visited
end

local function castRay(tree, origin, direction, limit)
    local surface = tree.surface
    local nearest = limit
    local faceId = 0
    local barycentric = {0, 0}
    local visited = 0
    local tested = 0
    local function visit(node)
        visited += 1
        local intersects = rayBox(origin, direction, node.box, nearest)
        if not intersects then
            return
        end
        if node.items then
            for _, item in ipairs(node.items) do
                local face = surface.faces[item.id]
                tested += 1
                local t, u, v = rayTriangle(origin, direction, surface.vertices[face[1]], surface.vertices[face[2]], surface.vertices[face[3]])
                if t and (t < nearest - EPS or abs(t - nearest) <= EPS and item.id < faceId) then
                    nearest = t
                    faceId = item.id
                    barycentric = {u, v}
                end
            end
        else
            local leftHit, leftDistance = rayBox(origin, direction, node.left.box, nearest)
            local rightHit, rightDistance = rayBox(origin, direction, node.right.box, nearest)
            if leftHit and rightHit and rightDistance < leftDistance then
                visit(node.right)
                visit(node.left)
            else
                if leftHit then
                    visit(node.left)
                end
                if rightHit then
                    visit(node.right)
                end
            end
        end
    end
    visit(tree.root)
    return faceId, nearest, barycentric, visited, tested
end

local function nearestSurface(tree, p)
    local bestDistance = math.huge
    local bestPoint = nil
    local bestFace = 0
    local bestRegion = 0
    local visited = 0
    local function visit(node)
        visited += 1
        if boxDistanceSquared(node.box, p) > bestDistance + EPS then
            return
        end
        if node.items then
            for _, item in ipairs(node.items) do
                local face = tree.surface.faces[item.id]
                local vertices = tree.surface.vertices
                local q, distance, region = triangleClosest(p, vertices[face[1]], vertices[face[2]], vertices[face[3]])
                if distance < bestDistance - EPS or abs(distance - bestDistance) <= EPS and item.id < bestFace then
                    bestDistance = distance
                    bestPoint = q
                    bestFace = item.id
                    bestRegion = region
                end
            end
        else
            local leftDistance = boxDistanceSquared(node.left.box, p)
            local rightDistance = boxDistanceSquared(node.right.box, p)
            if leftDistance <= rightDistance then
                visit(node.left)
                visit(node.right)
            else
                visit(node.right)
                visit(node.left)
            end
        end
    end
    visit(tree.root)
    return bestPoint, bestDistance, bestFace, bestRegion, visited
end

local function sliceMesh(surface, height)
    local segments = {}
    for faceId, face in ipairs(surface.faces) do
        local intersections = {}
        local seen = {}
        for i = 1, 3 do
            local a = surface.vertices[face[i]]
            local b = surface.vertices[face[i % 3 + 1]]
            local da, db = a.z - height, b.z - height
            local p = nil
            if abs(da) <= EPS then
                p = a:clone()
            elseif da * db < 0 then
                p = lerp(a, b, da / (da - db))
            end
            if p then
                local key = pointKey(p)
                if not seen[key] then
                    seen[key] = true
                    intersections[#intersections + 1] = p
                end
            end
        end
        if #intersections == 2 then
            segments[#segments + 1] = {a = intersections[1], b = intersections[2], face = faceId}
        end
    end
    return segments
end

local function stitchSegments(segments)
    local incidents = {}
    for index, segment in ipairs(segments) do
        for _, p in ipairs({segment.a, segment.b}) do
            local key = pointKey(p)
            incidents[key] = incidents[key] or {}
            table.insert(incidents[key], index)
        end
    end
    local used = {}
    local paths = {}
    for startIndex, segment in ipairs(segments) do
        if not used[startIndex] then
            local path = {segment.a, segment.b}
            used[startIndex] = true
            local current = segment.b
            while true do
                local nextIndex = nil
                for _, index in ipairs(incidents[pointKey(current)] or {}) do
                    if not used[index] then
                        nextIndex = index
                        break
                    end
                end
                if not nextIndex then
                    break
                end
                used[nextIndex] = true
                local nextSegment = segments[nextIndex]
                current = samePoint(current, nextSegment.a) and nextSegment.b or nextSegment.a
                path[#path + 1] = current
                if samePoint(current, path[1]) then
                    break
                end
            end
            paths[#paths + 1] = path
        end
    end
    return paths
end

local Grid = {}
Grid.__index = Grid
local function grid(width, height, cellSize, origin)
    local rows = {}
    for y = 1, height do
        rows[y] = table.create(width, false)
    end
    return setmetatable({width = width, height = height, cellSize = cellSize, origin = origin, rows = rows}, Grid)
end

function Grid:center(x, y)
    return point(self.origin.x + (x - 0.5) * self.cellSize, self.origin.y + (y - 0.5) * self.cellSize)
end

function Grid:inside(x, y)
    return x >= 1 and y >= 1 and x <= self.width and y <= self.height
end

function Grid:paint(poly, value)
    local changed = 0
    for y = 1, self.height do
        for x = 1, self.width do
            if contains(poly, self:center(x, y)) and self.rows[y][x] ~= value then
                self.rows[y][x] = value
                changed += 1
            end
        end
    end
    return changed
end

function Grid:counts()
    local filled = 0
    local transitions = 0
    local hash = 23
    for y, row in ipairs(self.rows) do
        for x, value in ipairs(row) do
            if value then
                filled += 1
                hash = (hash * 131 + x * 17 + y) % MOD
            end
            if x > 1 and value ~= row[x - 1] then
                transitions += 1
            end
            if y > 1 and value ~= self.rows[y - 1][x] then
                transitions += 1
            end
        end
    end
    return filled, transitions, hash
end

function Grid:dilate(radius)
    local result = grid(self.width, self.height, self.cellSize, self.origin)
    for y = 1, self.height do
        for x = 1, self.width do
            if self.rows[y][x] then
                for dy = -radius, radius do
                    for dx = -radius, radius do
                        if dx * dx + dy * dy <= radius * radius and result:inside(x + dx, y + dy) then
                            result.rows[y + dy][x + dx] = true
                        end
                    end
                end
            end
        end
    end
    return result
end

function Grid:components(value)
    local labels = {}
    for y = 1, self.height do
        labels[y] = table.create(self.width, 0)
    end
    local components = {}
    local offsets = {{1, 0}, {0, 1}, {-1, 0}, {0, -1}}
    for y = 1, self.height do
        for x = 1, self.width do
            if self.rows[y][x] == value and labels[y][x] == 0 then
                local id = #components + 1
                local queue = {{x, y}}
                local head = 1
                local cells = 0
                local border = 0
                labels[y][x] = id
                while head <= #queue do
                    local current = queue[head]
                    head += 1
                    cells += 1
                    for _, offset in ipairs(offsets) do
                        local nx, ny = current[1] + offset[1], current[2] + offset[2]
                        if not self:inside(nx, ny) or self.rows[ny][nx] ~= value then
                            border += 1
                        elseif labels[ny][nx] == 0 then
                            labels[ny][nx] = id
                            queue[#queue + 1] = {nx, ny}
                        end
                    end
                end
                components[id] = {size = cells, border = border, start = {x, y}}
            end
        end
    end
    return components, labels
end

function Grid:distanceField()
    local distances = {}
    local queue = {}
    for y = 1, self.height do
        distances[y] = {}
        for x = 1, self.width do
            distances[y][x] = self.rows[y][x] and 0 or math.huge
            if self.rows[y][x] then
                queue[#queue + 1] = {x, y}
            end
        end
    end
    local head = 1
    local offsets = {{1, 0}, {0, 1}, {-1, 0}, {0, -1}}
    while head <= #queue do
        local current = queue[head]
        head += 1
        local x, y = current[1], current[2]
        for _, offset in ipairs(offsets) do
            local nx, ny = x + offset[1], y + offset[2]
            if self:inside(nx, ny) and distances[ny][nx] > distances[y][x] + 1 then
                distances[ny][nx] = distances[y][x] + 1
                queue[#queue + 1] = {nx, ny}
            end
        end
    end
    return distances, #queue
end

function Grid:route(startX, startY, goalX, goalY)
    local queue = {{startX, startY}}
    local parents = {}
    local function key(x, y)
        return (y - 1) * self.width + x
    end
    parents[key(startX, startY)] = false
    local head = 1
    local offsets = {{1, 0}, {0, 1}, {-1, 0}, {0, -1}}
    while head <= #queue do
        local current = queue[head]
        head += 1
        local x, y = current[1], current[2]
        if x == goalX and y == goalY then
            local path = {}
            local cursor = current
            while cursor do
                table.insert(path, 1, self:center(cursor[1], cursor[2]))
                cursor = parents[key(cursor[1], cursor[2])]
            end
            return path, head - 1
        end
        for _, offset in ipairs(offsets) do
            local nx, ny = x + offset[1], y + offset[2]
            local nextKey = key(nx, ny)
            if self:inside(nx, ny) and not self.rows[ny][nx] and parents[nextKey] == nil then
                parents[nextKey] = current
                queue[#queue + 1] = {nx, ny}
            end
        end
    end
    return {}, head - 1
end

local function contourGrid(raster)
    local segments = {}
    local function corner(x, y)
        return point(raster.origin.x + x * raster.cellSize, raster.origin.y + y * raster.cellSize)
    end
    for y = 1, raster.height do
        for x = 1, raster.width do
            if raster.rows[y][x] then
                local edges = {
                    {x, y - 1, x - 1, y - 1, 0, -1},
                    {x, y, x, y - 1, 1, 0},
                    {x - 1, y, x, y, 0, 1},
                    {x - 1, y - 1, x - 1, y, -1, 0},
                }
                for _, edge in ipairs(edges) do
                    local nx, ny = x + edge[5], y + edge[6]
                    if not raster:inside(nx, ny) or not raster.rows[ny][nx] then
                        segments[#segments + 1] = {a = corner(edge[1], edge[2]), b = corner(edge[3], edge[4])}
                    end
                end
            end
        end
    end
    return stitchSegments(segments), #segments
end

local function reportPolygon(label, poly)
    local center, area = centroid(poly)
    local xx, yy, xy = polygonMoments(poly)
    emit(label, #poly, area, perimeter(poly), center.x, center.y, xx, yy, xy, pointsHash(poly))
end

local function check(condition, message)
    if not condition then
        error(message, 0)
    end
end

local function runPolygonSuite(nextInt)
    local cloud = {}
    for i = 1, 19 + mode % 4 do
        cloud[i] = point(nextInt(-15, 15), nextInt(-12, 12))
    end
    cloud[#cloud + 1] = cloud[1]:clone()
    local hull = convexHull(cloud)
    local cleaned = cleanPolygon(hull)
    check(#cleaned >= 3, "cloud hull collapsed")
    reportPolygon("hull", cleaned)
    local transform = matrix(1, mode % 2, 0, 1, seed % 5 - 2, seed % 7 - 3)
    local rotation = matrix(0, 1, -1, 0, 1, -1)
    local composed = transform:compose(rotation)
    local inverse, determinant = composed:inverse()
    local moved = transformed(cleaned, composed)
    local recovered = transformed(moved, inverse)
    check(pointsHash(recovered) == pointsHash(cleaned), "affine inverse mismatch")
    local direction = composed:direction(point(2, -3))
    emit("affine", determinant, direction.x, direction.y, pointsHash(moved), pointsHash(recovered))
    local clipper = {point(-9, -8), point(11, -8), point(11, 9), point(-9, 9)}
    local clipped, history = clipConvex(cleaned, clipper)
    check(#clipped >= 3, "clipped hull collapsed")
    reportPolygon("clipped", clipped)
    emit("clip-history", table.concat(history, ","))
    local concave = cleanPolygon({point(-8, -6), point(8, -6), point(8, 6), point(3, 6), point(3, 0), point(-2, 0), point(-2, 6), point(-8, 6)})
    local triangles, attempts = triangulate(concave)
    local area = 0
    for _, triangle in ipairs(triangles) do
        area += orient(concave[triangle[1]], concave[triangle[2]], concave[triangle[3]]) / 2
    end
    check(abs(area - signedArea(concave)) <= EPS, "ear area mismatch")
    emit("ears", #triangles, attempts, area)
    reportPolygon("concave", concave)
    local samplePoints, sampleLength = resample(concave, 24)
    samplePoints[#samplePoints + 1] = samplePoints[1]
    local reduced = simplifyPath(samplePoints, 0.7)
    emit("resample", #samplePoints, sampleLength, #reduced, pointsHash(reduced))
    local sum = minkowskiSum(clipped, {point(-1, -1), point(2, -1), point(0, 2)})
    reportPolygon("minkowski", sum)
    for query = 1, 7 do
        local p = point(nextInt(-20, 20), nextInt(-18, 18))
        local inside, classification = contains(concave, p)
        local nearest, distance, edge = nearestBoundary(concave, p)
        local extreme, value, vertex = support(cleaned, p)
        emit("polygon-query", query, p.x, p.y, inside, classification, distance, edge, nearest.x, nearest.y, value, vertex, extreme.x)
    end
    for shift = -2, 2 do
        local other = transformed(clipped, matrix(1, 0, 0, 1, shift * 12, mode - 2))
        local overlaps, depth, axis, tested = separatingAxis(cleaned, other)
        emit("sat", shift, overlaps, depth, axis.x, axis.y, tested)
    end
    local fixtures = {
        {point(0, 0), point(8, 8), point(0, 8), point(8, 0)},
        {point(0, 0), point(8, 0), point(3, 0), point(9, 0)},
        {point(0, 0), point(8, 0), point(0, 1), point(8, 1)},
        {point(0, 0), point(2, 0), point(4, -1), point(4, 1)},
    }
    for i, fixture in ipairs(fixtures) do
        local hit, t, kind = segmentIntersection(fixture[1], fixture[2], fixture[3], fixture[4])
        emit("segment", i, hit ~= nil, t, kind, hit and hit.x or 0, hit and hit.y or 0)
    end
    return clipped, concave, composed
end

local function runMeshSuite(poly, transform, nextInt)
    local height = 5 + abs(seed) % 4
    local surface = extrude(poly, height)
    local area, volume, center = surface:measure()
    check(abs(volume - signedArea(poly) * height) < 0.001, "extrusion volume mismatch")
    local euler, boundary, nonmanifold, inconsistent = surface:topology()
    check(euler == 2 and boundary == 0 and nonmanifold == 0 and inconsistent == 0, "extrusion topology mismatch")
    emit("extrude", #surface.vertices, #surface.faces, area, volume, center.x, center.y, center.z, euler)
    local duplicate = surface:clone()
    duplicate.vertices[#duplicate.vertices + 1] = duplicate.vertices[1]:clone()
    duplicate.faces[#duplicate.faces + 1] = {1, #duplicate.vertices, 2}
    local welded, merged, dropped = duplicate:weld()
    emit("weld", merged, dropped, #welded.vertices, #welded.faces)
    local refined = welded:subdivide()
    local fineArea, fineVolume = refined:measure()
    check(abs(fineArea - area) < 0.001 and abs(fineVolume - volume) < 0.001, "subdivision conservation mismatch")
    emit("subdivide", #refined.vertices, #refined.faces, fineArea, fineVolume, refined:topology())
    local smooth = refined:clone():smooth(1 + mode % 2, 0.2)
    local smoothArea, smoothVolume, smoothCenter = smooth:measure()
    emit("smooth", smooth.revision, smoothArea, smoothVolume, smoothCenter.x, smoothCenter.z)
    local normals = smooth:vertexNormals()
    emit("normals", pointsHash(normals), #normals)
    local visible = 0
    local visibleArea = 0
    local camera = point(21, -17, 24)
    for index, face, normal, faceArea, faceCenter in smooth:faceIterator(function(_, n, _, c)
        return dot(n, camera - c) > 0
    end) do
        visible += index + face[1] % 3
        visibleArea += faceArea + dot(normal, faceCenter) * 0.001
    end
    emit("culling", visible, visibleArea)
    surface:transform(transform, 1, mode)
    local tree = buildBVH(surface, 3 + mode % 2)
    emit("bvh", tree.nodes, #surface:edges(), surface.revision)
    local box = bounds(surface.vertices)
    local boxCenter = (box.low + box.high) * 0.5
    for query = 1, 8 do
        local p = point(nextInt(-25, 25), nextInt(-25, 25), nextInt(-5, 18))
        local target = bounds({p - point(4, 4, 4), p + point(4, 4, 4)})
        local hits, visited = queryBox(tree, target)
        local sum = 0
        for _, id in ipairs(hits) do
            sum += id
        end
        emit("box-query", query, #hits, sum, visited)
        local nearest, distance, face, region, nearVisited = nearestSurface(tree, p)
        emit("nearest", query, distance, face, region, nearest.x, nearest.y, nearest.z, nearVisited)
        local direction = normalize(boxCenter - p)
        local rayFace, rayDistance, barycentric, rayVisited, tested = castRay(tree, p, direction, 100)
        emit("ray", query, rayFace, rayDistance, barycentric[1], barycentric[2], rayVisited, tested)
    end
    for _, fraction in ipairs({0, 0.25, 0.5, 0.75, 1, 1.25}) do
        local z = mode + fraction * height
        local segments = sliceMesh(surface, z)
        local paths = stitchSegments(segments)
        local length = 0
        local pathHash = 3
        for _, path in ipairs(paths) do
            pathHash = (pathHash * 131 + pointsHash(path)) % MOD
            for i = 2, #path do
                length += math.sqrt(distanceSquared(path[i - 1], path[i]))
            end
        end
        emit("slice", z, #segments, #paths, length, pathHash)
    end
    return surface
end

local function runRasterSuite(poly, concave)
    local raster = grid(25, 23, 2, point(-25, -23))
    local first = raster:paint(poly, true)
    local cutout = transformed(concave, matrix(0.5, 0, 0, 0.5, 0, 0))
    local removed = raster:paint(cutout, false)
    emit("raster", first, removed, raster:counts())
    local components, labels = raster:components(true)
    for i, component in ipairs(components) do
        emit("component", i, component.size, component.border, component.start[1], component.start[2], labels[component.start[2]][component.start[1]])
    end
    local empty = raster:components(false)
    emit("empty-components", #empty)
    local enlarged = raster:dilate(1 + mode % 2)
    emit("dilation", enlarged:counts())
    local distances, visits = raster:distanceField()
    local distanceSum = 0
    local largest = 0
    for _, row in ipairs(distances) do
        for _, value in ipairs(row) do
            distanceSum += value
            largest = max(largest, value)
        end
    end
    emit("distance-field", visits, distanceSum, largest)
    local path, searched = enlarged:route(1, 1, enlarged.width, enlarged.height)
    local simplified = simplifyPath(path, 0.01)
    emit("route", #path, #simplified, searched, pointsHash(path), pointsHash(simplified))
    local contours, edgeCount = contourGrid(raster)
    local contourHash = 0
    local closed = 0
    for _, contour in ipairs(contours) do
        if samePoint(contour[1], contour[#contour]) then
            closed += 1
        end
        contourHash = (contourHash * 131 + pointsHash(contour)) % MOD
    end
    emit("contours", #contours, closed, edgeCount, contourHash)
    return raster
end

local function runDegeneracies()
    local singular, reason = matrix(1, 2, 2, 4, 0, 0):inverse()
    emit("singular", singular == nil, reason)
    local empty = clipHalfPlane({}, point(0, 0), point(1, 0))
    local collinear = convexHull({point(0, 0), point(1, 1), point(2, 2), point(1, 1)})
    local center, area = centroid(collinear)
    local unit, length = normalize(point(0, 0))
    emit("degenerate", #empty, #collinear, center.x, center.y, area, unit.x, length)
    local ok, message = pcall(function()
        triangulate({point(0, 0), point(1, 0), point(2, 0), point(3, 0)})
    end)
    emit("caught", ok, message)
    local p, distance, t = closestSegment(point(4, 3), point(1, 1), point(1, 1))
    emit("zero-segment", p.x, p.y, distance, t)
    local box = bounds({point(-1, -1, -1), point(1, 1, 1)})
    local hit, near, far = rayBox(point(2, 0, 0), point(0, 1, 0), box, 5)
    emit("parallel-box", hit, near, far)
end

emit("input", seed, mode)
local nextInt, generatorState = makeGenerator(seed + mode * 47)
local polygon, concave, transform = runPolygonSuite(nextInt)
local surface = runMeshSuite(polygon, transform, nextInt)
local raster = runRasterSuite(polygon, concave)
runDegeneracies()
local state, calls = generatorState()
emit("final-state", state, calls, #surface.vertices, raster.width, raster.height)
print("geometry-checksum:" .. tostring(traceHash) .. ":" .. tostring(traceCount))
