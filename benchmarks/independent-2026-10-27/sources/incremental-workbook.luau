-- Original system: dynamic dependency capture, invalidation, and batched edits.
local seedArg, modeArg = ...
local seed = tonumber(seedArg) or 0
local mode = tonumber(modeArg) or 0
local trace = {}
local function emit(kind, name, value)
    trace[#trace + 1] = kind .. ":" .. name .. ":" .. tostring(value)
end

local Workbook = {}
Workbook.__index = Workbook
function Workbook.new()
    return setmetatable({
        cells = {}, active = {}, frames = {}, counters = {},
        revision = 0, changes = {}, watchers = {}, notifications = 0,
    }, Workbook)
end
function Workbook:input(name, value)
    assert(self.cells[name] == nil, "duplicate cell")
    self.cells[name] = {value = value, dirty = false, dependencies = {}, users = {}, version = 0}
end
function Workbook:formula(name, compute)
    assert(self.cells[name] == nil, "duplicate formula")
    self.cells[name] = {compute = compute, dirty = true, dependencies = {}, users = {}, version = 0}
end
function Workbook:invalidate(name, seen)
    if seen[name] then
        return
    end
    seen[name] = true
    local cell = self.cells[name]
    cell.dirty = cell.compute ~= nil
    local names = {}
    for user in pairs(cell.users) do
        names[#names + 1] = user
    end
    table.sort(names)
    for _, user in ipairs(names) do
        self:invalidate(user, seen)
    end
end
function Workbook:set(name, value)
    local cell = self.cells[name]
    assert(cell ~= nil and cell.compute == nil, "input required")
    if cell.value == value then
        return false
    end
    cell.value = value
    cell.version += 1
    self.revision += 1
    self.changes[name] = true
    self:invalidate(name, {})
    return true
end
function Workbook:read(name)
    local cell = self.cells[name]
    assert(cell ~= nil, "unknown cell")
    local parent = self.frames[#self.frames]
    if parent ~= nil then
        parent.observed[name] = true
    end
    if not cell.dirty then
        return cell.value
    end
    assert(not self.active[name], "dependency cycle")
    self.active[name] = true
    local frame = {name = name, observed = {}}
    self.frames[#self.frames + 1] = frame
    local value = cell.compute(self)
    self.frames[#self.frames] = nil
    self.active[name] = nil
    for dependency in pairs(cell.dependencies) do
        self.cells[dependency].users[name] = nil
    end
    cell.dependencies = frame.observed
    for dependency in pairs(frame.observed) do
        self.cells[dependency].users[name] = true
    end
    cell.value = value
    cell.dirty = false
    cell.version += 1
    self.counters[name] = (self.counters[name] or 0) + 1
    emit("compute", name, value)
    return value
end
function Workbook:proxy()
    local workbook = self
    return setmetatable({}, {
        __index = function(_, name)
            return workbook:read(name)
        end,
        __newindex = function(_, name, value)
            workbook:set(name, value)
        end,
    })
end
function Workbook:watch(name, callback)
    local enabled = true
    local record = {name = name, last = self:read(name)}
    record.notify = function()
        if enabled then
            local nextValue = self:read(name)
            if nextValue ~= record.last then
                local oldValue = record.last
                record.last = nextValue
                self.notifications += 1
                callback(nextValue, oldValue, self.revision)
            end
        end
    end
    self.watchers[#self.watchers + 1] = record
    return function()
        enabled = false
    end
end
function Workbook:flush()
    local names = {}
    for name in pairs(self.changes) do
        names[#names + 1] = name
    end
    table.sort(names)
    self.changes = {}
    for _, watcher in ipairs(self.watchers) do
        watcher.notify()
    end
    return table.concat(names, ",")
end
function Workbook:batch(edits, accept)
    -- Validate all names first, then either commit the coalesced batch or discard it.
    local staged = {}
    local order = {}
    for _, edit in ipairs(edits) do
        local cell = self.cells[edit[1]]
        if cell == nil or cell.compute ~= nil then
            return false, "invalid"
        end
        if staged[edit[1]] == nil then
            order[#order + 1] = edit[1]
        end
        staged[edit[1]] = edit[2]
    end
    if not accept(staged) then
        return false, "rejected"
    end
    for _, name in ipairs(order) do
        self:set(name, staged[name])
    end
    return true, self:flush()
end
function Workbook:describe(name)
    local cell = self.cells[name]
    local dependencies = {}
    for dependency in pairs(cell.dependencies) do
        dependencies[#dependencies + 1] = dependency
    end
    table.sort(dependencies)
    return name .. "=" .. tostring(self:read(name)) .. "[" .. table.concat(dependencies, ",") .. "]"
end

local book = Workbook.new()
book:input("quantity", 3 + seed % 5)
book:input("price", 10 + mode)
book:input("discount", 2 + seed % 3)
book:input("shipping", 4 + mode)
book:input("tax", 7)
book:input("switch", mode % 2)
book:formula("subtotal", function(w)
    return w:read("quantity") * w:read("price")
end)
book:formula("adjusted", function(w)
    local amount = w:read("subtotal")
    if w:read("switch") == 0 then
        amount -= w:read("discount")
    else
        amount += w:read("shipping")
    end
    return amount
end)
book:formula("total", function(w)
    local amount = w:read("adjusted")
    return amount + math.floor(amount * w:read("tax") / 100)
end)
local coefficients = {2, -3, 5}
for index, coefficient in ipairs(coefficients) do
    local name = "projection" .. tostring(index)
    local offset = index + seed
    book:formula(name, function(w)
        return w:read("total") * coefficient + offset
    end)
end
book:formula("score", function(w)
    local sum = 0
    for index = 1, #coefficients do
        sum += w:read("projection" .. tostring(index))
    end
    return sum
end)
local observed = {delta = 0, calls = 0}
local alias = observed
local stop = book:watch("total", function(value, old, revision)
    alias.delta += value - old
    alias.calls += 1
    emit("watch", tostring(revision), tostring(old) .. ">" .. tostring(value))
end)
book:watch("score", function(value, old)
    emit("score", tostring(old), value)
end)
local proxy = book:proxy()
local proxyAlias = proxy
local checkpoints = {}
for round = 1, 8 do
    local before = book:read("score")
    proxyAlias.switch = (round + mode) % 2
    local ok, detail = book:batch({
        {"quantity", 1 + (seed + round) % 7},
        {"price", 8 + round},
        {"quantity", 2 + (seed + round + mode) % 6},
        {"discount", round + mode},
    }, function(staged)
        return (staged.quantity + round + mode) % 4 ~= 0
    end)
    local after = book:read("score")
    emit("batch", tostring(round), tostring(ok) .. "," .. detail .. "," .. tostring(after - before))
    local captured = after
    local reads = 0
    checkpoints[round] = function()
        reads += 1
        return captured, reads, proxy.total
    end
    if round == 5 then
        stop()
    end
    book:flush()
    -- The inactive branch must not invalidate adjusted or its users.
    local evaluations = book.counters.adjusted
    if proxy.switch == 0 then
        proxy.shipping += 1
    else
        proxy.discount += 1
    end
    book:read("score")
    assert(book.counters.adjusted == evaluations, "inactive dependency retained")
    emit("branch", tostring(round), book:describe("adjusted"))
end
local invalid, reason = book:batch({{"total", 99}}, function()
    return true
end)
assert(not invalid and reason == "invalid", "formula overwritten")
for index, checkpoint in ipairs(checkpoints) do
    local value, calls, current = checkpoint()
    local second, moreCalls = checkpoint()
    assert(second == value and moreCalls == calls + 1, "checkpoint capture drift")
    emit("checkpoint", tostring(index), tostring(value) .. "," .. tostring(current))
end
local counts = {}
for _, name in ipairs({"subtotal", "adjusted", "total", "projection1", "projection2", "projection3", "score"}) do
    counts[#counts + 1] = name .. "=" .. tostring(book.counters[name])
end
print("incremental-workbook", seed, mode, proxy.score, observed.calls, observed.delta, book.notifications)
print(table.concat(counts, ","))
print(table.concat(trace, "|"))
