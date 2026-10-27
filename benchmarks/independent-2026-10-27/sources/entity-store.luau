-- Original system: generational entities, sparse components, and deferred queries.
local seedArg, modeArg = ...
local seed = tonumber(seedArg) or 0
local mode = tonumber(modeArg) or 0
local trace = {}
local function note(kind, a, b)
    trace[#trace + 1] = kind .. ":" .. tostring(a) .. ":" .. tostring(b)
end

local Store = {}
Store.__index = Store
function Store.new()
    return setmetatable({dense = {}, sparse = {}, values = {}}, Store)
end
function Store:set(id, value)
    local position = self.sparse[id]
    if position == nil then
        position = #self.dense + 1
        self.dense[position] = id
        self.sparse[id] = position
    end
    self.values[position] = value
end
function Store:get(id)
    local position = self.sparse[id]
    if position == nil then
        return nil
    end
    return self.values[position]
end
function Store:remove(id)
    local position = self.sparse[id]
    if position == nil then
        return false
    end
    local last = #self.dense
    local moved = self.dense[last]
    self.dense[position] = moved
    self.values[position] = self.values[last]
    self.sparse[moved] = position
    self.dense[last] = nil
    self.values[last] = nil
    self.sparse[id] = nil
    return true
end
function Store:verify()
    for position, id in ipairs(self.dense) do
        assert(self.sparse[id] == position, "sparse index drift")
        assert(self.values[position] ~= nil, "missing dense value")
    end
end

local World = {}
World.__index = World
function World.new()
    return setmetatable({
        nextId = 0, generation = {}, alive = {}, available = {},
        positions = Store.new(), velocities = Store.new(), health = Store.new(),
        pending = {}, listeners = {}, revision = 0,
    }, World)
end
function World:onChange(callback)
    local slot = #self.listeners + 1
    local enabled = true
    self.listeners[slot] = function(kind, id)
        if enabled then
            callback(kind, id, self.revision)
        end
    end
    return function()
        enabled = false
    end
end
function World:emit(kind, id)
    self.revision += 1
    for _, listener in ipairs(self.listeners) do
        listener(kind, id)
    end
end
function World:spawn(x, velocity, health)
    local id = table.remove(self.available)
    if id == nil then
        self.nextId += 1
        id = self.nextId
    end
    local generation = (self.generation[id] or 0) + 1
    self.generation[id] = generation
    self.alive[id] = true
    self.positions:set(id, {x = x, history = 0})
    if velocity ~= nil then
        self.velocities:set(id, velocity)
    end
    self.health:set(id, health)
    self:emit("spawn", id)
    return {id = id, generation = generation}
end
function World:valid(handle)
    return self.alive[handle.id] == true and self.generation[handle.id] == handle.generation
end
function World:destroy(handle)
    if not self:valid(handle) then
        return false
    end
    local id = handle.id
    self.alive[id] = nil
    self.positions:remove(id)
    self.velocities:remove(id)
    self.health:remove(id)
    self.available[#self.available + 1] = id
    self:emit("destroy", id)
    return true
end
function World:view(handle)
    local world = self
    return setmetatable({}, {
        __index = function(_, key)
            if not world:valid(handle) then
                return nil
            end
            if key == "x" then
                return world.positions:get(handle.id).x
            elseif key == "health" then
                return world.health:get(handle.id)
            end
            return handle[key]
        end,
        __newindex = function(_, key, value)
            assert(world:valid(handle), "expired entity view")
            if key == "x" then
                world.positions:get(handle.id).x = value
            elseif key == "health" then
                world.health:set(handle.id, value)
            else
                error("unknown entity property")
            end
            world:emit("write", handle.id)
        end,
    })
end
function World:defer(callback)
    self.pending[#self.pending + 1] = callback
end
function World:flush()
    local batch = self.pending
    self.pending = {}
    for _, callback in ipairs(batch) do
        callback()
    end
    return #batch
end
function World:query(callback)
    -- A snapshot makes structural mutation through deferred callbacks explicit.
    local snapshot = {}
    for _, id in ipairs(self.positions.dense) do
        snapshot[#snapshot + 1] = {id = id, generation = self.generation[id]}
    end
    table.sort(snapshot, function(a, b)
        return a.id < b.id
    end)
    for _, handle in ipairs(snapshot) do
        if self:valid(handle) then
            local velocity = self.velocities:get(handle.id)
            if velocity ~= nil then
                callback(handle, self.positions:get(handle.id), velocity)
            end
        end
    end
end

local world = World.new()
local audit = {count = 0, checksum = 0}
local alias = audit
local unsubscribe = world:onChange(function(kind, id, revision)
    alias.count += 1
    alias.checksum = (alias.checksum * 17 + id * 3 + revision + #kind) % 100003
end)
local handles = {}
for i = 1, 9 + mode do
    local velocity = ((i + seed) % 5) - 2
    if i % 4 == 0 then
        velocity = nil
    end
    handles[i] = world:spawn(seed + i * 2, velocity, 3 + (i + mode) % 5)
end
local remembered = handles[2]
local firstView = world:view(handles[1])
local sameView = firstView
sameView.x = sameView.x + 7
assert(firstView.x == seed + 9, "view alias lost")
local readers = {}
for i = 1, 3 do
    local handle = handles[i]
    local reads = 0
    readers[i] = function()
        reads += 1
        local view = world:view(handle)
        return view.x or -999, reads
    end
end

local function makeMovement(multiplier)
    local steps = 0
    return function(tick)
        steps += 1
        world:query(function(handle, position, velocity)
            local old = position.x
            position.x += velocity * multiplier
            position.history = (position.history * 11 + old + position.x) % 1009
            local hp = world.health:get(handle.id) - ((tick + handle.id + mode) % 3)
            world.health:set(handle.id, hp)
            if hp <= 0 then
                world:defer(function()
                    local removed = world:destroy(handle)
                    note("expire", handle.id, removed)
                end)
            elseif (tick + handle.id) % 4 == 0 then
                world:defer(function()
                    if world:valid(handle) then
                        world.velocities:set(handle.id, -velocity)
                    end
                end)
            end
        end)
        return steps
    end
end
local move = makeMovement(1 + mode % 2)
for tick = 1, 7 do
    local stepCount = move(tick)
    local pending = world:flush()
    if tick == 2 then
        note("manual", remembered.id, world:destroy(remembered))
    end
    if tick % 2 == 0 then
        local born = world:spawn(seed - tick, tick % 3 - 1, 4 + mode)
        note("born", born.id, born.generation)
    end
    if tick == 4 then
        unsubscribe()
    end
    world.positions:verify()
    world.velocities:verify()
    world.health:verify()
    local total = 0
    for _, id in ipairs(world.positions.dense) do
        local position = world.positions:get(id)
        total += position.x * id + position.history + world.health:get(id)
    end
    note("tick", tick, tostring(total) .. "," .. tostring(pending) .. "," .. tostring(stepCount))
end
assert(not world:valid(remembered), "stale generation became valid")
for i, reader in ipairs(readers) do
    local value, count = reader()
    local again, nextCount = reader()
    note("reader", i, tostring(value) .. "," .. tostring(again) .. "," .. tostring(count + nextCount))
end
print("entity-store", seed, mode, #world.positions.dense, audit.count, audit.checksum, world.revision)
print(table.concat(trace, "|"))
