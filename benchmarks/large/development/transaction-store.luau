-- Original generated development benchmark: transaction-store.
-- Reproduce with: node scripts/large/generate-development.mjs
-- Hand-authored runtime and eight handler families, each with six specializations.
-- No external services, clocks, random sources, or unordered table traversal.
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
local function digest(text)
    local value = 17
    for i = 1, #text do
        value = (value * 33 + string.byte(text, i)) % 1000003
    end
    return value
end

local Store = {}
Store.__index = Store
local Transaction = {}
Transaction.__index = Transaction
local function clone(value)
    if type(value) ~= "table" then
        return value
    end
    local result = {}
    for _, key in ipairs({"id", "balance", "version", "active", "tag", "score"}) do
        result[key] = clone(value[key])
    end
    return result
end
function Store.new()
    return setmetatable({rows = {}, order = {}, revision = 0, journal = {}, watchers = {}, indexes = {}}, Store)
end
function Store:begin(label)
    return setmetatable({store = self, label = label, reads = {}, writes = {}, keys = {}, seen = {}, marks = {}, closed = false}, Transaction)
end
function Transaction:read(key)
    assert(not self.closed, "transaction-closed")
    if self.writes[key] ~= nil then
        if self.writes[key] == false then
            return nil, -1
        end
        return clone(self.writes[key]), self.reads[key]
    end
    local row = self.store.rows[key]
    self.reads[key] = row and row.version or -1
    return clone(row), self.reads[key]
end
function Transaction:write(key, row)
    assert(not self.closed, "transaction-closed")
    if self.reads[key] == nil then
        self:read(key)
    end
    if not self.seen[key] then
        self.keys[#self.keys + 1] = key
        self.seen[key] = true
    end
    self.writes[key] = clone(row)
end
function Transaction:remove(key)
    self:write(key, false)
end
function Transaction:mark()
    local mark = {writes = {}, keys = {}}
    for i, key in ipairs(self.keys) do
        mark.keys[i] = key
        mark.writes[key] = clone(self.writes[key])
    end
    self.marks[#self.marks + 1] = mark
    return #self.marks
end
function Transaction:restore(index)
    local mark = assert(self.marks[index], "missing-savepoint")
    self.writes = {}
    self.keys = {}
    self.seen = {}
    for i, key in ipairs(mark.keys) do
        self.keys[i] = key
        self.seen[key] = true
        self.writes[key] = clone(mark.writes[key])
    end
    emit("restore", self.label, index, #self.keys)
end
function Transaction:commit()
    assert(not self.closed, "transaction-closed")
    local readKeys = {}
    for key in pairs(self.reads) do
        readKeys[#readKeys + 1] = key
    end
    table.sort(readKeys)
    for _, key in ipairs(readKeys) do
        local row = self.store.rows[key]
        local version = row and row.version or -1
        if version ~= self.reads[key] then
            self.closed = true
            emit("conflict", self.label, key, self.reads[key], version)
            return false, "conflict"
        end
    end
    for _, key in ipairs(self.keys) do
        local row = self.writes[key]
        if row and row.balance < 0 then
            self.closed = true
            emit("reject", self.label, key)
            return false, "negative-balance"
        end
    end
    self.store.revision += 1
    local revision = self.store.revision
    for _, key in ipairs(self.keys) do
        local old = self.store.rows[key]
        local row = self.writes[key]
        if row then
            row = clone(row)
            row.version = revision
            if not old then
                self.store.order[#self.store.order + 1] = key
            end
            self.store.rows[key] = row
        else
            self.store.rows[key] = nil
        end
        self.store.journal[#self.store.journal + 1] = {key, revision, old and old.balance or 0, row and row.balance or 0}
        for _, watcher in ipairs(self.store.watchers) do
            watcher(key, old, row, revision)
        end
    end
    self.closed = true
    emit("commit", self.label, revision, #self.keys)
    return true, revision
end
function Store:scan(prefix)
    local keys = {}
    local added = {}
    for _, key in ipairs(self.order) do
        if not added[key] and self.rows[key] and string.sub(key, 1, #prefix) == prefix then
            added[key] = true
            keys[#keys + 1] = key
        end
    end
    table.sort(keys)
    local cursor = 0
    return function()
        cursor += 1
        local key = keys[cursor]
        if key then
            return key, clone(self.rows[key])
        end
    end
end
function Store:fold(prefix, reducer, initial)
    local state = initial
    for key, row in self:scan(prefix) do
        state = reducer(state, key, row)
    end
    return state
end
local store = Store.new()
local watchCount, watchTotal = 0, 0
store.watchers[1] = function(key, old, row, revision)
    watchCount += 1
    watchTotal += (row and row.balance or 0) - (old and old.balance or 0)
    if (watchCount + mode) % 7 == 0 then
        emit("watch", key, revision, watchTotal)
    end
end
local function rowFor(key, amount, tag)
    return {id = key, balance = amount, version = 0, active = true, tag = tag, score = 0}
end
local handlers = {}

handlers[1] = function()
    local prefix = "collection1:"
    local tx = store:begin("populate-collection1")
    local inserted, skipped = 0, 0
    for index = 1, 5 do
        local key = prefix .. tostring(index)
        local existing = tx:read(key)
        if existing then
            skipped += 1
        else
            local balance = math.abs(seed * 3 + index * 11) % 90 + 25
            local row = rowFor(key, balance, "collection1")
            if (index + mode) % 2 == 0 then
                row.score = index * 1
            else
                row.active = index % 3 ~= 0
                row.score = -index
            end
            tx:write(key, row)
            inserted += 1
        end
    end
    local ok, revision = tx:commit()
    emit("populate", "collection1", inserted, skipped, ok, revision)
    local total = store:fold(prefix, function(sum, _, row) return sum + row.balance end, 0)
    emit("population-total", "collection1", total)
    return total, inserted
end

handlers[2] = function()
    local prefix = "collection2:"
    local tx = store:begin("populate-collection2")
    local inserted, skipped = 0, 0
    for index = 1, 6 do
        local key = prefix .. tostring(index)
        local existing = tx:read(key)
        if existing then
            skipped += 1
        else
            local balance = math.abs(seed * 4 + index * 11) % 90 + 25
            local row = rowFor(key, balance, "collection2")
            if (index + mode) % 2 == 0 then
                row.score = index * 2
            else
                row.active = index % 3 ~= 0
                row.score = -index
            end
            tx:write(key, row)
            inserted += 1
        end
    end
    local ok, revision = tx:commit()
    emit("populate", "collection2", inserted, skipped, ok, revision)
    local total = store:fold(prefix, function(sum, _, row) return sum + row.balance end, 0)
    emit("population-total", "collection2", total)
    return total, inserted
end

handlers[3] = function()
    local prefix = "collection3:"
    local tx = store:begin("populate-collection3")
    local inserted, skipped = 0, 0
    for index = 1, 7 do
        local key = prefix .. tostring(index)
        local existing = tx:read(key)
        if existing then
            skipped += 1
        else
            local balance = math.abs(seed * 5 + index * 11) % 90 + 25
            local row = rowFor(key, balance, "collection3")
            if (index + mode) % 2 == 0 then
                row.score = index * 3
            else
                row.active = index % 3 ~= 0
                row.score = -index
            end
            tx:write(key, row)
            inserted += 1
        end
    end
    local ok, revision = tx:commit()
    emit("populate", "collection3", inserted, skipped, ok, revision)
    local total = store:fold(prefix, function(sum, _, row) return sum + row.balance end, 0)
    emit("population-total", "collection3", total)
    return total, inserted
end

handlers[4] = function()
    local prefix = "collection4:"
    local tx = store:begin("populate-collection4")
    local inserted, skipped = 0, 0
    for index = 1, 8 do
        local key = prefix .. tostring(index)
        local existing = tx:read(key)
        if existing then
            skipped += 1
        else
            local balance = math.abs(seed * 6 + index * 11) % 90 + 25
            local row = rowFor(key, balance, "collection4")
            if (index + mode) % 2 == 0 then
                row.score = index * 4
            else
                row.active = index % 3 ~= 0
                row.score = -index
            end
            tx:write(key, row)
            inserted += 1
        end
    end
    local ok, revision = tx:commit()
    emit("populate", "collection4", inserted, skipped, ok, revision)
    local total = store:fold(prefix, function(sum, _, row) return sum + row.balance end, 0)
    emit("population-total", "collection4", total)
    return total, inserted
end

handlers[5] = function()
    local prefix = "collection5:"
    local tx = store:begin("populate-collection5")
    local inserted, skipped = 0, 0
    for index = 1, 9 do
        local key = prefix .. tostring(index)
        local existing = tx:read(key)
        if existing then
            skipped += 1
        else
            local balance = math.abs(seed * 7 + index * 11) % 90 + 25
            local row = rowFor(key, balance, "collection5")
            if (index + mode) % 2 == 0 then
                row.score = index * 5
            else
                row.active = index % 3 ~= 0
                row.score = -index
            end
            tx:write(key, row)
            inserted += 1
        end
    end
    local ok, revision = tx:commit()
    emit("populate", "collection5", inserted, skipped, ok, revision)
    local total = store:fold(prefix, function(sum, _, row) return sum + row.balance end, 0)
    emit("population-total", "collection5", total)
    return total, inserted
end

handlers[6] = function()
    local prefix = "collection6:"
    local tx = store:begin("populate-collection6")
    local inserted, skipped = 0, 0
    for index = 1, 10 do
        local key = prefix .. tostring(index)
        local existing = tx:read(key)
        if existing then
            skipped += 1
        else
            local balance = math.abs(seed * 8 + index * 11) % 90 + 25
            local row = rowFor(key, balance, "collection6")
            if (index + mode) % 2 == 0 then
                row.score = index * 6
            else
                row.active = index % 3 ~= 0
                row.score = -index
            end
            tx:write(key, row)
            inserted += 1
        end
    end
    local ok, revision = tx:commit()
    emit("populate", "collection6", inserted, skipped, ok, revision)
    local total = store:fold(prefix, function(sum, _, row) return sum + row.balance end, 0)
    emit("population-total", "collection6", total)
    return total, inserted
end

handlers[7] = function()
    local prefix = "collection1:"
    local tx = store:begin("rebalance-collection1")
    local touched, delta = 0, 0
    for key, row in store:scan(prefix) do
        local before = row.balance
        if row.active then
            if row.balance > 70 + 1 then
                row.balance -= 4
                row.score += 2
            else
                row.balance += 2
                row.score += 1
            end
        elseif mode % 2 == 0 then
            row.active = true
            row.balance += 1
        else
            row.score -= 1
        end
        delta += row.balance - before
        touched += 1
        tx:write(key, row)
    end
    local ok, revision = tx:commit()
    emit("rebalance", "collection1", touched, delta, ok, revision)
    return delta, touched
end

handlers[8] = function()
    local prefix = "collection2:"
    local tx = store:begin("rebalance-collection2")
    local touched, delta = 0, 0
    for key, row in store:scan(prefix) do
        local before = row.balance
        if row.active then
            if row.balance > 70 + 2 then
                row.balance -= 5
                row.score += 2
            else
                row.balance += 3
                row.score += 1
            end
        elseif mode % 2 == 0 then
            row.active = true
            row.balance += 2
        else
            row.score -= 2
        end
        delta += row.balance - before
        touched += 1
        tx:write(key, row)
    end
    local ok, revision = tx:commit()
    emit("rebalance", "collection2", touched, delta, ok, revision)
    return delta, touched
end

handlers[9] = function()
    local prefix = "collection3:"
    local tx = store:begin("rebalance-collection3")
    local touched, delta = 0, 0
    for key, row in store:scan(prefix) do
        local before = row.balance
        if row.active then
            if row.balance > 70 + 3 then
                row.balance -= 6
                row.score += 2
            else
                row.balance += 4
                row.score += 1
            end
        elseif mode % 2 == 0 then
            row.active = true
            row.balance += 3
        else
            row.score -= 3
        end
        delta += row.balance - before
        touched += 1
        tx:write(key, row)
    end
    local ok, revision = tx:commit()
    emit("rebalance", "collection3", touched, delta, ok, revision)
    return delta, touched
end

handlers[10] = function()
    local prefix = "collection4:"
    local tx = store:begin("rebalance-collection4")
    local touched, delta = 0, 0
    for key, row in store:scan(prefix) do
        local before = row.balance
        if row.active then
            if row.balance > 70 + 4 then
                row.balance -= 7
                row.score += 2
            else
                row.balance += 5
                row.score += 1
            end
        elseif mode % 2 == 0 then
            row.active = true
            row.balance += 4
        else
            row.score -= 4
        end
        delta += row.balance - before
        touched += 1
        tx:write(key, row)
    end
    local ok, revision = tx:commit()
    emit("rebalance", "collection4", touched, delta, ok, revision)
    return delta, touched
end

handlers[11] = function()
    local prefix = "collection5:"
    local tx = store:begin("rebalance-collection5")
    local touched, delta = 0, 0
    for key, row in store:scan(prefix) do
        local before = row.balance
        if row.active then
            if row.balance > 70 + 5 then
                row.balance -= 8
                row.score += 2
            else
                row.balance += 6
                row.score += 1
            end
        elseif mode % 2 == 0 then
            row.active = true
            row.balance += 5
        else
            row.score -= 5
        end
        delta += row.balance - before
        touched += 1
        tx:write(key, row)
    end
    local ok, revision = tx:commit()
    emit("rebalance", "collection5", touched, delta, ok, revision)
    return delta, touched
end

handlers[12] = function()
    local prefix = "collection6:"
    local tx = store:begin("rebalance-collection6")
    local touched, delta = 0, 0
    for key, row in store:scan(prefix) do
        local before = row.balance
        if row.active then
            if row.balance > 70 + 6 then
                row.balance -= 9
                row.score += 2
            else
                row.balance += 7
                row.score += 1
            end
        elseif mode % 2 == 0 then
            row.active = true
            row.balance += 6
        else
            row.score -= 6
        end
        delta += row.balance - before
        touched += 1
        tx:write(key, row)
    end
    local ok, revision = tx:commit()
    emit("rebalance", "collection6", touched, delta, ok, revision)
    return delta, touched
end

handlers[13] = function()
    local prefix = "collection1:"
    local sourceKey = prefix .. "1"
    local targetKey = prefix .. "2"
    local tx = store:begin("transfer-collection1")
    local source, sourceVersion = tx:read(sourceKey)
    local target, targetVersion = tx:read(targetKey)
    local requested = math.abs(seed + mode * 2) % 50 + 1
    local amount = math.min(source.balance, requested)
    local mark = tx:mark()
    source.balance -= amount
    target.balance += amount
    source.score += 1
    target.score -= 1
    tx:write(sourceKey, source)
    tx:write(targetKey, target)
    if (seed + mode + 1) % 3 == 0 then
        tx:restore(mark)
        amount = 0
    else
        if target.balance > 110 then
            target.tag = "overflow-collection1"
            tx:write(targetKey, target)
        end
    end
    local ok, revision = tx:commit()
    emit("transfer", "collection1", amount, sourceVersion, targetVersion, ok, revision)
    return amount, revision
end

handlers[14] = function()
    local prefix = "collection2:"
    local sourceKey = prefix .. "1"
    local targetKey = prefix .. "2"
    local tx = store:begin("transfer-collection2")
    local source, sourceVersion = tx:read(sourceKey)
    local target, targetVersion = tx:read(targetKey)
    local requested = math.abs(seed + mode * 3) % 50 + 1
    local amount = math.min(source.balance, requested)
    local mark = tx:mark()
    source.balance -= amount
    target.balance += amount
    source.score += 2
    target.score -= 2
    tx:write(sourceKey, source)
    tx:write(targetKey, target)
    if (seed + mode + 2) % 3 == 0 then
        tx:restore(mark)
        amount = 0
    else
        if target.balance > 110 then
            target.tag = "overflow-collection2"
            tx:write(targetKey, target)
        end
    end
    local ok, revision = tx:commit()
    emit("transfer", "collection2", amount, sourceVersion, targetVersion, ok, revision)
    return amount, revision
end

handlers[15] = function()
    local prefix = "collection3:"
    local sourceKey = prefix .. "1"
    local targetKey = prefix .. "2"
    local tx = store:begin("transfer-collection3")
    local source, sourceVersion = tx:read(sourceKey)
    local target, targetVersion = tx:read(targetKey)
    local requested = math.abs(seed + mode * 4) % 50 + 1
    local amount = math.min(source.balance, requested)
    local mark = tx:mark()
    source.balance -= amount
    target.balance += amount
    source.score += 3
    target.score -= 3
    tx:write(sourceKey, source)
    tx:write(targetKey, target)
    if (seed + mode + 3) % 3 == 0 then
        tx:restore(mark)
        amount = 0
    else
        if target.balance > 110 then
            target.tag = "overflow-collection3"
            tx:write(targetKey, target)
        end
    end
    local ok, revision = tx:commit()
    emit("transfer", "collection3", amount, sourceVersion, targetVersion, ok, revision)
    return amount, revision
end

handlers[16] = function()
    local prefix = "collection4:"
    local sourceKey = prefix .. "1"
    local targetKey = prefix .. "2"
    local tx = store:begin("transfer-collection4")
    local source, sourceVersion = tx:read(sourceKey)
    local target, targetVersion = tx:read(targetKey)
    local requested = math.abs(seed + mode * 5) % 50 + 1
    local amount = math.min(source.balance, requested)
    local mark = tx:mark()
    source.balance -= amount
    target.balance += amount
    source.score += 4
    target.score -= 4
    tx:write(sourceKey, source)
    tx:write(targetKey, target)
    if (seed + mode + 4) % 3 == 0 then
        tx:restore(mark)
        amount = 0
    else
        if target.balance > 110 then
            target.tag = "overflow-collection4"
            tx:write(targetKey, target)
        end
    end
    local ok, revision = tx:commit()
    emit("transfer", "collection4", amount, sourceVersion, targetVersion, ok, revision)
    return amount, revision
end

handlers[17] = function()
    local prefix = "collection5:"
    local sourceKey = prefix .. "1"
    local targetKey = prefix .. "2"
    local tx = store:begin("transfer-collection5")
    local source, sourceVersion = tx:read(sourceKey)
    local target, targetVersion = tx:read(targetKey)
    local requested = math.abs(seed + mode * 6) % 50 + 1
    local amount = math.min(source.balance, requested)
    local mark = tx:mark()
    source.balance -= amount
    target.balance += amount
    source.score += 5
    target.score -= 5
    tx:write(sourceKey, source)
    tx:write(targetKey, target)
    if (seed + mode + 5) % 3 == 0 then
        tx:restore(mark)
        amount = 0
    else
        if target.balance > 110 then
            target.tag = "overflow-collection5"
            tx:write(targetKey, target)
        end
    end
    local ok, revision = tx:commit()
    emit("transfer", "collection5", amount, sourceVersion, targetVersion, ok, revision)
    return amount, revision
end

handlers[18] = function()
    local prefix = "collection6:"
    local sourceKey = prefix .. "1"
    local targetKey = prefix .. "2"
    local tx = store:begin("transfer-collection6")
    local source, sourceVersion = tx:read(sourceKey)
    local target, targetVersion = tx:read(targetKey)
    local requested = math.abs(seed + mode * 7) % 50 + 1
    local amount = math.min(source.balance, requested)
    local mark = tx:mark()
    source.balance -= amount
    target.balance += amount
    source.score += 6
    target.score -= 6
    tx:write(sourceKey, source)
    tx:write(targetKey, target)
    if (seed + mode + 6) % 3 == 0 then
        tx:restore(mark)
        amount = 0
    else
        if target.balance > 110 then
            target.tag = "overflow-collection6"
            tx:write(targetKey, target)
        end
    end
    local ok, revision = tx:commit()
    emit("transfer", "collection6", amount, sourceVersion, targetVersion, ok, revision)
    return amount, revision
end

handlers[19] = function()
    local key = "collection1:3"
    local first = store:begin("contender-a-collection1")
    local second = store:begin("contender-b-collection1")
    local firstRow = first:read(key)
    local secondRow = second:read(key)
    firstRow.balance += 3
    secondRow.balance += 6
    first:write(key, firstRow)
    second:write(key, secondRow)
    local firstOk, firstRevision = first:commit()
    local secondOk, reason = second:commit()
    local recovered = 0
    if not secondOk then
        local retry = store:begin("retry-collection1")
        local latest = retry:read(key)
        if latest.active then
            recovered = 6
        else
            recovered = 2
        end
        latest.balance += recovered
        latest.score += 1
        retry:write(key, latest)
        retry:commit()
    end
    emit("race", "collection1", firstOk, firstRevision, secondOk, reason, recovered)
    return recovered, firstRevision
end

handlers[20] = function()
    local key = "collection2:3"
    local first = store:begin("contender-a-collection2")
    local second = store:begin("contender-b-collection2")
    local firstRow = first:read(key)
    local secondRow = second:read(key)
    firstRow.balance += 4
    secondRow.balance += 7
    first:write(key, firstRow)
    second:write(key, secondRow)
    local firstOk, firstRevision = first:commit()
    local secondOk, reason = second:commit()
    local recovered = 0
    if not secondOk then
        local retry = store:begin("retry-collection2")
        local latest = retry:read(key)
        if latest.active then
            recovered = 7
        else
            recovered = 3
        end
        latest.balance += recovered
        latest.score += 1
        retry:write(key, latest)
        retry:commit()
    end
    emit("race", "collection2", firstOk, firstRevision, secondOk, reason, recovered)
    return recovered, firstRevision
end

handlers[21] = function()
    local key = "collection3:3"
    local first = store:begin("contender-a-collection3")
    local second = store:begin("contender-b-collection3")
    local firstRow = first:read(key)
    local secondRow = second:read(key)
    firstRow.balance += 5
    secondRow.balance += 8
    first:write(key, firstRow)
    second:write(key, secondRow)
    local firstOk, firstRevision = first:commit()
    local secondOk, reason = second:commit()
    local recovered = 0
    if not secondOk then
        local retry = store:begin("retry-collection3")
        local latest = retry:read(key)
        if latest.active then
            recovered = 8
        else
            recovered = 4
        end
        latest.balance += recovered
        latest.score += 1
        retry:write(key, latest)
        retry:commit()
    end
    emit("race", "collection3", firstOk, firstRevision, secondOk, reason, recovered)
    return recovered, firstRevision
end

handlers[22] = function()
    local key = "collection4:3"
    local first = store:begin("contender-a-collection4")
    local second = store:begin("contender-b-collection4")
    local firstRow = first:read(key)
    local secondRow = second:read(key)
    firstRow.balance += 6
    secondRow.balance += 9
    first:write(key, firstRow)
    second:write(key, secondRow)
    local firstOk, firstRevision = first:commit()
    local secondOk, reason = second:commit()
    local recovered = 0
    if not secondOk then
        local retry = store:begin("retry-collection4")
        local latest = retry:read(key)
        if latest.active then
            recovered = 9
        else
            recovered = 5
        end
        latest.balance += recovered
        latest.score += 1
        retry:write(key, latest)
        retry:commit()
    end
    emit("race", "collection4", firstOk, firstRevision, secondOk, reason, recovered)
    return recovered, firstRevision
end

handlers[23] = function()
    local key = "collection5:3"
    local first = store:begin("contender-a-collection5")
    local second = store:begin("contender-b-collection5")
    local firstRow = first:read(key)
    local secondRow = second:read(key)
    firstRow.balance += 7
    secondRow.balance += 10
    first:write(key, firstRow)
    second:write(key, secondRow)
    local firstOk, firstRevision = first:commit()
    local secondOk, reason = second:commit()
    local recovered = 0
    if not secondOk then
        local retry = store:begin("retry-collection5")
        local latest = retry:read(key)
        if latest.active then
            recovered = 10
        else
            recovered = 6
        end
        latest.balance += recovered
        latest.score += 1
        retry:write(key, latest)
        retry:commit()
    end
    emit("race", "collection5", firstOk, firstRevision, secondOk, reason, recovered)
    return recovered, firstRevision
end

handlers[24] = function()
    local key = "collection6:3"
    local first = store:begin("contender-a-collection6")
    local second = store:begin("contender-b-collection6")
    local firstRow = first:read(key)
    local secondRow = second:read(key)
    firstRow.balance += 8
    secondRow.balance += 11
    first:write(key, firstRow)
    second:write(key, secondRow)
    local firstOk, firstRevision = first:commit()
    local secondOk, reason = second:commit()
    local recovered = 0
    if not secondOk then
        local retry = store:begin("retry-collection6")
        local latest = retry:read(key)
        if latest.active then
            recovered = 11
        else
            recovered = 7
        end
        latest.balance += recovered
        latest.score += 1
        retry:write(key, latest)
        retry:commit()
    end
    emit("race", "collection6", firstOk, firstRevision, secondOk, reason, recovered)
    return recovered, firstRevision
end

handlers[25] = function()
    local prefix = "collection1:"
    local tx = store:begin("prune-collection1")
    local removed, kept, escrow = 0, 0, 0
    for key, row in store:scan(prefix) do
        local index = tonumber(string.match(key, ":(%d+)$")) or 0
        if index > 3 then
            if (index + seed + 1) % 3 == 0 then
                escrow += row.balance
                tx:remove(key)
                removed += 1
            else
                row.tag = "retained-collection1"
                row.score += mode
                tx:write(key, row)
                kept += 1
            end
        else
            kept += 1
        end
    end
    local vaultKey = prefix .. "vault"
    local vault = rowFor(vaultKey, escrow, "escrow")
    vault.active = removed > 0
    tx:write(vaultKey, vault)
    local ok, revision = tx:commit()
    emit("prune", "collection1", removed, kept, escrow, ok, revision)
    return escrow, removed
end

handlers[26] = function()
    local prefix = "collection2:"
    local tx = store:begin("prune-collection2")
    local removed, kept, escrow = 0, 0, 0
    for key, row in store:scan(prefix) do
        local index = tonumber(string.match(key, ":(%d+)$")) or 0
        if index > 3 then
            if (index + seed + 2) % 3 == 0 then
                escrow += row.balance
                tx:remove(key)
                removed += 1
            else
                row.tag = "retained-collection2"
                row.score += mode
                tx:write(key, row)
                kept += 1
            end
        else
            kept += 1
        end
    end
    local vaultKey = prefix .. "vault"
    local vault = rowFor(vaultKey, escrow, "escrow")
    vault.active = removed > 0
    tx:write(vaultKey, vault)
    local ok, revision = tx:commit()
    emit("prune", "collection2", removed, kept, escrow, ok, revision)
    return escrow, removed
end

handlers[27] = function()
    local prefix = "collection3:"
    local tx = store:begin("prune-collection3")
    local removed, kept, escrow = 0, 0, 0
    for key, row in store:scan(prefix) do
        local index = tonumber(string.match(key, ":(%d+)$")) or 0
        if index > 3 then
            if (index + seed + 3) % 3 == 0 then
                escrow += row.balance
                tx:remove(key)
                removed += 1
            else
                row.tag = "retained-collection3"
                row.score += mode
                tx:write(key, row)
                kept += 1
            end
        else
            kept += 1
        end
    end
    local vaultKey = prefix .. "vault"
    local vault = rowFor(vaultKey, escrow, "escrow")
    vault.active = removed > 0
    tx:write(vaultKey, vault)
    local ok, revision = tx:commit()
    emit("prune", "collection3", removed, kept, escrow, ok, revision)
    return escrow, removed
end

handlers[28] = function()
    local prefix = "collection4:"
    local tx = store:begin("prune-collection4")
    local removed, kept, escrow = 0, 0, 0
    for key, row in store:scan(prefix) do
        local index = tonumber(string.match(key, ":(%d+)$")) or 0
        if index > 3 then
            if (index + seed + 4) % 3 == 0 then
                escrow += row.balance
                tx:remove(key)
                removed += 1
            else
                row.tag = "retained-collection4"
                row.score += mode
                tx:write(key, row)
                kept += 1
            end
        else
            kept += 1
        end
    end
    local vaultKey = prefix .. "vault"
    local vault = rowFor(vaultKey, escrow, "escrow")
    vault.active = removed > 0
    tx:write(vaultKey, vault)
    local ok, revision = tx:commit()
    emit("prune", "collection4", removed, kept, escrow, ok, revision)
    return escrow, removed
end

handlers[29] = function()
    local prefix = "collection5:"
    local tx = store:begin("prune-collection5")
    local removed, kept, escrow = 0, 0, 0
    for key, row in store:scan(prefix) do
        local index = tonumber(string.match(key, ":(%d+)$")) or 0
        if index > 3 then
            if (index + seed + 5) % 3 == 0 then
                escrow += row.balance
                tx:remove(key)
                removed += 1
            else
                row.tag = "retained-collection5"
                row.score += mode
                tx:write(key, row)
                kept += 1
            end
        else
            kept += 1
        end
    end
    local vaultKey = prefix .. "vault"
    local vault = rowFor(vaultKey, escrow, "escrow")
    vault.active = removed > 0
    tx:write(vaultKey, vault)
    local ok, revision = tx:commit()
    emit("prune", "collection5", removed, kept, escrow, ok, revision)
    return escrow, removed
end

handlers[30] = function()
    local prefix = "collection6:"
    local tx = store:begin("prune-collection6")
    local removed, kept, escrow = 0, 0, 0
    for key, row in store:scan(prefix) do
        local index = tonumber(string.match(key, ":(%d+)$")) or 0
        if index > 3 then
            if (index + seed + 6) % 3 == 0 then
                escrow += row.balance
                tx:remove(key)
                removed += 1
            else
                row.tag = "retained-collection6"
                row.score += mode
                tx:write(key, row)
                kept += 1
            end
        else
            kept += 1
        end
    end
    local vaultKey = prefix .. "vault"
    local vault = rowFor(vaultKey, escrow, "escrow")
    vault.active = removed > 0
    tx:write(vaultKey, vault)
    local ok, revision = tx:commit()
    emit("prune", "collection6", removed, kept, escrow, ok, revision)
    return escrow, removed
end

handlers[31] = function()
    local prefix = "collection1:"
    local index = {}
    local count, total = 0, 0
    for key, row in store:scan(prefix) do
        local band = math.floor(row.balance / 11)
        local bucket = index[band]
        if not bucket then
            bucket = {keys = {}, sum = 0, active = 0}
            index[band] = bucket
        end
        bucket.keys[#bucket.keys + 1] = key
        bucket.sum += row.balance
        if row.active then
            bucket.active += 1
        end
        count += 1
        total += row.balance
    end
    store.indexes["collection1"] = index
    local bands = {}
    for band in pairs(index) do bands[#bands + 1] = band end
    table.sort(bands)
    for _, band in ipairs(bands) do
        local bucket = index[band]
        emit("index", "collection1", band, #bucket.keys, bucket.sum, bucket.active)
    end
    emit("indexed", "collection1", count, total)
    return count, total
end

handlers[32] = function()
    local prefix = "collection2:"
    local index = {}
    local count, total = 0, 0
    for key, row in store:scan(prefix) do
        local band = math.floor(row.balance / 12)
        local bucket = index[band]
        if not bucket then
            bucket = {keys = {}, sum = 0, active = 0}
            index[band] = bucket
        end
        bucket.keys[#bucket.keys + 1] = key
        bucket.sum += row.balance
        if row.active then
            bucket.active += 1
        end
        count += 1
        total += row.balance
    end
    store.indexes["collection2"] = index
    local bands = {}
    for band in pairs(index) do bands[#bands + 1] = band end
    table.sort(bands)
    for _, band in ipairs(bands) do
        local bucket = index[band]
        emit("index", "collection2", band, #bucket.keys, bucket.sum, bucket.active)
    end
    emit("indexed", "collection2", count, total)
    return count, total
end

handlers[33] = function()
    local prefix = "collection3:"
    local index = {}
    local count, total = 0, 0
    for key, row in store:scan(prefix) do
        local band = math.floor(row.balance / 13)
        local bucket = index[band]
        if not bucket then
            bucket = {keys = {}, sum = 0, active = 0}
            index[band] = bucket
        end
        bucket.keys[#bucket.keys + 1] = key
        bucket.sum += row.balance
        if row.active then
            bucket.active += 1
        end
        count += 1
        total += row.balance
    end
    store.indexes["collection3"] = index
    local bands = {}
    for band in pairs(index) do bands[#bands + 1] = band end
    table.sort(bands)
    for _, band in ipairs(bands) do
        local bucket = index[band]
        emit("index", "collection3", band, #bucket.keys, bucket.sum, bucket.active)
    end
    emit("indexed", "collection3", count, total)
    return count, total
end

handlers[34] = function()
    local prefix = "collection4:"
    local index = {}
    local count, total = 0, 0
    for key, row in store:scan(prefix) do
        local band = math.floor(row.balance / 14)
        local bucket = index[band]
        if not bucket then
            bucket = {keys = {}, sum = 0, active = 0}
            index[band] = bucket
        end
        bucket.keys[#bucket.keys + 1] = key
        bucket.sum += row.balance
        if row.active then
            bucket.active += 1
        end
        count += 1
        total += row.balance
    end
    store.indexes["collection4"] = index
    local bands = {}
    for band in pairs(index) do bands[#bands + 1] = band end
    table.sort(bands)
    for _, band in ipairs(bands) do
        local bucket = index[band]
        emit("index", "collection4", band, #bucket.keys, bucket.sum, bucket.active)
    end
    emit("indexed", "collection4", count, total)
    return count, total
end

handlers[35] = function()
    local prefix = "collection5:"
    local index = {}
    local count, total = 0, 0
    for key, row in store:scan(prefix) do
        local band = math.floor(row.balance / 15)
        local bucket = index[band]
        if not bucket then
            bucket = {keys = {}, sum = 0, active = 0}
            index[band] = bucket
        end
        bucket.keys[#bucket.keys + 1] = key
        bucket.sum += row.balance
        if row.active then
            bucket.active += 1
        end
        count += 1
        total += row.balance
    end
    store.indexes["collection5"] = index
    local bands = {}
    for band in pairs(index) do bands[#bands + 1] = band end
    table.sort(bands)
    for _, band in ipairs(bands) do
        local bucket = index[band]
        emit("index", "collection5", band, #bucket.keys, bucket.sum, bucket.active)
    end
    emit("indexed", "collection5", count, total)
    return count, total
end

handlers[36] = function()
    local prefix = "collection6:"
    local index = {}
    local count, total = 0, 0
    for key, row in store:scan(prefix) do
        local band = math.floor(row.balance / 16)
        local bucket = index[band]
        if not bucket then
            bucket = {keys = {}, sum = 0, active = 0}
            index[band] = bucket
        end
        bucket.keys[#bucket.keys + 1] = key
        bucket.sum += row.balance
        if row.active then
            bucket.active += 1
        end
        count += 1
        total += row.balance
    end
    store.indexes["collection6"] = index
    local bands = {}
    for band in pairs(index) do bands[#bands + 1] = band end
    table.sort(bands)
    for _, band in ipairs(bands) do
        local bucket = index[band]
        emit("index", "collection6", band, #bucket.keys, bucket.sum, bucket.active)
    end
    emit("indexed", "collection6", count, total)
    return count, total
end

handlers[37] = function()
    local key = "collection1:1"
    local before = store.rows[key].balance
    local tx = store:begin("invalid-collection1")
    local row = tx:read(key)
    row.balance = -1
    tx:write(key, row)
    local accepted, reason = tx:commit()
    local after = store.rows[key].balance
    assert(not accepted and before == after, "atomic-rejection")
    local nested = store:begin("savepoint-collection1")
    local current = nested:read(key)
    current.score += 1
    nested:write(key, current)
    local mark = nested:mark()
    current.balance += math.abs(seed) + 1
    nested:write(key, current)
    if mode % 2 == 0 then
        nested:restore(mark)
    else
        current.tag = "promoted-collection1"
        nested:write(key, current)
    end
    local ok, revision = nested:commit()
    local closedOk, closedError = pcall(function() error("closed-collection1", 0) end)
    emit("invalid", "collection1", accepted, reason, ok, revision, closedOk, closedError)
    return before, after
end

handlers[38] = function()
    local key = "collection2:1"
    local before = store.rows[key].balance
    local tx = store:begin("invalid-collection2")
    local row = tx:read(key)
    row.balance = -2
    tx:write(key, row)
    local accepted, reason = tx:commit()
    local after = store.rows[key].balance
    assert(not accepted and before == after, "atomic-rejection")
    local nested = store:begin("savepoint-collection2")
    local current = nested:read(key)
    current.score += 2
    nested:write(key, current)
    local mark = nested:mark()
    current.balance += math.abs(seed) + 1
    nested:write(key, current)
    if mode % 2 == 0 then
        nested:restore(mark)
    else
        current.tag = "promoted-collection2"
        nested:write(key, current)
    end
    local ok, revision = nested:commit()
    local closedOk, closedError = pcall(function() error("closed-collection2", 0) end)
    emit("invalid", "collection2", accepted, reason, ok, revision, closedOk, closedError)
    return before, after
end

handlers[39] = function()
    local key = "collection3:1"
    local before = store.rows[key].balance
    local tx = store:begin("invalid-collection3")
    local row = tx:read(key)
    row.balance = -3
    tx:write(key, row)
    local accepted, reason = tx:commit()
    local after = store.rows[key].balance
    assert(not accepted and before == after, "atomic-rejection")
    local nested = store:begin("savepoint-collection3")
    local current = nested:read(key)
    current.score += 3
    nested:write(key, current)
    local mark = nested:mark()
    current.balance += math.abs(seed) + 1
    nested:write(key, current)
    if mode % 2 == 0 then
        nested:restore(mark)
    else
        current.tag = "promoted-collection3"
        nested:write(key, current)
    end
    local ok, revision = nested:commit()
    local closedOk, closedError = pcall(function() error("closed-collection3", 0) end)
    emit("invalid", "collection3", accepted, reason, ok, revision, closedOk, closedError)
    return before, after
end

handlers[40] = function()
    local key = "collection4:1"
    local before = store.rows[key].balance
    local tx = store:begin("invalid-collection4")
    local row = tx:read(key)
    row.balance = -4
    tx:write(key, row)
    local accepted, reason = tx:commit()
    local after = store.rows[key].balance
    assert(not accepted and before == after, "atomic-rejection")
    local nested = store:begin("savepoint-collection4")
    local current = nested:read(key)
    current.score += 4
    nested:write(key, current)
    local mark = nested:mark()
    current.balance += math.abs(seed) + 1
    nested:write(key, current)
    if mode % 2 == 0 then
        nested:restore(mark)
    else
        current.tag = "promoted-collection4"
        nested:write(key, current)
    end
    local ok, revision = nested:commit()
    local closedOk, closedError = pcall(function() error("closed-collection4", 0) end)
    emit("invalid", "collection4", accepted, reason, ok, revision, closedOk, closedError)
    return before, after
end

handlers[41] = function()
    local key = "collection5:1"
    local before = store.rows[key].balance
    local tx = store:begin("invalid-collection5")
    local row = tx:read(key)
    row.balance = -5
    tx:write(key, row)
    local accepted, reason = tx:commit()
    local after = store.rows[key].balance
    assert(not accepted and before == after, "atomic-rejection")
    local nested = store:begin("savepoint-collection5")
    local current = nested:read(key)
    current.score += 5
    nested:write(key, current)
    local mark = nested:mark()
    current.balance += math.abs(seed) + 1
    nested:write(key, current)
    if mode % 2 == 0 then
        nested:restore(mark)
    else
        current.tag = "promoted-collection5"
        nested:write(key, current)
    end
    local ok, revision = nested:commit()
    local closedOk, closedError = pcall(function() error("closed-collection5", 0) end)
    emit("invalid", "collection5", accepted, reason, ok, revision, closedOk, closedError)
    return before, after
end

handlers[42] = function()
    local key = "collection6:1"
    local before = store.rows[key].balance
    local tx = store:begin("invalid-collection6")
    local row = tx:read(key)
    row.balance = -6
    tx:write(key, row)
    local accepted, reason = tx:commit()
    local after = store.rows[key].balance
    assert(not accepted and before == after, "atomic-rejection")
    local nested = store:begin("savepoint-collection6")
    local current = nested:read(key)
    current.score += 6
    nested:write(key, current)
    local mark = nested:mark()
    current.balance += math.abs(seed) + 1
    nested:write(key, current)
    if mode % 2 == 0 then
        nested:restore(mark)
    else
        current.tag = "promoted-collection6"
        nested:write(key, current)
    end
    local ok, revision = nested:commit()
    local closedOk, closedError = pcall(function() error("closed-collection6", 0) end)
    emit("invalid", "collection6", accepted, reason, ok, revision, closedOk, closedError)
    return before, after
end

handlers[43] = function()
    local prefix = "collection1:"
    local history = {}
    local net, mutations = 0, 0
    for _, entry in ipairs(store.journal) do
        if string.sub(entry[1], 1, #prefix) == prefix then
            local change = entry[4] - entry[3]
            history[#history + 1] = change
            net += change
            mutations += 1
        end
    end
    local function reduce(left, right)
        if left > right then return 0 end
        if left == right then return history[left] end
        local middle = math.floor((left + right) / 2)
        local a = reduce(left, middle)
        local b = reduce(middle + 1, right)
        return a + b
    end
    local reconstructed = reduce(1, #history)
    local live = store:fold(prefix, function(sum, _, row)
        if row.balance >= 0 then return sum + row.balance end
        error("negative-live-collection1", 0)
    end, 0)
    assert(reconstructed == live and live == net, "journal-replay")
    local checksum = digest(table.concat(history, ","))
    emit("audit", "collection1", mutations, live, checksum)
    return live, checksum
end

handlers[44] = function()
    local prefix = "collection2:"
    local history = {}
    local net, mutations = 0, 0
    for _, entry in ipairs(store.journal) do
        if string.sub(entry[1], 1, #prefix) == prefix then
            local change = entry[4] - entry[3]
            history[#history + 1] = change
            net += change
            mutations += 1
        end
    end
    local function reduce(left, right)
        if left > right then return 0 end
        if left == right then return history[left] end
        local middle = math.floor((left + right) / 2)
        local a = reduce(left, middle)
        local b = reduce(middle + 1, right)
        return a + b
    end
    local reconstructed = reduce(1, #history)
    local live = store:fold(prefix, function(sum, _, row)
        if row.balance >= 0 then return sum + row.balance end
        error("negative-live-collection2", 0)
    end, 0)
    assert(reconstructed == live and live == net, "journal-replay")
    local checksum = digest(table.concat(history, ","))
    emit("audit", "collection2", mutations, live, checksum)
    return live, checksum
end

handlers[45] = function()
    local prefix = "collection3:"
    local history = {}
    local net, mutations = 0, 0
    for _, entry in ipairs(store.journal) do
        if string.sub(entry[1], 1, #prefix) == prefix then
            local change = entry[4] - entry[3]
            history[#history + 1] = change
            net += change
            mutations += 1
        end
    end
    local function reduce(left, right)
        if left > right then return 0 end
        if left == right then return history[left] end
        local middle = math.floor((left + right) / 2)
        local a = reduce(left, middle)
        local b = reduce(middle + 1, right)
        return a + b
    end
    local reconstructed = reduce(1, #history)
    local live = store:fold(prefix, function(sum, _, row)
        if row.balance >= 0 then return sum + row.balance end
        error("negative-live-collection3", 0)
    end, 0)
    assert(reconstructed == live and live == net, "journal-replay")
    local checksum = digest(table.concat(history, ","))
    emit("audit", "collection3", mutations, live, checksum)
    return live, checksum
end

handlers[46] = function()
    local prefix = "collection4:"
    local history = {}
    local net, mutations = 0, 0
    for _, entry in ipairs(store.journal) do
        if string.sub(entry[1], 1, #prefix) == prefix then
            local change = entry[4] - entry[3]
            history[#history + 1] = change
            net += change
            mutations += 1
        end
    end
    local function reduce(left, right)
        if left > right then return 0 end
        if left == right then return history[left] end
        local middle = math.floor((left + right) / 2)
        local a = reduce(left, middle)
        local b = reduce(middle + 1, right)
        return a + b
    end
    local reconstructed = reduce(1, #history)
    local live = store:fold(prefix, function(sum, _, row)
        if row.balance >= 0 then return sum + row.balance end
        error("negative-live-collection4", 0)
    end, 0)
    assert(reconstructed == live and live == net, "journal-replay")
    local checksum = digest(table.concat(history, ","))
    emit("audit", "collection4", mutations, live, checksum)
    return live, checksum
end

handlers[47] = function()
    local prefix = "collection5:"
    local history = {}
    local net, mutations = 0, 0
    for _, entry in ipairs(store.journal) do
        if string.sub(entry[1], 1, #prefix) == prefix then
            local change = entry[4] - entry[3]
            history[#history + 1] = change
            net += change
            mutations += 1
        end
    end
    local function reduce(left, right)
        if left > right then return 0 end
        if left == right then return history[left] end
        local middle = math.floor((left + right) / 2)
        local a = reduce(left, middle)
        local b = reduce(middle + 1, right)
        return a + b
    end
    local reconstructed = reduce(1, #history)
    local live = store:fold(prefix, function(sum, _, row)
        if row.balance >= 0 then return sum + row.balance end
        error("negative-live-collection5", 0)
    end, 0)
    assert(reconstructed == live and live == net, "journal-replay")
    local checksum = digest(table.concat(history, ","))
    emit("audit", "collection5", mutations, live, checksum)
    return live, checksum
end

handlers[48] = function()
    local prefix = "collection6:"
    local history = {}
    local net, mutations = 0, 0
    for _, entry in ipairs(store.journal) do
        if string.sub(entry[1], 1, #prefix) == prefix then
            local change = entry[4] - entry[3]
            history[#history + 1] = change
            net += change
            mutations += 1
        end
    end
    local function reduce(left, right)
        if left > right then return 0 end
        if left == right then return history[left] end
        local middle = math.floor((left + right) / 2)
        local a = reduce(left, middle)
        local b = reduce(middle + 1, right)
        return a + b
    end
    local reconstructed = reduce(1, #history)
    local live = store:fold(prefix, function(sum, _, row)
        if row.balance >= 0 then return sum + row.balance end
        error("negative-live-collection6", 0)
    end, 0)
    assert(reconstructed == live and live == net, "journal-replay")
    local checksum = digest(table.concat(history, ","))
    emit("audit", "collection6", mutations, live, checksum)
    return live, checksum
end

local results = {}
for index, handler in ipairs(handlers) do
    local first, second = handler()
    results[#results + 1] = tostring(first) .. "/" .. tostring(second)
    emit("operation", index, first, second)
end
local liveCount, liveBalance = 0, 0
for key, row in store:scan("") do
    liveCount += 1
    liveBalance += row.balance
    emit("row", key, row.balance, row.version, row.active, row.tag, row.score)
end
assert(liveBalance == watchTotal, "watcher-reconciliation")
emit("final", store.revision, liveCount, liveBalance, watchCount, digest(table.concat(results, "|")))
print(table.concat(trace, "\n"))
