-- Original generated protocol-router: eight channels, six independent command families.
-- Every specialized handler is dispatched; shared templates model a protocol registry.
local seed, mode = ...
seed = tonumber(seed) or 0
mode = tonumber(mode) or 0
local trace = {}
local function emit(...)
    local parts = {}
    for i = 1, select("#", ...) do
        parts[i] = tostring(select(i, ...))
    end
    trace[#trace + 1] = table.concat(parts, ":")
end
local function checksum(text)
    local sum = 0
    for i = 1, #text do
        sum = (sum * 17 + string.byte(text, i)) % 65521
    end
    return sum
end
local function encode(parts)
    local output = {}
    for _, text in ipairs(parts) do
        output[#output + 1] = tostring(#text) .. ":" .. text
    end
    return table.concat(output)
end
local function decode(text)
    local values = {}
    local cursor = 1
    while cursor <= #text do
        local colon = string.find(text, ":", cursor, true)
        if not colon then error("missing-length", 0) end
        local size = tonumber(string.sub(text, cursor, colon - 1))
        if not size or size < 0 then error("invalid-length", 0) end
        local finish = colon + size
        if finish > #text then error("short-frame", 0) end
        values[#values + 1] = string.sub(text, colon + 1, finish)
        cursor = finish + 1
    end
    return values
end
local function treeSum(node, level)
    if level > 12 then error("tree-depth", 0) end
    if type(node) ~= "table" then return node or 0 end
    local result = 0
    for _, value in ipairs(node) do
        result += treeSum(value, level + 1)
    end
    return result
end
local function iterator(values)
    local at = 0
    return function()
        at += 1
        if at <= #values then return at, values[at] end
        return nil
    end
end
local Router = {}
Router.__index = Router
function Router.new()
    local self = setmetatable({channels = {}, handlers = {}, calls = 0, commits = 0, rollbacks = 0}, Router)
    for channel = 1, 8 do
        self.channels[channel] = {balance = channel * 11 + seed, revision = 0, values = {}, flags = {}, seen = {}}
    end
    return self
end
function Router:register(name, callback)
    assert(self.handlers[name] == nil, "duplicate-handler")
    local used = 0
    self.handlers[name] = function(packet)
        used += 1
        self.calls += 1
        local value, detail = callback(self, packet, used)
        return value, detail, used
    end
end
function Router:dispatch(frame)
    local fields = decode(frame)
    if #fields ~= 4 then error("field-count", 0) end
    local callback = self.handlers[fields[1]]
    if not callback then error("unknown-command", 0) end
    local packet = {amount = tonumber(fields[2]), tag = fields[3], round = tonumber(fields[4])}
    if not packet.amount or not packet.round then error("invalid-number", 0) end
    return callback(packet)
end
local router = Router.new()

router:register("credit-1", function(self, packet, used)
    local state = self.channels[1]
    local identity = "credit:" .. packet.tag
    local prior = state.seen[identity]
    if prior then
        emit("duplicate", "credit", 1, prior)
        return state.balance, "duplicate"
    end
    state.seen[identity] = packet.round
    state.revision += 1
    local integrity = checksum(identity)
    state.flags.integrity = integrity
    emit("begin", "credit", 1, used, state.revision)
    local scale = (packet.round + 1) % 4 + 1
    local before = state.balance
    local delta = packet.amount * scale
    if delta < 0 and before + delta < -40 then
        delta = -before
        state.flags.creditLimit = true
    elseif delta == 0 then
        delta = used
        state.flags.zeroCredit = true
    end
    state.balance = before + delta
    state.values[#state.values + 1] = delta
    local nested = {{before, delta}, {state.balance, used}}
    local total = treeSum(nested, 0)
    emit("credit", 1, before, delta, total)
    return state.balance, total
end)

router:register("credit-2", function(self, packet, used)
    local state = self.channels[2]
    local identity = "credit:" .. packet.tag
    local prior = state.seen[identity]
    if prior then
        emit("duplicate", "credit", 2, prior)
        return state.balance, "duplicate"
    end
    state.seen[identity] = packet.round
    state.revision += 1
    local integrity = checksum(identity)
    state.flags.integrity = integrity
    emit("begin", "credit", 2, used, state.revision)
    local scale = (packet.round + 2) % 4 + 1
    local before = state.balance
    local delta = packet.amount * scale
    if delta < 0 and before + delta < -40 then
        delta = -before
        state.flags.creditLimit = true
    elseif delta == 0 then
        delta = used
        state.flags.zeroCredit = true
    end
    state.balance = before + delta
    state.values[#state.values + 1] = delta
    local nested = {{before, delta}, {state.balance, used}}
    local total = treeSum(nested, 0)
    emit("credit", 2, before, delta, total)
    return state.balance, total
end)

router:register("credit-3", function(self, packet, used)
    local state = self.channels[3]
    local identity = "credit:" .. packet.tag
    local prior = state.seen[identity]
    if prior then
        emit("duplicate", "credit", 3, prior)
        return state.balance, "duplicate"
    end
    state.seen[identity] = packet.round
    state.revision += 1
    local integrity = checksum(identity)
    state.flags.integrity = integrity
    emit("begin", "credit", 3, used, state.revision)
    local scale = (packet.round + 3) % 4 + 1
    local before = state.balance
    local delta = packet.amount * scale
    if delta < 0 and before + delta < -40 then
        delta = -before
        state.flags.creditLimit = true
    elseif delta == 0 then
        delta = used
        state.flags.zeroCredit = true
    end
    state.balance = before + delta
    state.values[#state.values + 1] = delta
    local nested = {{before, delta}, {state.balance, used}}
    local total = treeSum(nested, 0)
    emit("credit", 3, before, delta, total)
    return state.balance, total
end)

router:register("credit-4", function(self, packet, used)
    local state = self.channels[4]
    local identity = "credit:" .. packet.tag
    local prior = state.seen[identity]
    if prior then
        emit("duplicate", "credit", 4, prior)
        return state.balance, "duplicate"
    end
    state.seen[identity] = packet.round
    state.revision += 1
    local integrity = checksum(identity)
    state.flags.integrity = integrity
    emit("begin", "credit", 4, used, state.revision)
    local scale = (packet.round + 4) % 4 + 1
    local before = state.balance
    local delta = packet.amount * scale
    if delta < 0 and before + delta < -40 then
        delta = -before
        state.flags.creditLimit = true
    elseif delta == 0 then
        delta = used
        state.flags.zeroCredit = true
    end
    state.balance = before + delta
    state.values[#state.values + 1] = delta
    local nested = {{before, delta}, {state.balance, used}}
    local total = treeSum(nested, 0)
    emit("credit", 4, before, delta, total)
    return state.balance, total
end)

router:register("credit-5", function(self, packet, used)
    local state = self.channels[5]
    local identity = "credit:" .. packet.tag
    local prior = state.seen[identity]
    if prior then
        emit("duplicate", "credit", 5, prior)
        return state.balance, "duplicate"
    end
    state.seen[identity] = packet.round
    state.revision += 1
    local integrity = checksum(identity)
    state.flags.integrity = integrity
    emit("begin", "credit", 5, used, state.revision)
    local scale = (packet.round + 5) % 4 + 1
    local before = state.balance
    local delta = packet.amount * scale
    if delta < 0 and before + delta < -40 then
        delta = -before
        state.flags.creditLimit = true
    elseif delta == 0 then
        delta = used
        state.flags.zeroCredit = true
    end
    state.balance = before + delta
    state.values[#state.values + 1] = delta
    local nested = {{before, delta}, {state.balance, used}}
    local total = treeSum(nested, 0)
    emit("credit", 5, before, delta, total)
    return state.balance, total
end)

router:register("credit-6", function(self, packet, used)
    local state = self.channels[6]
    local identity = "credit:" .. packet.tag
    local prior = state.seen[identity]
    if prior then
        emit("duplicate", "credit", 6, prior)
        return state.balance, "duplicate"
    end
    state.seen[identity] = packet.round
    state.revision += 1
    local integrity = checksum(identity)
    state.flags.integrity = integrity
    emit("begin", "credit", 6, used, state.revision)
    local scale = (packet.round + 6) % 4 + 1
    local before = state.balance
    local delta = packet.amount * scale
    if delta < 0 and before + delta < -40 then
        delta = -before
        state.flags.creditLimit = true
    elseif delta == 0 then
        delta = used
        state.flags.zeroCredit = true
    end
    state.balance = before + delta
    state.values[#state.values + 1] = delta
    local nested = {{before, delta}, {state.balance, used}}
    local total = treeSum(nested, 0)
    emit("credit", 6, before, delta, total)
    return state.balance, total
end)

router:register("credit-7", function(self, packet, used)
    local state = self.channels[7]
    local identity = "credit:" .. packet.tag
    local prior = state.seen[identity]
    if prior then
        emit("duplicate", "credit", 7, prior)
        return state.balance, "duplicate"
    end
    state.seen[identity] = packet.round
    state.revision += 1
    local integrity = checksum(identity)
    state.flags.integrity = integrity
    emit("begin", "credit", 7, used, state.revision)
    local scale = (packet.round + 7) % 4 + 1
    local before = state.balance
    local delta = packet.amount * scale
    if delta < 0 and before + delta < -40 then
        delta = -before
        state.flags.creditLimit = true
    elseif delta == 0 then
        delta = used
        state.flags.zeroCredit = true
    end
    state.balance = before + delta
    state.values[#state.values + 1] = delta
    local nested = {{before, delta}, {state.balance, used}}
    local total = treeSum(nested, 0)
    emit("credit", 7, before, delta, total)
    return state.balance, total
end)

router:register("credit-8", function(self, packet, used)
    local state = self.channels[8]
    local identity = "credit:" .. packet.tag
    local prior = state.seen[identity]
    if prior then
        emit("duplicate", "credit", 8, prior)
        return state.balance, "duplicate"
    end
    state.seen[identity] = packet.round
    state.revision += 1
    local integrity = checksum(identity)
    state.flags.integrity = integrity
    emit("begin", "credit", 8, used, state.revision)
    local scale = (packet.round + 8) % 4 + 1
    local before = state.balance
    local delta = packet.amount * scale
    if delta < 0 and before + delta < -40 then
        delta = -before
        state.flags.creditLimit = true
    elseif delta == 0 then
        delta = used
        state.flags.zeroCredit = true
    end
    state.balance = before + delta
    state.values[#state.values + 1] = delta
    local nested = {{before, delta}, {state.balance, used}}
    local total = treeSum(nested, 0)
    emit("credit", 8, before, delta, total)
    return state.balance, total
end)

router:register("debit-1", function(self, packet, used)
    local state = self.channels[1]
    local identity = "debit:" .. packet.tag
    local prior = state.seen[identity]
    if prior then
        emit("duplicate", "debit", 1, prior)
        return state.balance, "duplicate"
    end
    state.seen[identity] = packet.round
    state.revision += 1
    local integrity = checksum(identity)
    state.flags.integrity = integrity
    emit("begin", "debit", 1, used, state.revision)
    local demand = math.abs(packet.amount) + packet.round
    local before = state.balance
    local remaining = demand
    local accepted = 0
    while remaining > 0 do
        local step = math.min(remaining, 1 + 1)
        if state.balance - step < -20 then break end
        state.balance -= step
        accepted += step
        remaining -= step
    end
    state.values[#state.values + 1] = -accepted
    state.flags.deferred = remaining > 0
    local detail = remaining == 0 and "settled" or "partial"
    emit("debit", 1, before, accepted, remaining)
    return state.balance, detail
end)

router:register("debit-2", function(self, packet, used)
    local state = self.channels[2]
    local identity = "debit:" .. packet.tag
    local prior = state.seen[identity]
    if prior then
        emit("duplicate", "debit", 2, prior)
        return state.balance, "duplicate"
    end
    state.seen[identity] = packet.round
    state.revision += 1
    local integrity = checksum(identity)
    state.flags.integrity = integrity
    emit("begin", "debit", 2, used, state.revision)
    local demand = math.abs(packet.amount) + packet.round
    local before = state.balance
    local remaining = demand
    local accepted = 0
    while remaining > 0 do
        local step = math.min(remaining, 2 + 1)
        if state.balance - step < -20 then break end
        state.balance -= step
        accepted += step
        remaining -= step
    end
    state.values[#state.values + 1] = -accepted
    state.flags.deferred = remaining > 0
    local detail = remaining == 0 and "settled" or "partial"
    emit("debit", 2, before, accepted, remaining)
    return state.balance, detail
end)

router:register("debit-3", function(self, packet, used)
    local state = self.channels[3]
    local identity = "debit:" .. packet.tag
    local prior = state.seen[identity]
    if prior then
        emit("duplicate", "debit", 3, prior)
        return state.balance, "duplicate"
    end
    state.seen[identity] = packet.round
    state.revision += 1
    local integrity = checksum(identity)
    state.flags.integrity = integrity
    emit("begin", "debit", 3, used, state.revision)
    local demand = math.abs(packet.amount) + packet.round
    local before = state.balance
    local remaining = demand
    local accepted = 0
    while remaining > 0 do
        local step = math.min(remaining, 3 + 1)
        if state.balance - step < -20 then break end
        state.balance -= step
        accepted += step
        remaining -= step
    end
    state.values[#state.values + 1] = -accepted
    state.flags.deferred = remaining > 0
    local detail = remaining == 0 and "settled" or "partial"
    emit("debit", 3, before, accepted, remaining)
    return state.balance, detail
end)

router:register("debit-4", function(self, packet, used)
    local state = self.channels[4]
    local identity = "debit:" .. packet.tag
    local prior = state.seen[identity]
    if prior then
        emit("duplicate", "debit", 4, prior)
        return state.balance, "duplicate"
    end
    state.seen[identity] = packet.round
    state.revision += 1
    local integrity = checksum(identity)
    state.flags.integrity = integrity
    emit("begin", "debit", 4, used, state.revision)
    local demand = math.abs(packet.amount) + packet.round
    local before = state.balance
    local remaining = demand
    local accepted = 0
    while remaining > 0 do
        local step = math.min(remaining, 4 + 1)
        if state.balance - step < -20 then break end
        state.balance -= step
        accepted += step
        remaining -= step
    end
    state.values[#state.values + 1] = -accepted
    state.flags.deferred = remaining > 0
    local detail = remaining == 0 and "settled" or "partial"
    emit("debit", 4, before, accepted, remaining)
    return state.balance, detail
end)

router:register("debit-5", function(self, packet, used)
    local state = self.channels[5]
    local identity = "debit:" .. packet.tag
    local prior = state.seen[identity]
    if prior then
        emit("duplicate", "debit", 5, prior)
        return state.balance, "duplicate"
    end
    state.seen[identity] = packet.round
    state.revision += 1
    local integrity = checksum(identity)
    state.flags.integrity = integrity
    emit("begin", "debit", 5, used, state.revision)
    local demand = math.abs(packet.amount) + packet.round
    local before = state.balance
    local remaining = demand
    local accepted = 0
    while remaining > 0 do
        local step = math.min(remaining, 5 + 1)
        if state.balance - step < -20 then break end
        state.balance -= step
        accepted += step
        remaining -= step
    end
    state.values[#state.values + 1] = -accepted
    state.flags.deferred = remaining > 0
    local detail = remaining == 0 and "settled" or "partial"
    emit("debit", 5, before, accepted, remaining)
    return state.balance, detail
end)

router:register("debit-6", function(self, packet, used)
    local state = self.channels[6]
    local identity = "debit:" .. packet.tag
    local prior = state.seen[identity]
    if prior then
        emit("duplicate", "debit", 6, prior)
        return state.balance, "duplicate"
    end
    state.seen[identity] = packet.round
    state.revision += 1
    local integrity = checksum(identity)
    state.flags.integrity = integrity
    emit("begin", "debit", 6, used, state.revision)
    local demand = math.abs(packet.amount) + packet.round
    local before = state.balance
    local remaining = demand
    local accepted = 0
    while remaining > 0 do
        local step = math.min(remaining, 6 + 1)
        if state.balance - step < -20 then break end
        state.balance -= step
        accepted += step
        remaining -= step
    end
    state.values[#state.values + 1] = -accepted
    state.flags.deferred = remaining > 0
    local detail = remaining == 0 and "settled" or "partial"
    emit("debit", 6, before, accepted, remaining)
    return state.balance, detail
end)

router:register("debit-7", function(self, packet, used)
    local state = self.channels[7]
    local identity = "debit:" .. packet.tag
    local prior = state.seen[identity]
    if prior then
        emit("duplicate", "debit", 7, prior)
        return state.balance, "duplicate"
    end
    state.seen[identity] = packet.round
    state.revision += 1
    local integrity = checksum(identity)
    state.flags.integrity = integrity
    emit("begin", "debit", 7, used, state.revision)
    local demand = math.abs(packet.amount) + packet.round
    local before = state.balance
    local remaining = demand
    local accepted = 0
    while remaining > 0 do
        local step = math.min(remaining, 7 + 1)
        if state.balance - step < -20 then break end
        state.balance -= step
        accepted += step
        remaining -= step
    end
    state.values[#state.values + 1] = -accepted
    state.flags.deferred = remaining > 0
    local detail = remaining == 0 and "settled" or "partial"
    emit("debit", 7, before, accepted, remaining)
    return state.balance, detail
end)

router:register("debit-8", function(self, packet, used)
    local state = self.channels[8]
    local identity = "debit:" .. packet.tag
    local prior = state.seen[identity]
    if prior then
        emit("duplicate", "debit", 8, prior)
        return state.balance, "duplicate"
    end
    state.seen[identity] = packet.round
    state.revision += 1
    local integrity = checksum(identity)
    state.flags.integrity = integrity
    emit("begin", "debit", 8, used, state.revision)
    local demand = math.abs(packet.amount) + packet.round
    local before = state.balance
    local remaining = demand
    local accepted = 0
    while remaining > 0 do
        local step = math.min(remaining, 8 + 1)
        if state.balance - step < -20 then break end
        state.balance -= step
        accepted += step
        remaining -= step
    end
    state.values[#state.values + 1] = -accepted
    state.flags.deferred = remaining > 0
    local detail = remaining == 0 and "settled" or "partial"
    emit("debit", 8, before, accepted, remaining)
    return state.balance, detail
end)

router:register("route-1", function(self, packet, used)
    local state = self.channels[1]
    local identity = "route:" .. packet.tag
    local prior = state.seen[identity]
    if prior then
        emit("duplicate", "route", 1, prior)
        return state.balance, "duplicate"
    end
    state.seen[identity] = packet.round
    state.revision += 1
    local integrity = checksum(identity)
    state.flags.integrity = integrity
    emit("begin", "route", 1, used, state.revision)
    local targetId = (1 + packet.round) % 8 + 1
    local target = self.channels[targetId]
    local amount = math.abs(packet.amount) % 11
    local a, b = state.balance, target.balance
    if target == state then
        state.flags.loopback = true
        amount = 0
    elseif state.balance < amount then
        amount = math.max(0, state.balance)
    end
    state.balance -= amount
    target.balance += amount
    state.values[#state.values + 1] = -amount
    target.values[#target.values + 1] = amount
    emit("route", 1, targetId, a, b, amount)
    return target.balance, state.balance
end)

router:register("route-2", function(self, packet, used)
    local state = self.channels[2]
    local identity = "route:" .. packet.tag
    local prior = state.seen[identity]
    if prior then
        emit("duplicate", "route", 2, prior)
        return state.balance, "duplicate"
    end
    state.seen[identity] = packet.round
    state.revision += 1
    local integrity = checksum(identity)
    state.flags.integrity = integrity
    emit("begin", "route", 2, used, state.revision)
    local targetId = (2 + packet.round) % 8 + 1
    local target = self.channels[targetId]
    local amount = math.abs(packet.amount) % 11
    local a, b = state.balance, target.balance
    if target == state then
        state.flags.loopback = true
        amount = 0
    elseif state.balance < amount then
        amount = math.max(0, state.balance)
    end
    state.balance -= amount
    target.balance += amount
    state.values[#state.values + 1] = -amount
    target.values[#target.values + 1] = amount
    emit("route", 2, targetId, a, b, amount)
    return target.balance, state.balance
end)

router:register("route-3", function(self, packet, used)
    local state = self.channels[3]
    local identity = "route:" .. packet.tag
    local prior = state.seen[identity]
    if prior then
        emit("duplicate", "route", 3, prior)
        return state.balance, "duplicate"
    end
    state.seen[identity] = packet.round
    state.revision += 1
    local integrity = checksum(identity)
    state.flags.integrity = integrity
    emit("begin", "route", 3, used, state.revision)
    local targetId = (3 + packet.round) % 8 + 1
    local target = self.channels[targetId]
    local amount = math.abs(packet.amount) % 11
    local a, b = state.balance, target.balance
    if target == state then
        state.flags.loopback = true
        amount = 0
    elseif state.balance < amount then
        amount = math.max(0, state.balance)
    end
    state.balance -= amount
    target.balance += amount
    state.values[#state.values + 1] = -amount
    target.values[#target.values + 1] = amount
    emit("route", 3, targetId, a, b, amount)
    return target.balance, state.balance
end)

router:register("route-4", function(self, packet, used)
    local state = self.channels[4]
    local identity = "route:" .. packet.tag
    local prior = state.seen[identity]
    if prior then
        emit("duplicate", "route", 4, prior)
        return state.balance, "duplicate"
    end
    state.seen[identity] = packet.round
    state.revision += 1
    local integrity = checksum(identity)
    state.flags.integrity = integrity
    emit("begin", "route", 4, used, state.revision)
    local targetId = (4 + packet.round) % 8 + 1
    local target = self.channels[targetId]
    local amount = math.abs(packet.amount) % 11
    local a, b = state.balance, target.balance
    if target == state then
        state.flags.loopback = true
        amount = 0
    elseif state.balance < amount then
        amount = math.max(0, state.balance)
    end
    state.balance -= amount
    target.balance += amount
    state.values[#state.values + 1] = -amount
    target.values[#target.values + 1] = amount
    emit("route", 4, targetId, a, b, amount)
    return target.balance, state.balance
end)

router:register("route-5", function(self, packet, used)
    local state = self.channels[5]
    local identity = "route:" .. packet.tag
    local prior = state.seen[identity]
    if prior then
        emit("duplicate", "route", 5, prior)
        return state.balance, "duplicate"
    end
    state.seen[identity] = packet.round
    state.revision += 1
    local integrity = checksum(identity)
    state.flags.integrity = integrity
    emit("begin", "route", 5, used, state.revision)
    local targetId = (5 + packet.round) % 8 + 1
    local target = self.channels[targetId]
    local amount = math.abs(packet.amount) % 11
    local a, b = state.balance, target.balance
    if target == state then
        state.flags.loopback = true
        amount = 0
    elseif state.balance < amount then
        amount = math.max(0, state.balance)
    end
    state.balance -= amount
    target.balance += amount
    state.values[#state.values + 1] = -amount
    target.values[#target.values + 1] = amount
    emit("route", 5, targetId, a, b, amount)
    return target.balance, state.balance
end)

router:register("route-6", function(self, packet, used)
    local state = self.channels[6]
    local identity = "route:" .. packet.tag
    local prior = state.seen[identity]
    if prior then
        emit("duplicate", "route", 6, prior)
        return state.balance, "duplicate"
    end
    state.seen[identity] = packet.round
    state.revision += 1
    local integrity = checksum(identity)
    state.flags.integrity = integrity
    emit("begin", "route", 6, used, state.revision)
    local targetId = (6 + packet.round) % 8 + 1
    local target = self.channels[targetId]
    local amount = math.abs(packet.amount) % 11
    local a, b = state.balance, target.balance
    if target == state then
        state.flags.loopback = true
        amount = 0
    elseif state.balance < amount then
        amount = math.max(0, state.balance)
    end
    state.balance -= amount
    target.balance += amount
    state.values[#state.values + 1] = -amount
    target.values[#target.values + 1] = amount
    emit("route", 6, targetId, a, b, amount)
    return target.balance, state.balance
end)

router:register("route-7", function(self, packet, used)
    local state = self.channels[7]
    local identity = "route:" .. packet.tag
    local prior = state.seen[identity]
    if prior then
        emit("duplicate", "route", 7, prior)
        return state.balance, "duplicate"
    end
    state.seen[identity] = packet.round
    state.revision += 1
    local integrity = checksum(identity)
    state.flags.integrity = integrity
    emit("begin", "route", 7, used, state.revision)
    local targetId = (7 + packet.round) % 8 + 1
    local target = self.channels[targetId]
    local amount = math.abs(packet.amount) % 11
    local a, b = state.balance, target.balance
    if target == state then
        state.flags.loopback = true
        amount = 0
    elseif state.balance < amount then
        amount = math.max(0, state.balance)
    end
    state.balance -= amount
    target.balance += amount
    state.values[#state.values + 1] = -amount
    target.values[#target.values + 1] = amount
    emit("route", 7, targetId, a, b, amount)
    return target.balance, state.balance
end)

router:register("route-8", function(self, packet, used)
    local state = self.channels[8]
    local identity = "route:" .. packet.tag
    local prior = state.seen[identity]
    if prior then
        emit("duplicate", "route", 8, prior)
        return state.balance, "duplicate"
    end
    state.seen[identity] = packet.round
    state.revision += 1
    local integrity = checksum(identity)
    state.flags.integrity = integrity
    emit("begin", "route", 8, used, state.revision)
    local targetId = (8 + packet.round) % 8 + 1
    local target = self.channels[targetId]
    local amount = math.abs(packet.amount) % 11
    local a, b = state.balance, target.balance
    if target == state then
        state.flags.loopback = true
        amount = 0
    elseif state.balance < amount then
        amount = math.max(0, state.balance)
    end
    state.balance -= amount
    target.balance += amount
    state.values[#state.values + 1] = -amount
    target.values[#target.values + 1] = amount
    emit("route", 8, targetId, a, b, amount)
    return target.balance, state.balance
end)

router:register("scan-1", function(self, packet, used)
    local state = self.channels[1]
    local identity = "scan:" .. packet.tag
    local prior = state.seen[identity]
    if prior then
        emit("duplicate", "scan", 1, prior)
        return state.balance, "duplicate"
    end
    state.seen[identity] = packet.round
    state.revision += 1
    local integrity = checksum(identity)
    state.flags.integrity = integrity
    emit("begin", "scan", 1, used, state.revision)
    local sum, count = 0, 0
    local selected = {}
    for index, value in iterator(state.values) do
        if (index + packet.round) % 3 == 0 then
            selected[#selected + 1] = {index, value}
        else
            sum += value
        end
        count += 1
    end
    local nested = treeSum(selected, 0)
    local detail = sum + nested + packet.amount
    state.flags.lastScan = count
    state.values[#state.values + 1] = detail % 7
    emit("scan", 1, sum, count, nested)
    return detail, count
end)

router:register("scan-2", function(self, packet, used)
    local state = self.channels[2]
    local identity = "scan:" .. packet.tag
    local prior = state.seen[identity]
    if prior then
        emit("duplicate", "scan", 2, prior)
        return state.balance, "duplicate"
    end
    state.seen[identity] = packet.round
    state.revision += 1
    local integrity = checksum(identity)
    state.flags.integrity = integrity
    emit("begin", "scan", 2, used, state.revision)
    local sum, count = 0, 0
    local selected = {}
    for index, value in iterator(state.values) do
        if (index + packet.round) % 3 == 0 then
            selected[#selected + 1] = {index, value}
        else
            sum += value
        end
        count += 1
    end
    local nested = treeSum(selected, 0)
    local detail = sum + nested + packet.amount
    state.flags.lastScan = count
    state.values[#state.values + 1] = detail % 7
    emit("scan", 2, sum, count, nested)
    return detail, count
end)

router:register("scan-3", function(self, packet, used)
    local state = self.channels[3]
    local identity = "scan:" .. packet.tag
    local prior = state.seen[identity]
    if prior then
        emit("duplicate", "scan", 3, prior)
        return state.balance, "duplicate"
    end
    state.seen[identity] = packet.round
    state.revision += 1
    local integrity = checksum(identity)
    state.flags.integrity = integrity
    emit("begin", "scan", 3, used, state.revision)
    local sum, count = 0, 0
    local selected = {}
    for index, value in iterator(state.values) do
        if (index + packet.round) % 3 == 0 then
            selected[#selected + 1] = {index, value}
        else
            sum += value
        end
        count += 1
    end
    local nested = treeSum(selected, 0)
    local detail = sum + nested + packet.amount
    state.flags.lastScan = count
    state.values[#state.values + 1] = detail % 7
    emit("scan", 3, sum, count, nested)
    return detail, count
end)

router:register("scan-4", function(self, packet, used)
    local state = self.channels[4]
    local identity = "scan:" .. packet.tag
    local prior = state.seen[identity]
    if prior then
        emit("duplicate", "scan", 4, prior)
        return state.balance, "duplicate"
    end
    state.seen[identity] = packet.round
    state.revision += 1
    local integrity = checksum(identity)
    state.flags.integrity = integrity
    emit("begin", "scan", 4, used, state.revision)
    local sum, count = 0, 0
    local selected = {}
    for index, value in iterator(state.values) do
        if (index + packet.round) % 3 == 0 then
            selected[#selected + 1] = {index, value}
        else
            sum += value
        end
        count += 1
    end
    local nested = treeSum(selected, 0)
    local detail = sum + nested + packet.amount
    state.flags.lastScan = count
    state.values[#state.values + 1] = detail % 7
    emit("scan", 4, sum, count, nested)
    return detail, count
end)

router:register("scan-5", function(self, packet, used)
    local state = self.channels[5]
    local identity = "scan:" .. packet.tag
    local prior = state.seen[identity]
    if prior then
        emit("duplicate", "scan", 5, prior)
        return state.balance, "duplicate"
    end
    state.seen[identity] = packet.round
    state.revision += 1
    local integrity = checksum(identity)
    state.flags.integrity = integrity
    emit("begin", "scan", 5, used, state.revision)
    local sum, count = 0, 0
    local selected = {}
    for index, value in iterator(state.values) do
        if (index + packet.round) % 3 == 0 then
            selected[#selected + 1] = {index, value}
        else
            sum += value
        end
        count += 1
    end
    local nested = treeSum(selected, 0)
    local detail = sum + nested + packet.amount
    state.flags.lastScan = count
    state.values[#state.values + 1] = detail % 7
    emit("scan", 5, sum, count, nested)
    return detail, count
end)

router:register("scan-6", function(self, packet, used)
    local state = self.channels[6]
    local identity = "scan:" .. packet.tag
    local prior = state.seen[identity]
    if prior then
        emit("duplicate", "scan", 6, prior)
        return state.balance, "duplicate"
    end
    state.seen[identity] = packet.round
    state.revision += 1
    local integrity = checksum(identity)
    state.flags.integrity = integrity
    emit("begin", "scan", 6, used, state.revision)
    local sum, count = 0, 0
    local selected = {}
    for index, value in iterator(state.values) do
        if (index + packet.round) % 3 == 0 then
            selected[#selected + 1] = {index, value}
        else
            sum += value
        end
        count += 1
    end
    local nested = treeSum(selected, 0)
    local detail = sum + nested + packet.amount
    state.flags.lastScan = count
    state.values[#state.values + 1] = detail % 7
    emit("scan", 6, sum, count, nested)
    return detail, count
end)

router:register("scan-7", function(self, packet, used)
    local state = self.channels[7]
    local identity = "scan:" .. packet.tag
    local prior = state.seen[identity]
    if prior then
        emit("duplicate", "scan", 7, prior)
        return state.balance, "duplicate"
    end
    state.seen[identity] = packet.round
    state.revision += 1
    local integrity = checksum(identity)
    state.flags.integrity = integrity
    emit("begin", "scan", 7, used, state.revision)
    local sum, count = 0, 0
    local selected = {}
    for index, value in iterator(state.values) do
        if (index + packet.round) % 3 == 0 then
            selected[#selected + 1] = {index, value}
        else
            sum += value
        end
        count += 1
    end
    local nested = treeSum(selected, 0)
    local detail = sum + nested + packet.amount
    state.flags.lastScan = count
    state.values[#state.values + 1] = detail % 7
    emit("scan", 7, sum, count, nested)
    return detail, count
end)

router:register("scan-8", function(self, packet, used)
    local state = self.channels[8]
    local identity = "scan:" .. packet.tag
    local prior = state.seen[identity]
    if prior then
        emit("duplicate", "scan", 8, prior)
        return state.balance, "duplicate"
    end
    state.seen[identity] = packet.round
    state.revision += 1
    local integrity = checksum(identity)
    state.flags.integrity = integrity
    emit("begin", "scan", 8, used, state.revision)
    local sum, count = 0, 0
    local selected = {}
    for index, value in iterator(state.values) do
        if (index + packet.round) % 3 == 0 then
            selected[#selected + 1] = {index, value}
        else
            sum += value
        end
        count += 1
    end
    local nested = treeSum(selected, 0)
    local detail = sum + nested + packet.amount
    state.flags.lastScan = count
    state.values[#state.values + 1] = detail % 7
    emit("scan", 8, sum, count, nested)
    return detail, count
end)

router:register("amend-1", function(self, packet, used)
    local state = self.channels[1]
    local identity = "amend:" .. packet.tag
    local prior = state.seen[identity]
    if prior then
        emit("duplicate", "amend", 1, prior)
        return state.balance, "duplicate"
    end
    state.seen[identity] = packet.round
    state.revision += 1
    local integrity = checksum(identity)
    state.flags.integrity = integrity
    emit("begin", "amend", 1, used, state.revision)
    local old = state.values[#state.values]
    local nextValue = packet.amount % (1 + 4)
    local history = {old, nextValue, state.balance}
    local function revise(extra, ...)
        local total = nextValue + extra
        for index = 1, select("#", ...) do
            local value = select(index, ...)
            total += value or 0
        end
        nextValue = total
        return total, old
    end
    local revised, previous = revise(used, nil, packet.round)
    state.values[#state.values + 1] = revised
    state.flags.previous = previous or 0
    emit("amend", 1, revised, previous, #history)
    return revised, packet.tag
end)

router:register("amend-2", function(self, packet, used)
    local state = self.channels[2]
    local identity = "amend:" .. packet.tag
    local prior = state.seen[identity]
    if prior then
        emit("duplicate", "amend", 2, prior)
        return state.balance, "duplicate"
    end
    state.seen[identity] = packet.round
    state.revision += 1
    local integrity = checksum(identity)
    state.flags.integrity = integrity
    emit("begin", "amend", 2, used, state.revision)
    local old = state.values[#state.values]
    local nextValue = packet.amount % (2 + 4)
    local history = {old, nextValue, state.balance}
    local function revise(extra, ...)
        local total = nextValue + extra
        for index = 1, select("#", ...) do
            local value = select(index, ...)
            total += value or 0
        end
        nextValue = total
        return total, old
    end
    local revised, previous = revise(used, nil, packet.round)
    state.values[#state.values + 1] = revised
    state.flags.previous = previous or 0
    emit("amend", 2, revised, previous, #history)
    return revised, packet.tag
end)

router:register("amend-3", function(self, packet, used)
    local state = self.channels[3]
    local identity = "amend:" .. packet.tag
    local prior = state.seen[identity]
    if prior then
        emit("duplicate", "amend", 3, prior)
        return state.balance, "duplicate"
    end
    state.seen[identity] = packet.round
    state.revision += 1
    local integrity = checksum(identity)
    state.flags.integrity = integrity
    emit("begin", "amend", 3, used, state.revision)
    local old = state.values[#state.values]
    local nextValue = packet.amount % (3 + 4)
    local history = {old, nextValue, state.balance}
    local function revise(extra, ...)
        local total = nextValue + extra
        for index = 1, select("#", ...) do
            local value = select(index, ...)
            total += value or 0
        end
        nextValue = total
        return total, old
    end
    local revised, previous = revise(used, nil, packet.round)
    state.values[#state.values + 1] = revised
    state.flags.previous = previous or 0
    emit("amend", 3, revised, previous, #history)
    return revised, packet.tag
end)

router:register("amend-4", function(self, packet, used)
    local state = self.channels[4]
    local identity = "amend:" .. packet.tag
    local prior = state.seen[identity]
    if prior then
        emit("duplicate", "amend", 4, prior)
        return state.balance, "duplicate"
    end
    state.seen[identity] = packet.round
    state.revision += 1
    local integrity = checksum(identity)
    state.flags.integrity = integrity
    emit("begin", "amend", 4, used, state.revision)
    local old = state.values[#state.values]
    local nextValue = packet.amount % (4 + 4)
    local history = {old, nextValue, state.balance}
    local function revise(extra, ...)
        local total = nextValue + extra
        for index = 1, select("#", ...) do
            local value = select(index, ...)
            total += value or 0
        end
        nextValue = total
        return total, old
    end
    local revised, previous = revise(used, nil, packet.round)
    state.values[#state.values + 1] = revised
    state.flags.previous = previous or 0
    emit("amend", 4, revised, previous, #history)
    return revised, packet.tag
end)

router:register("amend-5", function(self, packet, used)
    local state = self.channels[5]
    local identity = "amend:" .. packet.tag
    local prior = state.seen[identity]
    if prior then
        emit("duplicate", "amend", 5, prior)
        return state.balance, "duplicate"
    end
    state.seen[identity] = packet.round
    state.revision += 1
    local integrity = checksum(identity)
    state.flags.integrity = integrity
    emit("begin", "amend", 5, used, state.revision)
    local old = state.values[#state.values]
    local nextValue = packet.amount % (5 + 4)
    local history = {old, nextValue, state.balance}
    local function revise(extra, ...)
        local total = nextValue + extra
        for index = 1, select("#", ...) do
            local value = select(index, ...)
            total += value or 0
        end
        nextValue = total
        return total, old
    end
    local revised, previous = revise(used, nil, packet.round)
    state.values[#state.values + 1] = revised
    state.flags.previous = previous or 0
    emit("amend", 5, revised, previous, #history)
    return revised, packet.tag
end)

router:register("amend-6", function(self, packet, used)
    local state = self.channels[6]
    local identity = "amend:" .. packet.tag
    local prior = state.seen[identity]
    if prior then
        emit("duplicate", "amend", 6, prior)
        return state.balance, "duplicate"
    end
    state.seen[identity] = packet.round
    state.revision += 1
    local integrity = checksum(identity)
    state.flags.integrity = integrity
    emit("begin", "amend", 6, used, state.revision)
    local old = state.values[#state.values]
    local nextValue = packet.amount % (6 + 4)
    local history = {old, nextValue, state.balance}
    local function revise(extra, ...)
        local total = nextValue + extra
        for index = 1, select("#", ...) do
            local value = select(index, ...)
            total += value or 0
        end
        nextValue = total
        return total, old
    end
    local revised, previous = revise(used, nil, packet.round)
    state.values[#state.values + 1] = revised
    state.flags.previous = previous or 0
    emit("amend", 6, revised, previous, #history)
    return revised, packet.tag
end)

router:register("amend-7", function(self, packet, used)
    local state = self.channels[7]
    local identity = "amend:" .. packet.tag
    local prior = state.seen[identity]
    if prior then
        emit("duplicate", "amend", 7, prior)
        return state.balance, "duplicate"
    end
    state.seen[identity] = packet.round
    state.revision += 1
    local integrity = checksum(identity)
    state.flags.integrity = integrity
    emit("begin", "amend", 7, used, state.revision)
    local old = state.values[#state.values]
    local nextValue = packet.amount % (7 + 4)
    local history = {old, nextValue, state.balance}
    local function revise(extra, ...)
        local total = nextValue + extra
        for index = 1, select("#", ...) do
            local value = select(index, ...)
            total += value or 0
        end
        nextValue = total
        return total, old
    end
    local revised, previous = revise(used, nil, packet.round)
    state.values[#state.values + 1] = revised
    state.flags.previous = previous or 0
    emit("amend", 7, revised, previous, #history)
    return revised, packet.tag
end)

router:register("amend-8", function(self, packet, used)
    local state = self.channels[8]
    local identity = "amend:" .. packet.tag
    local prior = state.seen[identity]
    if prior then
        emit("duplicate", "amend", 8, prior)
        return state.balance, "duplicate"
    end
    state.seen[identity] = packet.round
    state.revision += 1
    local integrity = checksum(identity)
    state.flags.integrity = integrity
    emit("begin", "amend", 8, used, state.revision)
    local old = state.values[#state.values]
    local nextValue = packet.amount % (8 + 4)
    local history = {old, nextValue, state.balance}
    local function revise(extra, ...)
        local total = nextValue + extra
        for index = 1, select("#", ...) do
            local value = select(index, ...)
            total += value or 0
        end
        nextValue = total
        return total, old
    end
    local revised, previous = revise(used, nil, packet.round)
    state.values[#state.values + 1] = revised
    state.flags.previous = previous or 0
    emit("amend", 8, revised, previous, #history)
    return revised, packet.tag
end)

router:register("checkpoint-1", function(self, packet, used)
    local state = self.channels[1]
    local identity = "checkpoint:" .. packet.tag
    local prior = state.seen[identity]
    if prior then
        emit("duplicate", "checkpoint", 1, prior)
        return state.balance, "duplicate"
    end
    state.seen[identity] = packet.round
    state.revision += 1
    local integrity = checksum(identity)
    state.flags.integrity = integrity
    emit("begin", "checkpoint", 1, used, state.revision)
    local copy = {}
    for index, value in ipairs(state.values) do
        copy[index] = value
    end
    local stamp = checksum(packet.tag) + state.revision
    local function readSnapshot(index)
        return copy[index], stamp
    end
    local first, version = readSnapshot(1)
    local last = readSnapshot(#copy)
    local accepted = (stamp + packet.round) % 2 == 0
    if accepted then
        self.commits += 1
        state.flags.checkpoint = stamp
    else
        self.rollbacks += 1
        state.flags.rejected = stamp
    end
    emit("checkpoint", 1, first, last, version, accepted)
    return accepted, stamp
end)

router:register("checkpoint-2", function(self, packet, used)
    local state = self.channels[2]
    local identity = "checkpoint:" .. packet.tag
    local prior = state.seen[identity]
    if prior then
        emit("duplicate", "checkpoint", 2, prior)
        return state.balance, "duplicate"
    end
    state.seen[identity] = packet.round
    state.revision += 1
    local integrity = checksum(identity)
    state.flags.integrity = integrity
    emit("begin", "checkpoint", 2, used, state.revision)
    local copy = {}
    for index, value in ipairs(state.values) do
        copy[index] = value
    end
    local stamp = checksum(packet.tag) + state.revision
    local function readSnapshot(index)
        return copy[index], stamp
    end
    local first, version = readSnapshot(1)
    local last = readSnapshot(#copy)
    local accepted = (stamp + packet.round) % 2 == 0
    if accepted then
        self.commits += 1
        state.flags.checkpoint = stamp
    else
        self.rollbacks += 1
        state.flags.rejected = stamp
    end
    emit("checkpoint", 2, first, last, version, accepted)
    return accepted, stamp
end)

router:register("checkpoint-3", function(self, packet, used)
    local state = self.channels[3]
    local identity = "checkpoint:" .. packet.tag
    local prior = state.seen[identity]
    if prior then
        emit("duplicate", "checkpoint", 3, prior)
        return state.balance, "duplicate"
    end
    state.seen[identity] = packet.round
    state.revision += 1
    local integrity = checksum(identity)
    state.flags.integrity = integrity
    emit("begin", "checkpoint", 3, used, state.revision)
    local copy = {}
    for index, value in ipairs(state.values) do
        copy[index] = value
    end
    local stamp = checksum(packet.tag) + state.revision
    local function readSnapshot(index)
        return copy[index], stamp
    end
    local first, version = readSnapshot(1)
    local last = readSnapshot(#copy)
    local accepted = (stamp + packet.round) % 2 == 0
    if accepted then
        self.commits += 1
        state.flags.checkpoint = stamp
    else
        self.rollbacks += 1
        state.flags.rejected = stamp
    end
    emit("checkpoint", 3, first, last, version, accepted)
    return accepted, stamp
end)

router:register("checkpoint-4", function(self, packet, used)
    local state = self.channels[4]
    local identity = "checkpoint:" .. packet.tag
    local prior = state.seen[identity]
    if prior then
        emit("duplicate", "checkpoint", 4, prior)
        return state.balance, "duplicate"
    end
    state.seen[identity] = packet.round
    state.revision += 1
    local integrity = checksum(identity)
    state.flags.integrity = integrity
    emit("begin", "checkpoint", 4, used, state.revision)
    local copy = {}
    for index, value in ipairs(state.values) do
        copy[index] = value
    end
    local stamp = checksum(packet.tag) + state.revision
    local function readSnapshot(index)
        return copy[index], stamp
    end
    local first, version = readSnapshot(1)
    local last = readSnapshot(#copy)
    local accepted = (stamp + packet.round) % 2 == 0
    if accepted then
        self.commits += 1
        state.flags.checkpoint = stamp
    else
        self.rollbacks += 1
        state.flags.rejected = stamp
    end
    emit("checkpoint", 4, first, last, version, accepted)
    return accepted, stamp
end)

router:register("checkpoint-5", function(self, packet, used)
    local state = self.channels[5]
    local identity = "checkpoint:" .. packet.tag
    local prior = state.seen[identity]
    if prior then
        emit("duplicate", "checkpoint", 5, prior)
        return state.balance, "duplicate"
    end
    state.seen[identity] = packet.round
    state.revision += 1
    local integrity = checksum(identity)
    state.flags.integrity = integrity
    emit("begin", "checkpoint", 5, used, state.revision)
    local copy = {}
    for index, value in ipairs(state.values) do
        copy[index] = value
    end
    local stamp = checksum(packet.tag) + state.revision
    local function readSnapshot(index)
        return copy[index], stamp
    end
    local first, version = readSnapshot(1)
    local last = readSnapshot(#copy)
    local accepted = (stamp + packet.round) % 2 == 0
    if accepted then
        self.commits += 1
        state.flags.checkpoint = stamp
    else
        self.rollbacks += 1
        state.flags.rejected = stamp
    end
    emit("checkpoint", 5, first, last, version, accepted)
    return accepted, stamp
end)

router:register("checkpoint-6", function(self, packet, used)
    local state = self.channels[6]
    local identity = "checkpoint:" .. packet.tag
    local prior = state.seen[identity]
    if prior then
        emit("duplicate", "checkpoint", 6, prior)
        return state.balance, "duplicate"
    end
    state.seen[identity] = packet.round
    state.revision += 1
    local integrity = checksum(identity)
    state.flags.integrity = integrity
    emit("begin", "checkpoint", 6, used, state.revision)
    local copy = {}
    for index, value in ipairs(state.values) do
        copy[index] = value
    end
    local stamp = checksum(packet.tag) + state.revision
    local function readSnapshot(index)
        return copy[index], stamp
    end
    local first, version = readSnapshot(1)
    local last = readSnapshot(#copy)
    local accepted = (stamp + packet.round) % 2 == 0
    if accepted then
        self.commits += 1
        state.flags.checkpoint = stamp
    else
        self.rollbacks += 1
        state.flags.rejected = stamp
    end
    emit("checkpoint", 6, first, last, version, accepted)
    return accepted, stamp
end)

router:register("checkpoint-7", function(self, packet, used)
    local state = self.channels[7]
    local identity = "checkpoint:" .. packet.tag
    local prior = state.seen[identity]
    if prior then
        emit("duplicate", "checkpoint", 7, prior)
        return state.balance, "duplicate"
    end
    state.seen[identity] = packet.round
    state.revision += 1
    local integrity = checksum(identity)
    state.flags.integrity = integrity
    emit("begin", "checkpoint", 7, used, state.revision)
    local copy = {}
    for index, value in ipairs(state.values) do
        copy[index] = value
    end
    local stamp = checksum(packet.tag) + state.revision
    local function readSnapshot(index)
        return copy[index], stamp
    end
    local first, version = readSnapshot(1)
    local last = readSnapshot(#copy)
    local accepted = (stamp + packet.round) % 2 == 0
    if accepted then
        self.commits += 1
        state.flags.checkpoint = stamp
    else
        self.rollbacks += 1
        state.flags.rejected = stamp
    end
    emit("checkpoint", 7, first, last, version, accepted)
    return accepted, stamp
end)

router:register("checkpoint-8", function(self, packet, used)
    local state = self.channels[8]
    local identity = "checkpoint:" .. packet.tag
    local prior = state.seen[identity]
    if prior then
        emit("duplicate", "checkpoint", 8, prior)
        return state.balance, "duplicate"
    end
    state.seen[identity] = packet.round
    state.revision += 1
    local integrity = checksum(identity)
    state.flags.integrity = integrity
    emit("begin", "checkpoint", 8, used, state.revision)
    local copy = {}
    for index, value in ipairs(state.values) do
        copy[index] = value
    end
    local stamp = checksum(packet.tag) + state.revision
    local function readSnapshot(index)
        return copy[index], stamp
    end
    local first, version = readSnapshot(1)
    local last = readSnapshot(#copy)
    local accepted = (stamp + packet.round) % 2 == 0
    if accepted then
        self.commits += 1
        state.flags.checkpoint = stamp
    else
        self.rollbacks += 1
        state.flags.rejected = stamp
    end
    emit("checkpoint", 8, first, last, version, accepted)
    return accepted, stamp
end)

local families = {"credit", "debit", "route", "scan", "amend", "checkpoint"}
for round = 1, 3 do
    for _, family in ipairs(families) do
        for channel = 1, 8 do
            local command = family .. "-" .. tostring(channel)
            local amount = seed + channel * round - mode
            local tag = "r" .. tostring(round) .. ":" .. tostring(mode)
            local frame = encode({command, tostring(amount), tag, tostring(round)})
            local value, detail, count = router:dispatch(frame)
            emit("response", command, value, detail, count)
            if (channel + mode + round) % 5 == 0 then
                local duplicate, reason = router:dispatch(frame)
                emit("replay", command, duplicate, reason)
            end
        end
    end
end
for _, frame in ipairs({"x:abc", "8:short", "1:a", encode({"missing", "3", "tag", "1"})}) do
    local ok, message = pcall(function() return router:dispatch(frame) end)
    emit("rejected", ok, message)
end
local total = 0
for channel = 1, 8 do
    local state = router.channels[channel]
    total += state.balance
    emit("channel", channel, state.balance, state.revision, treeSum(state.values, 0))
end
emit("final", router.calls, router.commits, router.rollbacks, total)
for _, line in ipairs(trace) do
    print(line)
end
