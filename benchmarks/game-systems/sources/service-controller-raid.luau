-- Original synthetic service/controller game architecture, inspired by the
-- dependency/lifecycle pattern. This is not Knit nor a Roblox compatibility test.
local rawSeed, rawMode = ...
local seed = tonumber(rawSeed) or 17
local mode = tonumber(rawMode) or 0
local function pack(...) return {n = select("#", ...), ...} end
local function copy(source)
    local result = {}
    for key, value in pairs(source) do result[key] = value end
    return result
end
local trace = {}
local function record(label, ...)
    local values = pack(...)
    local fields = {label}
    for i = 1, values.n do fields[#fields + 1] = tostring(values[i]) end
    trace[#trace + 1] = table.concat(fields, ":")
end
local function digest(lines)
    local value = 23
    for _, line in ipairs(lines) do
        for i = 1, #line do value = (value * 33 + string.byte(line, i)) % 1000000007 end
    end
    return value
end

local Event = {}
Event.__index = Event
function Event.new()
    return setmetatable({slots = {}, sequence = 0, depth = 0, waiting = {}}, Event)
end
function Event:On(callback, once)
    self.sequence += 1
    local slot = {callback = callback, once = once, connected = true, id = self.sequence}
    local target = if self.depth == 0 then self.slots else self.waiting
    target[#target + 1] = slot
    local connection = {}
    function connection:Disconnect()
        local old = slot.connected
        slot.connected = false
        return old
    end
    function connection:Connected() return slot.connected end
    return connection
end
function Event:Fire(...)
    self.depth += 1
    local args = pack(...)
    for i = 1, #self.slots do
        local slot = self.slots[i]
        if slot.connected then
            if slot.once then slot.connected = false end
            slot.callback(table.unpack(args, 1, args.n))
        end
    end
    self.depth -= 1
    if self.depth == 0 then
        local keep = {}
        for _, slot in ipairs(self.slots) do
            if slot.connected then keep[#keep + 1] = slot end
        end
        for _, slot in ipairs(self.waiting) do
            if slot.connected then keep[#keep + 1] = slot end
        end
        self.slots, self.waiting = keep, {}
    end
end

local Scheduler = {}
Scheduler.__index = Scheduler
function Scheduler.new()
    return setmetatable({tick = 0, tasks = {}, callbacks = {}, nextId = 0, completed = 0, cancelled = 0}, Scheduler)
end
function Scheduler:Spawn(callback, ...)
    self.nextId += 1
    local task = {id = self.nextId, callback = callback, thread = coroutine.create(callback),
        arguments = pack(...), wake = self.tick, state = "ready", result = nil}
    self.tasks[#self.tasks + 1] = task
    self.callbacks[callback] = task
    local function cancel(reason)
        if task.state == "done" or task.state == "cancelled" then return false end
        task.state, task.reason = "cancelled", reason
        self.cancelled += 1
        return true
    end
    return task, cancel
end
function Scheduler:Step()
    self.tick += 1
    local limit = #self.tasks
    for i = 1, limit do
        local task = self.tasks[i]
        if task.state ~= "ready" or task.wake > self.tick then continue end
        local args = task.arguments
        local result = pack(coroutine.resume(task.thread, table.unpack(args, 1, args.n)))
        assert(result[1], "task failed: " .. tostring(result[2]))
        if coroutine.status(task.thread) == "dead" then
            task.state = "done"
            task.result = {n = result.n - 1}
            for j = 2, result.n do task.result[j - 1] = result[j] end
            self.completed += 1
        else
            assert(type(result[2]) == "number" and result[2] >= 1, "invalid yielded delay")
            task.wake = self.tick + result[2]
            task.arguments = pack(self.tick, nil, task.id)
        end
    end
end
function Scheduler:Run(ticks)
    for _ = 1, ticks do self:Step() end
end
local function sleep(ticks)
    return coroutine.yield(ticks)
end

local Container = {}
Container.__index = Container
function Container.new()
    return setmetatable({definitions = {}, names = {}, services = {}, order = {}, state = "new"}, Container)
end
function Container:Register(name, dependencies, factory)
    assert(self.state == "new" and not self.definitions[name], "invalid registration")
    self.definitions[name] = {dependencies = dependencies, factory = factory}
    self.names[#self.names + 1] = name
end
function Container:Start(context)
    assert(self.state == "new", "already started")
    local colors = {}
    local visit
    visit = function(name)
        if colors[name] == 2 then return self.services[name] end
        assert(colors[name] ~= 1, "dependency-cycle")
        local definition = assert(self.definitions[name], "missing-service")
        colors[name] = 1
        local dependencies = {}
        for _, dependency in ipairs(definition.dependencies) do dependencies[dependency] = visit(dependency) end
        local service = definition.factory(context, dependencies)
        service.Name = name
        self.services[name] = service
        self.order[#self.order + 1] = service
        colors[name] = 2
        if service.Init then service:Init() end
        return service
    end
    for _, name in ipairs(self.names) do visit(name) end
    self.state = "starting"
    for _, service in ipairs(self.order) do
        if service.Start then service:Start() end
    end
    self.state = "running"
end
function Container:Get(name)
    return assert(self.services[name], "service unavailable")
end
function Container:Stop()
    assert(self.state == "running", "not running")
    for i = #self.order, 1, -1 do
        local service = self.order[i]
        if service.Stop then service:Stop() end
    end
    self.state = "stopped"
end

local function inventoryService(context)
    local self = {balances = {}, changed = Event.new(), generation = 0}
    function self:Init()
        for player = 1, 3 do self.balances[player] = 12 + player end
        record("init", self.Name)
    end
    function self:Begin(player)
        local baseGeneration, balance = self.generation, self.balances[player]
        local open, pending = true, balance
        local transaction = {}
        function transaction:Spend(amount)
            assert(open, "closed-transaction")
            if amount > pending then return false, nil, "insufficient" end
            pending -= amount
            return true, pending, nil
        end
        function transaction:Commit()
            assert(open, "closed-transaction")
            open = false
            if self.owner.generation ~= baseGeneration then return false, "conflict" end
            self.owner.balances[player] = pending
            self.owner.generation += 1
            self.owner.changed:Fire(player, pending, balance)
            return true, nil, pending
        end
        function transaction:Rollback()
            local wasOpen = open
            open = false
            pending = balance
            return wasOpen
        end
        transaction.owner = self
        return transaction
    end
    function self:Award(player, amount)
        local old = self.balances[player]
        self.balances[player] = old + amount
        self.generation += 1
        self.changed:Fire(player, self.balances[player], old)
    end
    function self:Stop() record("stop", self.Name, self.generation) end
    return self
end
local function combatService(context, dependencies)
    local inventory = dependencies.Inventory
    local self = {health = {30, 35, 40}, hit = Event.new(), modifiers = {}, blocked = 0}
    function self:Init() record("init", self.Name) end
    function self:AddModifier(modifier)
        self.modifiers[modifier] = true
        local active = true
        return function()
            if not active then return false end
            active = false
            self.modifiers[modifier] = nil
            return true
        end
    end
    function self:Attack(player, target, baseDamage, orderedModifiers)
        local transaction = inventory:Begin(player)
        local accepted, remaining, reason = transaction:Spend(2 + mode)
        if not accepted then
            assert(remaining == nil and reason == "insufficient")
            transaction:Rollback()
            self.blocked += 1
            return false, nil, reason
        end
        local damage = baseDamage
        for _, modifier in ipairs(orderedModifiers) do
            if self.modifiers[modifier] then damage = modifier(damage, target) end
        end
        damage = math.max(1, math.floor(damage))
        local committed, failure = transaction:Commit()
        assert(committed and failure == nil, "unexpected conflict")
        local previous = self.health[target]
        self.health[target] = math.max(0, previous - damage)
        self.hit:Fire(player, target, damage, nil, self.health[target])
        return true, damage, self.health[target]
    end
    function self:Stop() record("stop", self.Name, self.blocked) end
    return self
end
local function questService(context, dependencies)
    local combat, inventory = dependencies.Combat, dependencies.Inventory
    local self = {progress = {0, 0, 0}, rewards = 0, connection = nil}
    function self:Init() record("init", self.Name) end
    function self:Start()
        self.connection = combat.hit:On(function(player, _, damage, hole, health)
            assert(hole == nil and health >= 0, "hit tuple")
            self.progress[player] += damage
            if self.progress[player] >= 10 then
                self.progress[player] -= 10
                self.rewards += 1
                inventory:Award(player, 3)
            end
        end)
        record("start", self.Name)
    end
    function self:Stop()
        assert(self.connection:Disconnect() and not self.connection:Disconnect())
        record("stop", self.Name, self.rewards)
    end
    return self
end
local function controllerService(context, dependencies)
    local combat = dependencies.Combat
    local self = {jobs = {}, cancellations = {}, damage = 0}
    function self:Init() record("init", self.Name) end
    function self:Start()
        for player = 1, 3 do
            local capturedPlayer = player
            local function run()
                local hits = 0
                for round = 1, 4 do
                    local tick, hole, taskId = sleep((capturedPlayer + round) % 3 + 1)
                    assert(hole == nil and taskId >= 1 and tick >= 1, "resume tuple")
                    local target = (capturedPlayer + round) % 3 + 1
                    local ok, dealt = combat:Attack(capturedPlayer, target,
                        3 + (seed + round) % 4, context.modifiers)
                    if ok then hits += 1; self.damage += dealt end
                end
                return capturedPlayer, nil, hits
            end
            local task, cancel = context.scheduler:Spawn(run)
            assert(context.scheduler.callbacks[run] == task, "callback table key")
            self.jobs[player], self.cancellations[player] = task, cancel
        end
    end
    function self:Stop()
        for _, cancel in ipairs(self.cancellations) do cancel("shutdown") end
        record("stop", self.Name, self.damage)
    end
    return self
end

local scheduler = Scheduler.new()
local container = Container.new()
local context = {scheduler = scheduler, modifiers = {}}
container:Register("Controller", {"Combat", "Quest"}, controllerService)
container:Register("Quest", {"Combat", "Inventory"}, questService)
container:Register("Combat", {"Inventory"}, combatService)
container:Register("Inventory", {}, inventoryService)
container:Start(context)
local combat, inventory = container:Get("Combat"), container:Get("Inventory")
local function addBonus(bonus)
    return function(value, target) return value + bonus + (target % 2) end
end
local firstBonus, secondBonus = addBonus(1), addBonus(2)
context.modifiers = {firstBonus, secondBonus}
local removeFirst = combat:AddModifier(firstBonus)
local removeSecond = combat:AddModifier(secondBonus)
local keys = {[firstBonus] = "first", [secondBonus] = "second"}
assert(firstBonus ~= secondBonus and keys[firstBonus] == "first", "modifier captures")
local observed, once = 0, 0
local observer = combat.hit:On(function(...) observed += select("#", ...) end)
combat.hit:On(function() once += 1 end, true)
scheduler:Run(5)
assert(removeFirst() and not removeFirst(), "modifier removal")
if mode % 2 == 1 then
    local cancel = container:Get("Controller").cancellations[3]
    assert(cancel("player-left") and not cancel("again"), "task cancellation")
end
scheduler:Run(20)
assert(removeSecond(), "second removal")
assert(observer:Disconnect() and once == 1 and observed % 5 == 0, "hit subscriptions")
local t1, t2 = inventory:Begin(1), inventory:Begin(1)
assert(t1:Spend(1))
assert(t1:Commit())
local ok, conflict = t2:Commit()
assert(not ok and conflict == "conflict", "optimistic transaction conflict")
local cycle = Container.new()
cycle:Register("A", {"B"}, function() return {} end)
cycle:Register("B", {"A"}, function() return {} end)
local cycleOk, cycleError = pcall(function() cycle:Start({}) end)
assert(not cycleOk and string.find(tostring(cycleError), "dependency%-cycle"), "cycle rejection")
local controller = container:Get("Controller")
for player, task in ipairs(controller.jobs) do
    if task.state == "done" then
        assert(task.result.n == 3 and task.result[1] == player and task.result[2] == nil, "result tuple")
        record("job", player, task.state, task.result[3])
    else
        assert(task.state == "cancelled", "unfinished task")
        record("job", player, task.state, task.reason)
    end
end
container:Stop()
assert(container.state == "stopped")
print("raid", seed, mode, scheduler.completed, scheduler.cancelled, observed, once, digest(trace))
print("players", inventory.balances[1], inventory.balances[2], inventory.balances[3])
print("health", combat.health[1], combat.health[2], combat.health[3], controller.damage)
print("keys", keys[firstBonus], keys[secondBonus], firstBonus == secondBonus)
for _, line in ipairs(trace) do print("event", line) end
local function sharedMarker() return "service-marker" end
local function makeCounter()
    local count = 0
    return function(delta) count += delta; return count end
end
return sharedMarker, makeCounter(), digest(trace)
