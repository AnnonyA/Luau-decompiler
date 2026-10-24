#!/usr/bin/env node
// Original benchmark sources. This generator owns only the development split.
// Each program has an independently authored runtime and eight operation families.
// Six specializations per family model separate collections, task domains, or services.
// Generation is intentional and disclosed; cases are not transformed corpus samples.
import {mkdirSync, writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, resolve} from 'node:path';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const destination = resolve(root, 'benchmarks/large/development');
mkdirSync(destination, {recursive:true});
const header = name => `-- Original generated development benchmark: ${name}.
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
`;
const storeCore = `
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
`;
const storeFamilies = [
(c,n) => `local prefix = "${n}:"
local tx = store:begin("populate-${n}")
local inserted, skipped = 0, 0
for index = 1, ${c+4} do
    local key = prefix .. tostring(index)
    local existing = tx:read(key)
    if existing then
        skipped += 1
    else
        local balance = math.abs(seed * ${c+2} + index * 11) % 90 + 25
        local row = rowFor(key, balance, "${n}")
        if (index + mode) % 2 == 0 then
            row.score = index * ${c}
        else
            row.active = index % 3 ~= 0
            row.score = -index
        end
        tx:write(key, row)
        inserted += 1
    end
end
local ok, revision = tx:commit()
emit("populate", "${n}", inserted, skipped, ok, revision)
local total = store:fold(prefix, function(sum, _, row) return sum + row.balance end, 0)
emit("population-total", "${n}", total)
return total, inserted`,
(c,n) => `local prefix = "${n}:"
local tx = store:begin("rebalance-${n}")
local touched, delta = 0, 0
for key, row in store:scan(prefix) do
    local before = row.balance
    if row.active then
        if row.balance > 70 + ${c} then
            row.balance -= ${c+3}
            row.score += 2
        else
            row.balance += ${c+1}
            row.score += 1
        end
    elseif mode % 2 == 0 then
        row.active = true
        row.balance += ${c}
    else
        row.score -= ${c}
    end
    delta += row.balance - before
    touched += 1
    tx:write(key, row)
end
local ok, revision = tx:commit()
emit("rebalance", "${n}", touched, delta, ok, revision)
return delta, touched`,
(c,n) => `local prefix = "${n}:"
local sourceKey = prefix .. "1"
local targetKey = prefix .. "2"
local tx = store:begin("transfer-${n}")
local source, sourceVersion = tx:read(sourceKey)
local target, targetVersion = tx:read(targetKey)
local requested = math.abs(seed + mode * ${c+1}) % 50 + 1
local amount = math.min(source.balance, requested)
local mark = tx:mark()
source.balance -= amount
target.balance += amount
source.score += ${c}
target.score -= ${c}
tx:write(sourceKey, source)
tx:write(targetKey, target)
if (seed + mode + ${c}) % 3 == 0 then
    tx:restore(mark)
    amount = 0
else
    if target.balance > 110 then
        target.tag = "overflow-${n}"
        tx:write(targetKey, target)
    end
end
local ok, revision = tx:commit()
emit("transfer", "${n}", amount, sourceVersion, targetVersion, ok, revision)
return amount, revision`,
(c,n) => `local key = "${n}:3"
local first = store:begin("contender-a-${n}")
local second = store:begin("contender-b-${n}")
local firstRow = first:read(key)
local secondRow = second:read(key)
firstRow.balance += ${c+2}
secondRow.balance += ${c+5}
first:write(key, firstRow)
second:write(key, secondRow)
local firstOk, firstRevision = first:commit()
local secondOk, reason = second:commit()
local recovered = 0
if not secondOk then
    local retry = store:begin("retry-${n}")
    local latest = retry:read(key)
    if latest.active then
        recovered = ${c+5}
    else
        recovered = ${c+1}
    end
    latest.balance += recovered
    latest.score += 1
    retry:write(key, latest)
    retry:commit()
end
emit("race", "${n}", firstOk, firstRevision, secondOk, reason, recovered)
return recovered, firstRevision`,
(c,n) => `local prefix = "${n}:"
local tx = store:begin("prune-${n}")
local removed, kept, escrow = 0, 0, 0
for key, row in store:scan(prefix) do
    local index = tonumber(string.match(key, ":(%d+)$")) or 0
    if index > 3 then
        if (index + seed + ${c}) % 3 == 0 then
            escrow += row.balance
            tx:remove(key)
            removed += 1
        else
            row.tag = "retained-${n}"
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
emit("prune", "${n}", removed, kept, escrow, ok, revision)
return escrow, removed`,
(c,n) => `local prefix = "${n}:"
local index = {}
local count, total = 0, 0
for key, row in store:scan(prefix) do
    local band = math.floor(row.balance / ${c+10})
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
store.indexes["${n}"] = index
local bands = {}
for band in pairs(index) do bands[#bands + 1] = band end
table.sort(bands)
for _, band in ipairs(bands) do
    local bucket = index[band]
    emit("index", "${n}", band, #bucket.keys, bucket.sum, bucket.active)
end
emit("indexed", "${n}", count, total)
return count, total`,
(c,n) => `local key = "${n}:1"
local before = store.rows[key].balance
local tx = store:begin("invalid-${n}")
local row = tx:read(key)
row.balance = -${c}
tx:write(key, row)
local accepted, reason = tx:commit()
local after = store.rows[key].balance
assert(not accepted and before == after, "atomic-rejection")
local nested = store:begin("savepoint-${n}")
local current = nested:read(key)
current.score += ${c}
nested:write(key, current)
local mark = nested:mark()
current.balance += math.abs(seed) + 1
nested:write(key, current)
if mode % 2 == 0 then
    nested:restore(mark)
else
    current.tag = "promoted-${n}"
    nested:write(key, current)
end
local ok, revision = nested:commit()
local closedOk, closedError = pcall(function() error("closed-${n}", 0) end)
emit("invalid", "${n}", accepted, reason, ok, revision, closedOk, closedError)
return before, after`,
(c,n) => `local prefix = "${n}:"
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
    error("negative-live-${n}", 0)
end, 0)
assert(reconstructed == live and live == net, "journal-replay")
local checksum = digest(table.concat(history, ","))
emit("audit", "${n}", mutations, live, checksum)
return live, checksum`
];
let transaction = header('transaction-store') + storeCore;
for (let family=0;family<8;family++) for(let c=1;c<=6;c++) transaction += `\nhandlers[${family*6+c}] = function()\n${storeFamilies[family](c,`collection${c}`).split('\n').map(x=>'    '+x).join('\n')}\nend\n`;
transaction += `
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
print(table.concat(trace, "\\n"))
`;
writeFileSync(resolve(destination,'transaction-store.luau'), transaction);
const workflowCore = `
local Scheduler = {}
Scheduler.__index = Scheduler
local function earlier(a, b)
    if a.ready ~= b.ready then return a.ready < b.ready end
    if a.priority ~= b.priority then return a.priority > b.priority end
    return a.sequence < b.sequence
end
function Scheduler.new()
    return setmetatable({heap = {}, jobs = {}, order = {}, clock = 0, sequence = 0, completed = 0, failed = 0, events = {}, observers = {}}, Scheduler)
end
function Scheduler:push(job, delay)
    self.sequence += 1
    job.ready = self.clock + delay
    job.sequence = self.sequence
    job.state = "queued"
    local heap = self.heap
    heap[#heap + 1] = job
    local position = #heap
    while position > 1 do
        local parent = math.floor(position / 2)
        if not earlier(heap[position], heap[parent]) then break end
        heap[position], heap[parent] = heap[parent], heap[position]
        position = parent
    end
end
function Scheduler:pop()
    local heap = self.heap
    local first = heap[1]
    local last = table.remove(heap)
    if #heap > 0 then
        heap[1] = last
        local position = 1
        while true do
            local left = position * 2
            if left > #heap then break end
            local right = left + 1
            local child = left
            if right <= #heap and earlier(heap[right], heap[left]) then
                child = right
            end
            if not earlier(heap[child], heap[position]) then break end
            heap[position], heap[child] = heap[child], heap[position]
            position = child
        end
    end
    return first
end
function Scheduler:add(id, dependencies, priority, callback)
    assert(not self.jobs[id], "duplicate-job")
    local job = {id = id, dependencies = dependencies, priority = priority, callback = callback, state = "waiting", attempts = 0, limit = 3, output = nil}
    self.jobs[id] = job
    self.order[#self.order + 1] = id
    return job
end
function Scheduler:notify(kind, job, payload)
    self.events[#self.events + 1] = {kind, job.id, self.clock}
    for _, observer in ipairs(self.observers) do
        observer(kind, job, payload, self.clock)
    end
end
function Scheduler:release()
    local released = 0
    for _, id in ipairs(self.order) do
        local job = self.jobs[id]
        if job.state == "waiting" then
            local ready, blocked = true, false
            for _, dependency in ipairs(job.dependencies) do
                local prerequisite = assert(self.jobs[dependency], "unknown-dependency")
                if prerequisite.state == "failed" or prerequisite.state == "cancelled" then
                    blocked = true
                elseif prerequisite.state ~= "done" then
                    ready = false
                end
            end
            if blocked then
                job.state = "cancelled"
                self:notify("cancelled", job, "dependency")
            elseif ready then
                self:push(job, (job.priority + mode) % 3)
                released += 1
            end
        end
    end
    return released
end
function Scheduler:context(job)
    local buffered = {}
    local committed = false
    local scheduler = self
    local context = {attempt = job.attempts, clock = self.clock, id = job.id}
    function context:get(id)
        local dependency = assert(scheduler.jobs[id], "missing-job")
        assert(dependency.state == "done", "premature-result")
        return dependency.output, dependency.attempts
    end
    function context:emit(...)
        local values = {}
        for i = 1, select("#", ...) do values[i] = tostring(select(i, ...)) end
        buffered[#buffered + 1] = table.concat(values, "/")
    end
    function context:commit()
        assert(not committed, "duplicate-context-commit")
        committed = true
        for _, value in ipairs(buffered) do emit("effect", job.id, value) end
        return #buffered
    end
    return context
end
function Scheduler:run()
    self:release()
    local steps = 0
    while #self.heap > 0 do
        local job = self:pop()
        self.clock = math.max(self.clock, job.ready)
        job.state = "running"
        job.attempts += 1
        steps += 1
        assert(steps < 500, "scheduler-livelock")
        local context = self:context(job)
        self:notify("start", job, job.attempts)
        local ok, output, detail = pcall(job.callback, context)
        if ok then
            job.output = output
            job.detail = detail
            job.effects = context:commit()
            job.state = "done"
            self.completed += 1
            self:notify("done", job, detail)
        elseif job.attempts < job.limit then
            self:notify("retry", job, output)
            self:push(job, job.attempts * 2 + 1)
        else
            job.state = "failed"
            self.failed += 1
            job.error = output
            self:notify("failed", job, output)
        end
        self:release()
    end
    for _, id in ipairs(self.order) do
        assert(self.jobs[id].state ~= "waiting", "dependency-cycle")
    end
    return steps, self.clock
end
local scheduler = Scheduler.new()
local observationCount = 0
scheduler.observers[1] = function(kind, job, payload, clock)
    observationCount += 1
    emit("event", kind, job.id, payload, clock)
end
local callbacks = {}
local function copyArray(values)
    local result = {}
    for i, value in ipairs(values) do result[i] = value end
    return result
end
local function chunks(values, size)
    local offset = 1
    return function()
        if offset > #values then return nil end
        local result = {}
        local start = offset
        for _ = 1, size do
            if offset > #values then break end
            result[#result + 1] = values[offset]
            offset += 1
        end
        return start, result
    end
end
`;
const workflowFamilies = [
(c,n) => `local records, accepted, rejected = {}, 0, 0
local text = ""
for index = 1, ${c+7} do
    local value = (seed * ${c+1} + index * 13) % 101 - 20
    if index > 1 then text ..= "," end
    if (index + mode + ${c}) % 5 == 0 then
        text ..= "invalid"
    else
        text ..= tostring(value)
    end
end
for token in string.gmatch(text, "[^,]+") do
    local value = tonumber(token)
    if value then
        accepted += 1
        records[#records + 1] = value
        context:emit("accepted", accepted, value)
    else
        rejected += 1
        context:emit("rejected", token, rejected)
    end
end
local checksum = digest(text)
assert(accepted + rejected == ${c+7}, "input-accounting")
context:emit("ingest", "${n}", checksum, accepted, rejected)
return {values = records, rejected = rejected, checksum = checksum}, accepted`,
(c,n) => `local input, attempts = context:get("${n}-1")
local values = copyArray(input.values)
local minimum, maximum = 100000, -100000
local changes, total = 0, 0
for index, value in ipairs(values) do
    local normalized = value
    if value < 0 then
        normalized = -value + ${c}
        changes += 1
    elseif value > ${c+60} then
        normalized = ${c+60}
        changes += 1
    else
        normalized += mode % 3
    end
    values[index] = normalized
    minimum = math.min(minimum, normalized)
    maximum = math.max(maximum, normalized)
    total += normalized
    if (index + ${c}) % 3 == 0 then
        context:emit("normalized", index, value, normalized)
    end
end
assert(#values > 0 and minimum <= maximum, "empty-normalization")
context:emit("normalize", "${n}", changes, total, attempts)
return {values = values, minimum = minimum, maximum = maximum, rejected = input.rejected}, changes`,
(c,n) => `local input = context:get("${n}-2")
local groups, coverage = {}, 0
for offset, batch in chunks(input.values, ${c%3+2}) do
    local sum, weighted = 0, 0
    local transformed = {}
    for index, value in ipairs(batch) do
        local adjusted = value + offset
        if (value + mode) % 2 == 0 then
            adjusted += ${c}
        else
            adjusted = math.max(0, adjusted - ${c})
        end
        transformed[index] = adjusted
        sum += adjusted
        weighted += adjusted * index
        coverage += 1
    end
    groups[#groups + 1] = {offset = offset, values = transformed, sum = sum, weighted = weighted}
    context:emit("chunk", offset, #batch, sum, weighted)
end
local last = groups[#groups]
assert(coverage == #input.values, "chunk-coverage")
assert(last.offset + #last.values - 1 == coverage, "chunk-boundary")
local tag = "${n}/" .. tostring(#groups)
context:emit("partition", tag, coverage, input.rejected)
return {groups = groups, count = coverage, rejected = input.rejected}, #groups`,
(c,n) => `local input = context:get("${n}-3")
local function merge(left, right)
    if left > right then return {sum = 0, weighted = 0, count = 0} end
    if left == right then
        local group = input.groups[left]
        return {sum = group.sum, weighted = group.weighted, count = #group.values}
    end
    local middle = math.floor((left + right) / 2)
    local a = merge(left, middle)
    local b = merge(middle + 1, right)
    context:emit("merge", left, right, a.count + b.count)
    return {sum = a.sum + b.sum, weighted = a.weighted + b.weighted, count = a.count + b.count}
end
local result = merge(1, #input.groups)
local mean = math.floor(result.sum / math.max(1, result.count))
local quality = "ordinary"
if mean >= ${c+40} then
    quality = "high"
elseif input.rejected > 2 then
    quality = "partial"
end
result.mean = mean
result.quality = quality
result.rejected = input.rejected
assert(result.count == input.count, "aggregate-count")
context:emit("aggregate", "${n}", result.sum, mean, quality)
return result, mean`,
(c,n) => `local input = context:get("${n}-4")
local fields = {input.sum, input.weighted, input.count, input.mean, input.rejected}
local encoded = table.concat(fields, "|") .. "|" .. input.quality
local decoded = {}
for token in string.gmatch(encoded, "[^|]+") do
    decoded[#decoded + 1] = token
end
local checksum = digest(encoded)
local valid = #decoded == 6
for index = 1, 5 do
    local value = tonumber(decoded[index])
    if value ~= fields[index] then
        valid = false
        context:emit("mismatch", index, value, fields[index])
    elseif index % 2 == 0 then
        context:emit("field", index, value)
    end
end
assert(valid, "checkpoint-roundtrip")
local checkpoint = {encoded = encoded, checksum = checksum, count = input.count, quality = input.quality}
if (checksum + mode) % 2 == 0 then
    checkpoint.storage = "primary-${n}"
else
    checkpoint.storage = "replica-${n}"
end
context:emit("checkpoint", checkpoint.storage, checksum, #encoded)
return checkpoint, checksum`,
(c,n) => `local checkpoint = context:get("${n}-5")
local transient = (seed + mode + ${c}) % 3 == 0
local remaining = ${c%2+1} - context.attempt
context:emit("delivery-attempt", context.attempt, checkpoint.checksum)
if transient and remaining >= 0 then
    error("transient-${n}-" .. tostring(context.attempt), 0)
end
local receipts = {}
local total = 0
for replica = 1, ${c%3+2} do
    local token = digest(checkpoint.encoded .. ":" .. tostring(replica))
    local accepted = (token + mode) % 4 ~= 0
    if accepted then
        receipts[#receipts + 1] = token
        total += token
        context:emit("replica-ack", replica, token)
    else
        context:emit("replica-skip", replica, token)
    end
end
if #receipts == 0 then
    receipts[1] = checkpoint.checksum
    total = checkpoint.checksum
    context:emit("fallback", total)
end
context:emit("delivery", "${n}", #receipts, total, context.attempt)
return {receipts = receipts, total = total, checksum = checkpoint.checksum}, #receipts`,
(c,n) => `local delivered, attempts = context:get("${n}-6")
local checkpoint = context:get("${n}-5")
local unique, sorted = {}, {}
for _, receipt in ipairs(delivered.receipts) do
    if not unique[receipt] then
        unique[receipt] = true
        sorted[#sorted + 1] = receipt
    end
end
table.sort(sorted)
local manifest, sum = {}, 0
for index, receipt in ipairs(sorted) do
    manifest[#manifest + 1] = tostring(index) .. "=" .. tostring(receipt)
    sum += receipt
    if receipt % 2 == 0 then
        context:emit("publish-even", index, receipt)
    else
        context:emit("publish-odd", index, receipt)
    end
end
local text = table.concat(manifest, ";")
assert(sum == delivered.total, "duplicate-receipt")
local publication = {text = text, checksum = digest(text), source = checkpoint.checksum, count = #sorted}
publication.retryCost = attempts - 1
context:emit("publish", "${n}", publication.checksum, publication.retryCost, #text)
return publication, publication.checksum`,
(c,n) => `local publication = context:get("${n}-7")
local aggregate = context:get("${n}-4")
local checkpoint = context:get("${n}-5")
local parsed, sum = 0, 0
for position, receipt in string.gmatch(publication.text, "(%d+)=(%d+)") do
    parsed += 1
    assert(tonumber(position) == parsed, "manifest-order")
    sum += tonumber(receipt)
end
local delivered = context:get("${n}-6")
assert(sum == delivered.total and parsed == publication.count, "manifest-reconcile")
assert(checkpoint.checksum == publication.source, "source-reconcile")
local score = aggregate.sum - aggregate.rejected * ${c}
if publication.retryCost > 0 then
    score -= publication.retryCost * ${c+1}
    context:emit("retry-penalty", publication.retryCost, score)
else
    score += parsed
    context:emit("clean-bonus", parsed, score)
end
local status = score >= ${c*30} and "accepted" or "review"
local report = {score = score, status = status, digest = publication.checksum, count = aggregate.count}
local errorOk, expected = pcall(function() error("audit-${n}", 0) end)
assert(not errorOk and expected == "audit-${n}", "expected-error")
context:emit("reconcile", "${n}", status, score, report.count, expected)
return report, score`
];
let workflow = header('workflow-scheduler') + workflowCore;
for(let family=0;family<8;family++) for(let c=1;c<=6;c++) workflow += `\ncallbacks["domain${c}-${family+1}"] = function(context)\n${workflowFamilies[family](c,`domain${c}`).split('\n').map(x=>'    '+x).join('\n')}\nend\n`;
workflow += `
for phase = 1, 8 do
    for domain = 1, 6 do
        local id = "domain" .. tostring(domain) .. "-" .. tostring(phase)
        local dependencies = {}
        if phase > 1 then dependencies[1] = "domain" .. tostring(domain) .. "-" .. tostring(phase - 1) end
        scheduler:add(id, dependencies, (domain * 3 + phase + mode) % 7, callbacks[id])
    end
end
local steps, clock = scheduler:run()
local score, count = 0, 0
for domain = 1, 6 do
    local job = scheduler.jobs["domain" .. tostring(domain) .. "-8"]
    assert(job.state == "done", "unfinished-domain")
    score += job.output.score
    count += job.output.count
    emit("domain-final", domain, job.output.score, job.output.status, job.output.digest, job.output.count)
end
assert(scheduler.completed == 48 and scheduler.failed == 0, "workflow-completion")
emit("final", steps, clock, scheduler.completed, observationCount, score, count)
print(table.concat(trace, "\\n"))
`;
writeFileSync(resolve(destination,'workflow-scheduler.luau'), workflow);

let protocol = `-- Original generated protocol-router: eight channels, six independent command families.
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
`;
const protocolFamilies = {
  credit: ch => `    local scale = (packet.round + ${ch}) % 4 + 1
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
    emit("credit", ${ch}, before, delta, total)
    return state.balance, total`,
  debit: ch => `    local demand = math.abs(packet.amount) + packet.round
    local before = state.balance
    local remaining = demand
    local accepted = 0
    while remaining > 0 do
        local step = math.min(remaining, ${ch} + 1)
        if state.balance - step < -20 then break end
        state.balance -= step
        accepted += step
        remaining -= step
    end
    state.values[#state.values + 1] = -accepted
    state.flags.deferred = remaining > 0
    local detail = remaining == 0 and "settled" or "partial"
    emit("debit", ${ch}, before, accepted, remaining)
    return state.balance, detail`,
  route: ch => `    local targetId = (${ch} + packet.round) % 8 + 1
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
    emit("route", ${ch}, targetId, a, b, amount)
    return target.balance, state.balance`,
  scan: ch => `    local sum, count = 0, 0
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
    emit("scan", ${ch}, sum, count, nested)
    return detail, count`,
  amend: ch => `    local old = state.values[#state.values]
    local nextValue = packet.amount % (${ch} + 4)
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
    emit("amend", ${ch}, revised, previous, #history)
    return revised, packet.tag`,
  checkpoint: ch => `    local copy = {}
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
    emit("checkpoint", ${ch}, first, last, version, accepted)
    return accepted, stamp`
};
for (const [family,body] of Object.entries(protocolFamilies)) {
  for (let ch=1;ch<=8;ch++) {
    protocol += `
router:register("${family}-${ch}", function(self, packet, used)
    local state = self.channels[${ch}]
    local identity = "${family}:" .. packet.tag
    local prior = state.seen[identity]
    if prior then
        emit("duplicate", "${family}", ${ch}, prior)
        return state.balance, "duplicate"
    end
    state.seen[identity] = packet.round
    state.revision += 1
    local integrity = checksum(identity)
    state.flags.integrity = integrity
    emit("begin", "${family}", ${ch}, used, state.revision)
${body(ch)}
end)
`;
  }
}
protocol += `
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
`;
writeFileSync(resolve(destination,'protocol-router.luau'), protocol);
