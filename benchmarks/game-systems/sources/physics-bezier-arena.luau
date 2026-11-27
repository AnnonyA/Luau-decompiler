-- Original synthetic fixed-step arena. No Roblox runtime or external modules.
-- Coordinates are simulated in two dimensions; reports quantize only at output.
local rawSeed, rawMode = ...
local seed = tonumber(rawSeed) or 17
local mode = tonumber(rawMode) or 0
local abs, floor, sqrt = math.abs, math.floor, math.sqrt
local min, max = math.min, math.max
local function clamp(x, lo, hi)
    if x < lo then return lo end
    if x > hi then return hi end
    return x
end
local function point(x, y)
    return {x = x, y = y}
end
local function add(a, b) return point(a.x + b.x, a.y + b.y) end
local function sub(a, b) return point(a.x - b.x, a.y - b.y) end
local function scale(a, k) return point(a.x * k, a.y * k) end
local function dot(a, b) return a.x * b.x + a.y * b.y end
local function norm(a) return sqrt(dot(a, a)) end
local function unit(a)
    local n = norm(a)
    if n < 1e-10 then return point(1, 0), 0 end
    return scale(a, 1 / n), n
end
local function lerp(a, b, t)
    return add(scale(a, 1 - t), scale(b, t))
end
local function quantize(x)
    if x < 0 then return -floor(-x * 10000 + 0.5) end
    return floor(x * 10000 + 0.5)
end
local function randomStream(initial)
    local state = abs(floor(initial)) % 2147483647 + 1
    return function(lo, hi)
        state = (state * 48271) % 2147483647
        return lo + (state % (hi - lo + 1))
    end
end
local random = randomStream(seed)

local Curve = {}
Curve.__index = Curve
function Curve.new(a, b, c, d)
    local self = setmetatable({a = a, b = b, c = c, d = d, lengths = {0}, total = 0}, Curve)
    local previous = a
    for i = 1, 48 do
        local current = self:At(i / 48)
        self.total += norm(sub(current, previous))
        self.lengths[i + 1] = self.total
        previous = current
    end
    return self
end
function Curve:At(t)
    local ab, bc, cd = lerp(self.a, self.b, t), lerp(self.b, self.c, t), lerp(self.c, self.d, t)
    return lerp(lerp(ab, bc, t), lerp(bc, cd, t), t)
end
function Curve:Tangent(t)
    local left = scale(sub(self.b, self.a), 3 * (1 - t) * (1 - t))
    local middle = scale(sub(self.c, self.b), 6 * (1 - t) * t)
    local right = scale(sub(self.d, self.c), 3 * t * t)
    return unit(add(add(left, middle), right))
end
function Curve:AtDistance(distance)
    distance = clamp(distance, 0, self.total)
    local lo, hi = 1, #self.lengths
    while lo + 1 < hi do
        local middle = floor((lo + hi) / 2)
        if self.lengths[middle] <= distance then lo = middle else hi = middle end
    end
    local span = self.lengths[hi] - self.lengths[lo]
    local blend = if span > 0 then (distance - self.lengths[lo]) / span else 0
    local t = ((lo - 1) + blend) / 48
    return self:At(t), self:Tangent(t), t
end
function Curve:Split(t)
    local ab, bc, cd = lerp(self.a, self.b, t), lerp(self.b, self.c, t), lerp(self.c, self.d, t)
    local abc, bcd = lerp(ab, bc, t), lerp(bc, cd, t)
    local center = lerp(abc, bcd, t)
    return Curve.new(self.a, ab, abc, center), Curve.new(center, bcd, cd, self.d)
end

local Signal = {}
Signal.__index = Signal
function Signal.new()
    return setmetatable({slots = {}, pending = {}, emitting = 0, nextId = 0}, Signal)
end
function Signal:Connect(callback, once)
    self.nextId += 1
    local slot = {id = self.nextId, callback = callback, once = once, live = true}
    local destination = if self.emitting > 0 then self.pending else self.slots
    destination[#destination + 1] = slot
    local disconnected = false
    return function()
        if disconnected then return false end
        disconnected = true
        slot.live = false
        return true
    end
end
function Signal:Emit(...)
    self.emitting += 1
    local arguments = table.pack(...)
    local limit = #self.slots
    for i = 1, limit do
        local slot = self.slots[i]
        if slot.live then
            if slot.once then slot.live = false end
            slot.callback(table.unpack(arguments, 1, arguments.n))
        end
    end
    self.emitting -= 1
    if self.emitting == 0 then
        local survivors = {}
        for _, slot in ipairs(self.slots) do
            if slot.live then survivors[#survivors + 1] = slot end
        end
        for _, slot in ipairs(self.pending) do
            if slot.live then survivors[#survivors + 1] = slot end
        end
        self.slots, self.pending = survivors, {}
    end
end

local function sweepCircle(start, finish, center, radius)
    local delta, offset = sub(finish, start), sub(start, center)
    local a, b = dot(delta, delta), 2 * dot(offset, delta)
    local c = dot(offset, offset) - radius * radius
    if c <= 0 then return 0, unit(offset) end
    if a < 1e-12 then return nil end
    local discriminant = b * b - 4 * a * c
    if discriminant < 0 then return nil end
    local t = (-b - sqrt(discriminant)) / (2 * a)
    if t < 0 or t > 1 then return nil end
    return t, unit(sub(lerp(start, finish, t), center))
end

local World = {}
World.__index = World
function World.new(path)
    return setmetatable({path = path, bodies = {}, obstacles = {}, tick = 0,
        impacts = Signal.new(), score = 0, contacts = 0, deferred = {}, trace = {}}, World)
end
function World:AddBody(id, position, velocity, inverseMass, restitution)
    assert(not self.bodies[id], "duplicate body")
    local body = {id = id, position = position, previous = position, velocity = velocity,
        force = point(0, 0), inverseMass = inverseMass, restitution = restitution,
        radius = 0.24, alive = true, travelled = 0, hits = 0}
    self.bodies[id] = body
    return body
end
function World:AddObstacle(center, radius, material)
    self.obstacles[#self.obstacles + 1] = {center = center, radius = radius, material = material}
end
function World:Apply(id, force)
    local body = self.bodies[id]
    assert(body and body.alive, "invalid force target")
    body.force = add(body.force, force)
end
function World:Resolve(body, nextPosition)
    local bestTime, bestNormal, bestObstacle = nil, nil, nil
    for _, obstacle in ipairs(self.obstacles) do
        local t, normal = sweepCircle(body.position, nextPosition, obstacle.center, obstacle.radius + body.radius)
        if t and (not bestTime or t < bestTime) then
            bestTime, bestNormal, bestObstacle = t, normal, obstacle
        end
    end
    if bestTime then
        local impact = lerp(body.position, nextPosition, bestTime)
        local incoming = dot(body.velocity, bestNormal)
        if incoming < 0 then
            body.velocity = sub(body.velocity, scale(bestNormal, (1 + body.restitution) * incoming))
        end
        nextPosition = add(impact, scale(bestNormal, 0.0001))
        body.hits += 1
        self.contacts += 1
        self.impacts:Emit(body.id, bestObstacle.material, nil, self.tick)
    end
    if nextPosition.y < body.radius then
        nextPosition.y = body.radius
        body.velocity.y = abs(body.velocity.y) * body.restitution
        self.contacts += 1
    end
    if nextPosition.x < -7 or nextPosition.x > 7 then
        nextPosition.x = clamp(nextPosition.x, -7, 7)
        body.velocity.x = -body.velocity.x * body.restitution
    end
    return nextPosition
end
function World:Step(dt)
    self.tick += 1
    for id = 1, #self.bodies do
        local body = self.bodies[id]
        if not body.alive then continue end
        local before = body.position
        body.previous = before
        local acceleration = add(scale(body.force, body.inverseMass), point(0, -4.5))
        body.velocity = add(body.velocity, scale(acceleration, dt))
        body.velocity = scale(body.velocity, 1 / (1 + dt * 0.08))
        body.position = self:Resolve(body, add(before, scale(body.velocity, dt)))
        body.travelled += norm(sub(body.position, before))
        body.force = point(0, 0)
    end
    local deferred = self.deferred
    self.deferred = {}
    for _, callback in ipairs(deferred) do callback() end
    if self.tick % 16 == 0 then
        local energy = 0
        for _, body in ipairs(self.bodies) do
            energy += dot(body.velocity, body.velocity) / max(body.inverseMass, 0.01)
        end
        self.trace[#self.trace + 1] = quantize(energy)
    end
end
function World:Snapshot()
    local result = {tick = self.tick, contacts = self.contacts, score = self.score, bodies = {}}
    for id, body in ipairs(self.bodies) do
        result.bodies[id] = {x = body.position.x, y = body.position.y,
            vx = body.velocity.x, vy = body.velocity.y, hits = body.hits, travelled = body.travelled}
    end
    return result
end
function World:Restore(snapshot)
    self.tick, self.contacts, self.score = snapshot.tick, snapshot.contacts, snapshot.score
    self.deferred, self.trace = {}, {}
    for id, saved in ipairs(snapshot.bodies) do
        local body = self.bodies[id]
        body.position = point(saved.x, saved.y)
        body.previous = body.position
        body.velocity = point(saved.vx, saved.vy)
        body.force = point(0, 0)
        body.hits, body.travelled = saved.hits, saved.travelled
    end
end
function World:Fingerprint()
    local hash = (self.tick * 17 + self.contacts * 31 + self.score * 43) % 1000000007
    for _, body in ipairs(self.bodies) do
        for _, value in ipairs({body.position.x, body.position.y, body.velocity.x, body.velocity.y, body.travelled}) do
            hash = (hash * 131 + quantize(value)) % 1000000007
        end
        hash = (hash * 131 + body.hits) % 1000000007
    end
    return hash
end

local function makeDriver(world, targetId, path, gain)
    local distance, active, lastTarget = 0, true, path.a
    local function step(dt)
        if not active then return lastTarget, nil, false end
        distance = min(path.total, distance + dt * (2 + gain))
        local target, tangent, parameter = path:AtDistance(distance)
        local body = world.bodies[targetId]
        local steering = add(scale(sub(target, body.position), gain), scale(tangent, 0.3))
        world:Apply(targetId, steering)
        lastTarget = target
        return target, parameter, distance < path.total
    end
    local function stop()
        local wasActive = active
        active = false
        return wasActive
    end
    return step, stop
end
local function fixedClock(step, dt)
    local accumulator, executed = 0, 0
    return function(frame)
        accumulator += frame
        local iterations = 0
        while accumulator + 1e-12 >= dt do
            step(dt)
            accumulator -= dt
            executed += 1
            iterations += 1
            assert(iterations <= 20, "spiral of death")
        end
        return executed, accumulator / dt
    end
end
local function makeCounter()
    local count = 0
    return function(delta)
        count += delta
        return count
    end
end
local function sharedMarker() return "arena-marker" end

local path = Curve.new(point(-5, 2), point(-3, 8), point(3, 8 + mode), point(5, 2))
local left, right = path:Split(0.375)
assert(norm(sub(left.d, right.a)) < 1e-9, "split seam")
assert(norm(sub(path:At(0.375), left.d)) < 1e-9, "split point")
local world = World.new(path)
world:AddObstacle(point(0, 2.2), 0.75, "stone")
world:AddObstacle(point(3.2, 1.3), 0.45, "metal")
for id = 1, 5 do
    world:AddBody(id, point(-4 + id, 1 + id * 0.65),
        point(random(-8, 8) / 5, random(1, 7) / 3), 0.7 + id * 0.15, 0.45 + id * 0.04)
end
local reportCount, onceCount, lateCount = 0, 0, 0
local unsubscribe
unsubscribe = world.impacts:Connect(function(id, material, hole, tick)
    assert(hole == nil and type(tick) == "number", "impact tuple lost nil")
    reportCount += 1
    world.score += id + #material
    if reportCount == 1 then
        world.impacts:Connect(function() lateCount += 1 end)
    end
    if reportCount == 4 then
        world.deferred[#world.deferred + 1] = function() assert(unsubscribe()) end
    end
end)
world.impacts:Connect(function() onceCount += 1 end, true)
local driver, stopDriver = makeDriver(world, 1, path, 3 + mode)
local function step(dt)
    local target, parameter, continuing = driver(dt)
    if continuing then assert(parameter >= 0 and parameter <= 1 and target.x == target.x) end
    world:Step(dt)
end
local advance = fixedClock(step, 1 / 64)
for frame = 1, 80 do
    local dt = if frame % 3 == 0 then 3 / 64 else 1 / 64
    advance(dt)
end
assert(stopDriver() and not stopDriver(), "driver cancellation must be idempotent")
-- The rollback check covers physics state after event delivery has stopped.
world.impacts = Signal.new()
local beforeRollback = world:Snapshot()
for _ = 1, 16 do world:Step(1 / 64) end
local predicted = world:Fingerprint()
world:Restore(beforeRollback)
for _ = 1, 16 do world:Step(1 / 64) end
assert(world:Fingerprint() == predicted, "rollback divergence")
local keys = {[driver] = "driver", [stopDriver] = "stop"}
assert(keys[driver] == "driver" and keys[stopDriver] == "stop", "callback identity")
local counterA, counterB = makeCounter(), makeCounter()
assert(counterA ~= counterB and counterA(2) == 2 and counterB(7) == 7 and counterA(3) == 5, "counter isolation")
assert(onceCount == min(1, reportCount) and reportCount <= 8, "signal lifecycle")
assert(lateCount >= max(0, reportCount - 1), "deferred subscription delivery")
print("arena", seed, mode, world.tick, world.contacts, world.score, predicted)
print("curve", quantize(path.total), quantize(left.total + right.total), quantize(path:Tangent(0.5).x))
print("signals", reportCount, onceCount, lateCount, keys[driver], keys[stopDriver])
for id, body in ipairs(world.bodies) do
    assert(body.position.y >= body.radius - 1e-9, "floor penetration")
    print("body", id, quantize(body.position.x), quantize(body.position.y), body.hits, quantize(body.travelled))
end
print("identity", counterA == counterB, counterA(1), counterB(1))
return sharedMarker, makeCounter(), predicted
