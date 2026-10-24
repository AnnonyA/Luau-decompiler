-- Original generated development benchmark: workflow-scheduler.
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

callbacks["domain1-1"] = function(context)
    local records, accepted, rejected = {}, 0, 0
    local text = ""
    for index = 1, 8 do
        local value = (seed * 2 + index * 13) % 101 - 20
        if index > 1 then text ..= "," end
        if (index + mode + 1) % 5 == 0 then
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
    assert(accepted + rejected == 8, "input-accounting")
    context:emit("ingest", "domain1", checksum, accepted, rejected)
    return {values = records, rejected = rejected, checksum = checksum}, accepted
end

callbacks["domain2-1"] = function(context)
    local records, accepted, rejected = {}, 0, 0
    local text = ""
    for index = 1, 9 do
        local value = (seed * 3 + index * 13) % 101 - 20
        if index > 1 then text ..= "," end
        if (index + mode + 2) % 5 == 0 then
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
    assert(accepted + rejected == 9, "input-accounting")
    context:emit("ingest", "domain2", checksum, accepted, rejected)
    return {values = records, rejected = rejected, checksum = checksum}, accepted
end

callbacks["domain3-1"] = function(context)
    local records, accepted, rejected = {}, 0, 0
    local text = ""
    for index = 1, 10 do
        local value = (seed * 4 + index * 13) % 101 - 20
        if index > 1 then text ..= "," end
        if (index + mode + 3) % 5 == 0 then
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
    assert(accepted + rejected == 10, "input-accounting")
    context:emit("ingest", "domain3", checksum, accepted, rejected)
    return {values = records, rejected = rejected, checksum = checksum}, accepted
end

callbacks["domain4-1"] = function(context)
    local records, accepted, rejected = {}, 0, 0
    local text = ""
    for index = 1, 11 do
        local value = (seed * 5 + index * 13) % 101 - 20
        if index > 1 then text ..= "," end
        if (index + mode + 4) % 5 == 0 then
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
    assert(accepted + rejected == 11, "input-accounting")
    context:emit("ingest", "domain4", checksum, accepted, rejected)
    return {values = records, rejected = rejected, checksum = checksum}, accepted
end

callbacks["domain5-1"] = function(context)
    local records, accepted, rejected = {}, 0, 0
    local text = ""
    for index = 1, 12 do
        local value = (seed * 6 + index * 13) % 101 - 20
        if index > 1 then text ..= "," end
        if (index + mode + 5) % 5 == 0 then
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
    assert(accepted + rejected == 12, "input-accounting")
    context:emit("ingest", "domain5", checksum, accepted, rejected)
    return {values = records, rejected = rejected, checksum = checksum}, accepted
end

callbacks["domain6-1"] = function(context)
    local records, accepted, rejected = {}, 0, 0
    local text = ""
    for index = 1, 13 do
        local value = (seed * 7 + index * 13) % 101 - 20
        if index > 1 then text ..= "," end
        if (index + mode + 6) % 5 == 0 then
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
    assert(accepted + rejected == 13, "input-accounting")
    context:emit("ingest", "domain6", checksum, accepted, rejected)
    return {values = records, rejected = rejected, checksum = checksum}, accepted
end

callbacks["domain1-2"] = function(context)
    local input, attempts = context:get("domain1-1")
    local values = copyArray(input.values)
    local minimum, maximum = 100000, -100000
    local changes, total = 0, 0
    for index, value in ipairs(values) do
        local normalized = value
        if value < 0 then
            normalized = -value + 1
            changes += 1
        elseif value > 61 then
            normalized = 61
            changes += 1
        else
            normalized += mode % 3
        end
        values[index] = normalized
        minimum = math.min(minimum, normalized)
        maximum = math.max(maximum, normalized)
        total += normalized
        if (index + 1) % 3 == 0 then
            context:emit("normalized", index, value, normalized)
        end
    end
    assert(#values > 0 and minimum <= maximum, "empty-normalization")
    context:emit("normalize", "domain1", changes, total, attempts)
    return {values = values, minimum = minimum, maximum = maximum, rejected = input.rejected}, changes
end

callbacks["domain2-2"] = function(context)
    local input, attempts = context:get("domain2-1")
    local values = copyArray(input.values)
    local minimum, maximum = 100000, -100000
    local changes, total = 0, 0
    for index, value in ipairs(values) do
        local normalized = value
        if value < 0 then
            normalized = -value + 2
            changes += 1
        elseif value > 62 then
            normalized = 62
            changes += 1
        else
            normalized += mode % 3
        end
        values[index] = normalized
        minimum = math.min(minimum, normalized)
        maximum = math.max(maximum, normalized)
        total += normalized
        if (index + 2) % 3 == 0 then
            context:emit("normalized", index, value, normalized)
        end
    end
    assert(#values > 0 and minimum <= maximum, "empty-normalization")
    context:emit("normalize", "domain2", changes, total, attempts)
    return {values = values, minimum = minimum, maximum = maximum, rejected = input.rejected}, changes
end

callbacks["domain3-2"] = function(context)
    local input, attempts = context:get("domain3-1")
    local values = copyArray(input.values)
    local minimum, maximum = 100000, -100000
    local changes, total = 0, 0
    for index, value in ipairs(values) do
        local normalized = value
        if value < 0 then
            normalized = -value + 3
            changes += 1
        elseif value > 63 then
            normalized = 63
            changes += 1
        else
            normalized += mode % 3
        end
        values[index] = normalized
        minimum = math.min(minimum, normalized)
        maximum = math.max(maximum, normalized)
        total += normalized
        if (index + 3) % 3 == 0 then
            context:emit("normalized", index, value, normalized)
        end
    end
    assert(#values > 0 and minimum <= maximum, "empty-normalization")
    context:emit("normalize", "domain3", changes, total, attempts)
    return {values = values, minimum = minimum, maximum = maximum, rejected = input.rejected}, changes
end

callbacks["domain4-2"] = function(context)
    local input, attempts = context:get("domain4-1")
    local values = copyArray(input.values)
    local minimum, maximum = 100000, -100000
    local changes, total = 0, 0
    for index, value in ipairs(values) do
        local normalized = value
        if value < 0 then
            normalized = -value + 4
            changes += 1
        elseif value > 64 then
            normalized = 64
            changes += 1
        else
            normalized += mode % 3
        end
        values[index] = normalized
        minimum = math.min(minimum, normalized)
        maximum = math.max(maximum, normalized)
        total += normalized
        if (index + 4) % 3 == 0 then
            context:emit("normalized", index, value, normalized)
        end
    end
    assert(#values > 0 and minimum <= maximum, "empty-normalization")
    context:emit("normalize", "domain4", changes, total, attempts)
    return {values = values, minimum = minimum, maximum = maximum, rejected = input.rejected}, changes
end

callbacks["domain5-2"] = function(context)
    local input, attempts = context:get("domain5-1")
    local values = copyArray(input.values)
    local minimum, maximum = 100000, -100000
    local changes, total = 0, 0
    for index, value in ipairs(values) do
        local normalized = value
        if value < 0 then
            normalized = -value + 5
            changes += 1
        elseif value > 65 then
            normalized = 65
            changes += 1
        else
            normalized += mode % 3
        end
        values[index] = normalized
        minimum = math.min(minimum, normalized)
        maximum = math.max(maximum, normalized)
        total += normalized
        if (index + 5) % 3 == 0 then
            context:emit("normalized", index, value, normalized)
        end
    end
    assert(#values > 0 and minimum <= maximum, "empty-normalization")
    context:emit("normalize", "domain5", changes, total, attempts)
    return {values = values, minimum = minimum, maximum = maximum, rejected = input.rejected}, changes
end

callbacks["domain6-2"] = function(context)
    local input, attempts = context:get("domain6-1")
    local values = copyArray(input.values)
    local minimum, maximum = 100000, -100000
    local changes, total = 0, 0
    for index, value in ipairs(values) do
        local normalized = value
        if value < 0 then
            normalized = -value + 6
            changes += 1
        elseif value > 66 then
            normalized = 66
            changes += 1
        else
            normalized += mode % 3
        end
        values[index] = normalized
        minimum = math.min(minimum, normalized)
        maximum = math.max(maximum, normalized)
        total += normalized
        if (index + 6) % 3 == 0 then
            context:emit("normalized", index, value, normalized)
        end
    end
    assert(#values > 0 and minimum <= maximum, "empty-normalization")
    context:emit("normalize", "domain6", changes, total, attempts)
    return {values = values, minimum = minimum, maximum = maximum, rejected = input.rejected}, changes
end

callbacks["domain1-3"] = function(context)
    local input = context:get("domain1-2")
    local groups, coverage = {}, 0
    for offset, batch in chunks(input.values, 3) do
        local sum, weighted = 0, 0
        local transformed = {}
        for index, value in ipairs(batch) do
            local adjusted = value + offset
            if (value + mode) % 2 == 0 then
                adjusted += 1
            else
                adjusted = math.max(0, adjusted - 1)
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
    local tag = "domain1/" .. tostring(#groups)
    context:emit("partition", tag, coverage, input.rejected)
    return {groups = groups, count = coverage, rejected = input.rejected}, #groups
end

callbacks["domain2-3"] = function(context)
    local input = context:get("domain2-2")
    local groups, coverage = {}, 0
    for offset, batch in chunks(input.values, 4) do
        local sum, weighted = 0, 0
        local transformed = {}
        for index, value in ipairs(batch) do
            local adjusted = value + offset
            if (value + mode) % 2 == 0 then
                adjusted += 2
            else
                adjusted = math.max(0, adjusted - 2)
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
    local tag = "domain2/" .. tostring(#groups)
    context:emit("partition", tag, coverage, input.rejected)
    return {groups = groups, count = coverage, rejected = input.rejected}, #groups
end

callbacks["domain3-3"] = function(context)
    local input = context:get("domain3-2")
    local groups, coverage = {}, 0
    for offset, batch in chunks(input.values, 2) do
        local sum, weighted = 0, 0
        local transformed = {}
        for index, value in ipairs(batch) do
            local adjusted = value + offset
            if (value + mode) % 2 == 0 then
                adjusted += 3
            else
                adjusted = math.max(0, adjusted - 3)
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
    local tag = "domain3/" .. tostring(#groups)
    context:emit("partition", tag, coverage, input.rejected)
    return {groups = groups, count = coverage, rejected = input.rejected}, #groups
end

callbacks["domain4-3"] = function(context)
    local input = context:get("domain4-2")
    local groups, coverage = {}, 0
    for offset, batch in chunks(input.values, 3) do
        local sum, weighted = 0, 0
        local transformed = {}
        for index, value in ipairs(batch) do
            local adjusted = value + offset
            if (value + mode) % 2 == 0 then
                adjusted += 4
            else
                adjusted = math.max(0, adjusted - 4)
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
    local tag = "domain4/" .. tostring(#groups)
    context:emit("partition", tag, coverage, input.rejected)
    return {groups = groups, count = coverage, rejected = input.rejected}, #groups
end

callbacks["domain5-3"] = function(context)
    local input = context:get("domain5-2")
    local groups, coverage = {}, 0
    for offset, batch in chunks(input.values, 4) do
        local sum, weighted = 0, 0
        local transformed = {}
        for index, value in ipairs(batch) do
            local adjusted = value + offset
            if (value + mode) % 2 == 0 then
                adjusted += 5
            else
                adjusted = math.max(0, adjusted - 5)
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
    local tag = "domain5/" .. tostring(#groups)
    context:emit("partition", tag, coverage, input.rejected)
    return {groups = groups, count = coverage, rejected = input.rejected}, #groups
end

callbacks["domain6-3"] = function(context)
    local input = context:get("domain6-2")
    local groups, coverage = {}, 0
    for offset, batch in chunks(input.values, 2) do
        local sum, weighted = 0, 0
        local transformed = {}
        for index, value in ipairs(batch) do
            local adjusted = value + offset
            if (value + mode) % 2 == 0 then
                adjusted += 6
            else
                adjusted = math.max(0, adjusted - 6)
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
    local tag = "domain6/" .. tostring(#groups)
    context:emit("partition", tag, coverage, input.rejected)
    return {groups = groups, count = coverage, rejected = input.rejected}, #groups
end

callbacks["domain1-4"] = function(context)
    local input = context:get("domain1-3")
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
    if mean >= 41 then
        quality = "high"
    elseif input.rejected > 2 then
        quality = "partial"
    end
    result.mean = mean
    result.quality = quality
    result.rejected = input.rejected
    assert(result.count == input.count, "aggregate-count")
    context:emit("aggregate", "domain1", result.sum, mean, quality)
    return result, mean
end

callbacks["domain2-4"] = function(context)
    local input = context:get("domain2-3")
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
    if mean >= 42 then
        quality = "high"
    elseif input.rejected > 2 then
        quality = "partial"
    end
    result.mean = mean
    result.quality = quality
    result.rejected = input.rejected
    assert(result.count == input.count, "aggregate-count")
    context:emit("aggregate", "domain2", result.sum, mean, quality)
    return result, mean
end

callbacks["domain3-4"] = function(context)
    local input = context:get("domain3-3")
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
    if mean >= 43 then
        quality = "high"
    elseif input.rejected > 2 then
        quality = "partial"
    end
    result.mean = mean
    result.quality = quality
    result.rejected = input.rejected
    assert(result.count == input.count, "aggregate-count")
    context:emit("aggregate", "domain3", result.sum, mean, quality)
    return result, mean
end

callbacks["domain4-4"] = function(context)
    local input = context:get("domain4-3")
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
    if mean >= 44 then
        quality = "high"
    elseif input.rejected > 2 then
        quality = "partial"
    end
    result.mean = mean
    result.quality = quality
    result.rejected = input.rejected
    assert(result.count == input.count, "aggregate-count")
    context:emit("aggregate", "domain4", result.sum, mean, quality)
    return result, mean
end

callbacks["domain5-4"] = function(context)
    local input = context:get("domain5-3")
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
    if mean >= 45 then
        quality = "high"
    elseif input.rejected > 2 then
        quality = "partial"
    end
    result.mean = mean
    result.quality = quality
    result.rejected = input.rejected
    assert(result.count == input.count, "aggregate-count")
    context:emit("aggregate", "domain5", result.sum, mean, quality)
    return result, mean
end

callbacks["domain6-4"] = function(context)
    local input = context:get("domain6-3")
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
    if mean >= 46 then
        quality = "high"
    elseif input.rejected > 2 then
        quality = "partial"
    end
    result.mean = mean
    result.quality = quality
    result.rejected = input.rejected
    assert(result.count == input.count, "aggregate-count")
    context:emit("aggregate", "domain6", result.sum, mean, quality)
    return result, mean
end

callbacks["domain1-5"] = function(context)
    local input = context:get("domain1-4")
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
        checkpoint.storage = "primary-domain1"
    else
        checkpoint.storage = "replica-domain1"
    end
    context:emit("checkpoint", checkpoint.storage, checksum, #encoded)
    return checkpoint, checksum
end

callbacks["domain2-5"] = function(context)
    local input = context:get("domain2-4")
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
        checkpoint.storage = "primary-domain2"
    else
        checkpoint.storage = "replica-domain2"
    end
    context:emit("checkpoint", checkpoint.storage, checksum, #encoded)
    return checkpoint, checksum
end

callbacks["domain3-5"] = function(context)
    local input = context:get("domain3-4")
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
        checkpoint.storage = "primary-domain3"
    else
        checkpoint.storage = "replica-domain3"
    end
    context:emit("checkpoint", checkpoint.storage, checksum, #encoded)
    return checkpoint, checksum
end

callbacks["domain4-5"] = function(context)
    local input = context:get("domain4-4")
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
        checkpoint.storage = "primary-domain4"
    else
        checkpoint.storage = "replica-domain4"
    end
    context:emit("checkpoint", checkpoint.storage, checksum, #encoded)
    return checkpoint, checksum
end

callbacks["domain5-5"] = function(context)
    local input = context:get("domain5-4")
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
        checkpoint.storage = "primary-domain5"
    else
        checkpoint.storage = "replica-domain5"
    end
    context:emit("checkpoint", checkpoint.storage, checksum, #encoded)
    return checkpoint, checksum
end

callbacks["domain6-5"] = function(context)
    local input = context:get("domain6-4")
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
        checkpoint.storage = "primary-domain6"
    else
        checkpoint.storage = "replica-domain6"
    end
    context:emit("checkpoint", checkpoint.storage, checksum, #encoded)
    return checkpoint, checksum
end

callbacks["domain1-6"] = function(context)
    local checkpoint = context:get("domain1-5")
    local transient = (seed + mode + 1) % 3 == 0
    local remaining = 2 - context.attempt
    context:emit("delivery-attempt", context.attempt, checkpoint.checksum)
    if transient and remaining >= 0 then
        error("transient-domain1-" .. tostring(context.attempt), 0)
    end
    local receipts = {}
    local total = 0
    for replica = 1, 3 do
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
    context:emit("delivery", "domain1", #receipts, total, context.attempt)
    return {receipts = receipts, total = total, checksum = checkpoint.checksum}, #receipts
end

callbacks["domain2-6"] = function(context)
    local checkpoint = context:get("domain2-5")
    local transient = (seed + mode + 2) % 3 == 0
    local remaining = 1 - context.attempt
    context:emit("delivery-attempt", context.attempt, checkpoint.checksum)
    if transient and remaining >= 0 then
        error("transient-domain2-" .. tostring(context.attempt), 0)
    end
    local receipts = {}
    local total = 0
    for replica = 1, 4 do
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
    context:emit("delivery", "domain2", #receipts, total, context.attempt)
    return {receipts = receipts, total = total, checksum = checkpoint.checksum}, #receipts
end

callbacks["domain3-6"] = function(context)
    local checkpoint = context:get("domain3-5")
    local transient = (seed + mode + 3) % 3 == 0
    local remaining = 2 - context.attempt
    context:emit("delivery-attempt", context.attempt, checkpoint.checksum)
    if transient and remaining >= 0 then
        error("transient-domain3-" .. tostring(context.attempt), 0)
    end
    local receipts = {}
    local total = 0
    for replica = 1, 2 do
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
    context:emit("delivery", "domain3", #receipts, total, context.attempt)
    return {receipts = receipts, total = total, checksum = checkpoint.checksum}, #receipts
end

callbacks["domain4-6"] = function(context)
    local checkpoint = context:get("domain4-5")
    local transient = (seed + mode + 4) % 3 == 0
    local remaining = 1 - context.attempt
    context:emit("delivery-attempt", context.attempt, checkpoint.checksum)
    if transient and remaining >= 0 then
        error("transient-domain4-" .. tostring(context.attempt), 0)
    end
    local receipts = {}
    local total = 0
    for replica = 1, 3 do
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
    context:emit("delivery", "domain4", #receipts, total, context.attempt)
    return {receipts = receipts, total = total, checksum = checkpoint.checksum}, #receipts
end

callbacks["domain5-6"] = function(context)
    local checkpoint = context:get("domain5-5")
    local transient = (seed + mode + 5) % 3 == 0
    local remaining = 2 - context.attempt
    context:emit("delivery-attempt", context.attempt, checkpoint.checksum)
    if transient and remaining >= 0 then
        error("transient-domain5-" .. tostring(context.attempt), 0)
    end
    local receipts = {}
    local total = 0
    for replica = 1, 4 do
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
    context:emit("delivery", "domain5", #receipts, total, context.attempt)
    return {receipts = receipts, total = total, checksum = checkpoint.checksum}, #receipts
end

callbacks["domain6-6"] = function(context)
    local checkpoint = context:get("domain6-5")
    local transient = (seed + mode + 6) % 3 == 0
    local remaining = 1 - context.attempt
    context:emit("delivery-attempt", context.attempt, checkpoint.checksum)
    if transient and remaining >= 0 then
        error("transient-domain6-" .. tostring(context.attempt), 0)
    end
    local receipts = {}
    local total = 0
    for replica = 1, 2 do
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
    context:emit("delivery", "domain6", #receipts, total, context.attempt)
    return {receipts = receipts, total = total, checksum = checkpoint.checksum}, #receipts
end

callbacks["domain1-7"] = function(context)
    local delivered, attempts = context:get("domain1-6")
    local checkpoint = context:get("domain1-5")
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
    context:emit("publish", "domain1", publication.checksum, publication.retryCost, #text)
    return publication, publication.checksum
end

callbacks["domain2-7"] = function(context)
    local delivered, attempts = context:get("domain2-6")
    local checkpoint = context:get("domain2-5")
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
    context:emit("publish", "domain2", publication.checksum, publication.retryCost, #text)
    return publication, publication.checksum
end

callbacks["domain3-7"] = function(context)
    local delivered, attempts = context:get("domain3-6")
    local checkpoint = context:get("domain3-5")
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
    context:emit("publish", "domain3", publication.checksum, publication.retryCost, #text)
    return publication, publication.checksum
end

callbacks["domain4-7"] = function(context)
    local delivered, attempts = context:get("domain4-6")
    local checkpoint = context:get("domain4-5")
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
    context:emit("publish", "domain4", publication.checksum, publication.retryCost, #text)
    return publication, publication.checksum
end

callbacks["domain5-7"] = function(context)
    local delivered, attempts = context:get("domain5-6")
    local checkpoint = context:get("domain5-5")
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
    context:emit("publish", "domain5", publication.checksum, publication.retryCost, #text)
    return publication, publication.checksum
end

callbacks["domain6-7"] = function(context)
    local delivered, attempts = context:get("domain6-6")
    local checkpoint = context:get("domain6-5")
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
    context:emit("publish", "domain6", publication.checksum, publication.retryCost, #text)
    return publication, publication.checksum
end

callbacks["domain1-8"] = function(context)
    local publication = context:get("domain1-7")
    local aggregate = context:get("domain1-4")
    local checkpoint = context:get("domain1-5")
    local parsed, sum = 0, 0
    for position, receipt in string.gmatch(publication.text, "(%d+)=(%d+)") do
        parsed += 1
        assert(tonumber(position) == parsed, "manifest-order")
        sum += tonumber(receipt)
    end
    local delivered = context:get("domain1-6")
    assert(sum == delivered.total and parsed == publication.count, "manifest-reconcile")
    assert(checkpoint.checksum == publication.source, "source-reconcile")
    local score = aggregate.sum - aggregate.rejected * 1
    if publication.retryCost > 0 then
        score -= publication.retryCost * 2
        context:emit("retry-penalty", publication.retryCost, score)
    else
        score += parsed
        context:emit("clean-bonus", parsed, score)
    end
    local status = score >= 30 and "accepted" or "review"
    local report = {score = score, status = status, digest = publication.checksum, count = aggregate.count}
    local errorOk, expected = pcall(function() error("audit-domain1", 0) end)
    assert(not errorOk and expected == "audit-domain1", "expected-error")
    context:emit("reconcile", "domain1", status, score, report.count, expected)
    return report, score
end

callbacks["domain2-8"] = function(context)
    local publication = context:get("domain2-7")
    local aggregate = context:get("domain2-4")
    local checkpoint = context:get("domain2-5")
    local parsed, sum = 0, 0
    for position, receipt in string.gmatch(publication.text, "(%d+)=(%d+)") do
        parsed += 1
        assert(tonumber(position) == parsed, "manifest-order")
        sum += tonumber(receipt)
    end
    local delivered = context:get("domain2-6")
    assert(sum == delivered.total and parsed == publication.count, "manifest-reconcile")
    assert(checkpoint.checksum == publication.source, "source-reconcile")
    local score = aggregate.sum - aggregate.rejected * 2
    if publication.retryCost > 0 then
        score -= publication.retryCost * 3
        context:emit("retry-penalty", publication.retryCost, score)
    else
        score += parsed
        context:emit("clean-bonus", parsed, score)
    end
    local status = score >= 60 and "accepted" or "review"
    local report = {score = score, status = status, digest = publication.checksum, count = aggregate.count}
    local errorOk, expected = pcall(function() error("audit-domain2", 0) end)
    assert(not errorOk and expected == "audit-domain2", "expected-error")
    context:emit("reconcile", "domain2", status, score, report.count, expected)
    return report, score
end

callbacks["domain3-8"] = function(context)
    local publication = context:get("domain3-7")
    local aggregate = context:get("domain3-4")
    local checkpoint = context:get("domain3-5")
    local parsed, sum = 0, 0
    for position, receipt in string.gmatch(publication.text, "(%d+)=(%d+)") do
        parsed += 1
        assert(tonumber(position) == parsed, "manifest-order")
        sum += tonumber(receipt)
    end
    local delivered = context:get("domain3-6")
    assert(sum == delivered.total and parsed == publication.count, "manifest-reconcile")
    assert(checkpoint.checksum == publication.source, "source-reconcile")
    local score = aggregate.sum - aggregate.rejected * 3
    if publication.retryCost > 0 then
        score -= publication.retryCost * 4
        context:emit("retry-penalty", publication.retryCost, score)
    else
        score += parsed
        context:emit("clean-bonus", parsed, score)
    end
    local status = score >= 90 and "accepted" or "review"
    local report = {score = score, status = status, digest = publication.checksum, count = aggregate.count}
    local errorOk, expected = pcall(function() error("audit-domain3", 0) end)
    assert(not errorOk and expected == "audit-domain3", "expected-error")
    context:emit("reconcile", "domain3", status, score, report.count, expected)
    return report, score
end

callbacks["domain4-8"] = function(context)
    local publication = context:get("domain4-7")
    local aggregate = context:get("domain4-4")
    local checkpoint = context:get("domain4-5")
    local parsed, sum = 0, 0
    for position, receipt in string.gmatch(publication.text, "(%d+)=(%d+)") do
        parsed += 1
        assert(tonumber(position) == parsed, "manifest-order")
        sum += tonumber(receipt)
    end
    local delivered = context:get("domain4-6")
    assert(sum == delivered.total and parsed == publication.count, "manifest-reconcile")
    assert(checkpoint.checksum == publication.source, "source-reconcile")
    local score = aggregate.sum - aggregate.rejected * 4
    if publication.retryCost > 0 then
        score -= publication.retryCost * 5
        context:emit("retry-penalty", publication.retryCost, score)
    else
        score += parsed
        context:emit("clean-bonus", parsed, score)
    end
    local status = score >= 120 and "accepted" or "review"
    local report = {score = score, status = status, digest = publication.checksum, count = aggregate.count}
    local errorOk, expected = pcall(function() error("audit-domain4", 0) end)
    assert(not errorOk and expected == "audit-domain4", "expected-error")
    context:emit("reconcile", "domain4", status, score, report.count, expected)
    return report, score
end

callbacks["domain5-8"] = function(context)
    local publication = context:get("domain5-7")
    local aggregate = context:get("domain5-4")
    local checkpoint = context:get("domain5-5")
    local parsed, sum = 0, 0
    for position, receipt in string.gmatch(publication.text, "(%d+)=(%d+)") do
        parsed += 1
        assert(tonumber(position) == parsed, "manifest-order")
        sum += tonumber(receipt)
    end
    local delivered = context:get("domain5-6")
    assert(sum == delivered.total and parsed == publication.count, "manifest-reconcile")
    assert(checkpoint.checksum == publication.source, "source-reconcile")
    local score = aggregate.sum - aggregate.rejected * 5
    if publication.retryCost > 0 then
        score -= publication.retryCost * 6
        context:emit("retry-penalty", publication.retryCost, score)
    else
        score += parsed
        context:emit("clean-bonus", parsed, score)
    end
    local status = score >= 150 and "accepted" or "review"
    local report = {score = score, status = status, digest = publication.checksum, count = aggregate.count}
    local errorOk, expected = pcall(function() error("audit-domain5", 0) end)
    assert(not errorOk and expected == "audit-domain5", "expected-error")
    context:emit("reconcile", "domain5", status, score, report.count, expected)
    return report, score
end

callbacks["domain6-8"] = function(context)
    local publication = context:get("domain6-7")
    local aggregate = context:get("domain6-4")
    local checkpoint = context:get("domain6-5")
    local parsed, sum = 0, 0
    for position, receipt in string.gmatch(publication.text, "(%d+)=(%d+)") do
        parsed += 1
        assert(tonumber(position) == parsed, "manifest-order")
        sum += tonumber(receipt)
    end
    local delivered = context:get("domain6-6")
    assert(sum == delivered.total and parsed == publication.count, "manifest-reconcile")
    assert(checkpoint.checksum == publication.source, "source-reconcile")
    local score = aggregate.sum - aggregate.rejected * 6
    if publication.retryCost > 0 then
        score -= publication.retryCost * 7
        context:emit("retry-penalty", publication.retryCost, score)
    else
        score += parsed
        context:emit("clean-bonus", parsed, score)
    end
    local status = score >= 180 and "accepted" or "review"
    local report = {score = score, status = status, digest = publication.checksum, count = aggregate.count}
    local errorOk, expected = pcall(function() error("audit-domain6", 0) end)
    assert(not errorOk and expected == "audit-domain6", "expected-error")
    context:emit("reconcile", "domain6", status, score, report.count, expected)
    return report, score
end

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
print(table.concat(trace, "\n"))
