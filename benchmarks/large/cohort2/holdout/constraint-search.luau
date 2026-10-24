-- Independently authored finite-domain constraint laboratory.
-- Domains are mutable views; every deletion is trailed and search restores views.
local seedArg, modeArg = ...
local seed = tonumber(seedArg) or 0
local mode = tonumber(modeArg) or 0
local abs = math.abs
local floor = math.floor
local function mix(h, x)
    return (h * 131 + x + 1009) % 1000000007
end
local function arrayCopy(a)
    local out = {}
    for i = 1, #a do
        out[i] = a[i]
    end
    return out
end
local function range(lo, hi)
    local out = {}
    for x = lo, hi do
        out[#out + 1] = x
    end
    return out
end
local function joinNumbers(a)
    local out = {}
    for i = 1, #a do
        out[i] = tostring(a[i])
    end
    return table.concat(out, ",")
end
local function gcd(a, b)
    a = abs(a)
    b = abs(b)
    while b ~= 0 do
        a, b = b, a % b
    end
    return a
end
local function fold(a, initial, combine)
    local value = initial
    for i = 1, #a do
        value = combine(value, a[i], i)
    end
    return value
end
local Domain = {}
Domain.__index = Domain
function Domain:contains(value)
    return self.live[value] == true
end
function Domain:bounds()
    local lo, hi
    for i = 1, #self.order do
        local value = self.order[i]
        if self.live[value] then
            lo = lo or value
            hi = value
        end
    end
    return lo, hi
end
function Domain:singleton()
    if self.size ~= 1 then
        return nil
    end
    local lo = self:bounds()
    return lo
end
function Domain:values()
    local cursor = 0
    local order = self.order
    local live = self.live
    return function()
        repeat
            cursor += 1
            local value = order[cursor]
            if value == nil then
                return nil
            end
            if live[value] then
                return value
            end
        until false
    end
end
function Domain:snapshot()
    local out = {}
    for value in self:values() do
        out[#out + 1] = value
    end
    return out
end
function Domain:checksum()
    local hash = mix(17, self.id)
    for value in self:values() do
        hash = mix(hash, value)
    end
    return mix(hash, self.size)
end
local Solver = {}
Solver.__index = Solver
function Solver.new(name, salt)
    local self = setmetatable({}, Solver)
    self.name = name
    self.salt = salt
    self.vars = {}
    self.constraints = {}
    self.trail = {}
    self.queue = {}
    self.queued = {}
    self.queueHead = 1
    self.solutions = {}
    self.failure = nil
    self.depth = 0
    self.stats = {nodes = 0, failures = 0, removals = 0, propagations = 0, restores = 0, choices = 0}
    self.events = {}
    self.eventHash = 31
    self.nodeLimit = 3000
    self.stopReason = "complete"
    return self
end
function Solver:event(kind, a, b)
    self.eventHash = mix(self.eventHash, kind)
    self.eventHash = mix(self.eventHash, a or 0)
    self.eventHash = mix(self.eventHash, b or 0)
    if #self.events < 18 then
        self.events[#self.events + 1] = tostring(kind) .. ":" .. tostring(a or 0) .. ":" .. tostring(b or 0)
    end
end
function Solver:variable(name, values)
    local unique = {}
    local order = {}
    for i = 1, #values do
        local value = values[i]
        if not unique[value] then
            unique[value] = true
            order[#order + 1] = value
        end
    end
    table.sort(order)
    if #order == 0 then
        error("empty declared domain:" .. name, 0)
    end
    local var = setmetatable({id = #self.vars + 1, name = name, order = order, live = unique, size = #order, watchers = {}}, Domain)
    self.vars[#self.vars + 1] = var
    return var
end
function Solver:block(prefix, count, values)
    local out = {}
    for i = 1, count do
        out[i] = self:variable(prefix .. tostring(i), values)
    end
    return out
end
function Solver:enqueue(id)
    if not self.queued[id] then
        self.queued[id] = true
        self.queue[#self.queue + 1] = id
    end
end
function Solver:constraint(kind, vars, propagate, check)
    local id = #self.constraints + 1
    local constraint = {id = id, kind = kind, vars = vars, propagate = propagate, check = check, calls = 0, cuts = 0}
    self.constraints[id] = constraint
    for i = 1, #vars do
        local watcherList = vars[i].watchers
        watcherList[#watcherList + 1] = id
    end
    self:enqueue(id)
    return constraint
end
function Solver:remove(var, value, reason)
    if not var.live[value] then
        return true
    end
    var.live[value] = nil
    var.size -= 1
    self.trail[#self.trail + 1] = {var, value}
    self.stats.removals += 1
    self:event(1, var.id, value)
    if reason then
        reason.cuts += 1
    end
    if var.size == 0 then
        self.failure = {var.id, reason and reason.id or 0}
        return false
    end
    for i = 1, #var.watchers do
        self:enqueue(var.watchers[i])
    end
    return true
end
function Solver:restrict(var, predicate, reason)
    for value in var:values() do
        if not predicate(value) then
            if not self:remove(var, value, reason) then
                return false
            end
        end
    end
    return true
end
function Solver:assign(var, value)
    if not var:contains(value) then
        self.failure = {var.id, -1}
        return false
    end
    self:event(2, var.id, value)
    return self:restrict(var, function(candidate)
        return candidate == value
    end, nil)
end
function Solver:mark()
    return #self.trail
end
function Solver:restore(mark)
    for i = #self.trail, mark + 1, -1 do
        local entry = self.trail[i]
        local var = entry[1]
        var.live[entry[2]] = true
        var.size += 1
        self.trail[i] = nil
        self.stats.restores += 1
    end
    table.clear(self.queue)
    table.clear(self.queued)
    self.queueHead = 1
    self.failure = nil
    self:event(3, mark, self.depth)
end
function Solver:propagate()
    while self.queueHead <= #self.queue do
        local id = self.queue[self.queueHead]
        self.queueHead += 1
        self.queued[id] = nil
        local c = self.constraints[id]
        c.calls += 1
        self.stats.propagations += 1
        if not c.propagate(self, c) then
            self.stats.failures += 1
            self:event(4, id, self.depth)
            return false
        end
    end
    table.clear(self.queue)
    self.queueHead = 1
    return true
end
function Solver:choose()
    local best, score
    for i = 1, #self.vars do
        local var = self.vars[i]
        if var.size > 1 then
            local candidate = var.size * 100 - #var.watchers
            if score == nil or candidate < score then
                best = var
                score = candidate
            end
        end
    end
    return best
end
function Solver:orderedValues(var)
    local values = var:snapshot()
    local rotation = (self.salt + var.id + self.depth) % #values
    local out = {}
    for i = 1, #values do
        out[i] = values[(i + rotation - 1) % #values + 1]
    end
    if self.depth % 2 == 1 then
        local n = #out
        for i = 1, floor(n / 2) do
            out[i], out[n - i + 1] = out[n - i + 1], out[i]
        end
    end
    return out
end
function Solver:capture()
    local solution = {}
    for i = 1, #self.vars do
        solution[i] = self.vars[i]:singleton()
        if solution[i] == nil then
            error("capture of partial assignment", 0)
        end
    end
    for i = 1, #self.constraints do
        local c = self.constraints[i]
        if not c.check(solution) then
            error("invalid solution:" .. self.name .. ":" .. c.kind, 0)
        end
    end
    self.solutions[#self.solutions + 1] = arrayCopy(solution)
    self:event(5, #self.solutions, fold(solution, 7, mix))
end
function Solver:search(limit)
    if #self.solutions >= limit then
        self.stopReason = "solution-limit"
        return
    end
    if self.stats.nodes >= self.nodeLimit then
        self.stopReason = "node-limit"
        return
    end
    self.stats.nodes += 1
    if not self:propagate() then
        return
    end
    local var = self:choose()
    if not var then
        self:capture()
        return
    end
    self.stats.choices += 1
    local mark = self:mark()
    local values = self:orderedValues(var)
    self.depth += 1
    for i = 1, #values do
        if #self.solutions >= limit or self.stats.nodes >= self.nodeLimit then
            self.stopReason = #self.solutions >= limit and "solution-limit" or "node-limit"
            break
        end
        if self:assign(var, values[i]) then
            self:search(limit)
        end
        self:restore(mark)
    end
    self.depth -= 1
end
function Solver:domainHash()
    local hash = 37
    for i = 1, #self.vars do
        hash = mix(hash, self.vars[i]:checksum())
    end
    return hash
end
function Solver:solutionHash()
    local hash = 41
    for i = 1, #self.solutions do
        hash = mix(hash, i)
        hash = fold(self.solutions[i], hash, mix)
    end
    return hash
end
function Solver:profile()
    local calls, cuts, hash = 0, 0, 43
    for i = 1, #self.constraints do
        local c = self.constraints[i]
        calls += c.calls
        cuts += c.cuts
        hash = mix(hash, c.calls)
        hash = mix(hash, c.cuts)
        hash = mix(hash, #c.vars)
    end
    return calls, cuts, hash
end
local function unary(s, var, predicate, label)
    return s:constraint(label or "unary", {var}, function(state, c)
        return state:restrict(var, predicate, c)
    end, function(values)
        return predicate(values[var.id])
    end)
end
local function binary(s, left, right, predicate, label)
    local function revise(state, c, a, b, swapped)
        for x in a:values() do
            local supported = false
            for y in b:values() do
                local ok
                if swapped then
                    ok = predicate(y, x)
                else
                    ok = predicate(x, y)
                end
                if ok then
                    supported = true
                    break
                end
            end
            if not supported and not state:remove(a, x, c) then
                return false
            end
        end
        return true
    end
    return s:constraint(label or "binary", {left, right}, function(state, c)
        return revise(state, c, left, right, false) and revise(state, c, right, left, true)
    end, function(values)
        return predicate(values[left.id], values[right.id])
    end)
end
local function different(s, a, b, offset)
    local delta = offset or 0
    return binary(s, a, b, function(x, y)
        return x ~= y + delta
    end, "different")
end
local function less(s, a, b, gap)
    return binary(s, a, b, function(x, y)
        return x + gap <= y
    end, "precedence")
end
local function allDifferent(s, vars)
    return s:constraint("all-different", vars, function(state, c)
        local owners = {}
        for i = 1, #vars do
            local value = vars[i]:singleton()
            if value ~= nil then
                if owners[value] then
                    return false
                end
                owners[value] = i
            end
        end
        for i = 1, #vars do
            local var = vars[i]
            if var.size > 1 then
                for value in var:values() do
                    if owners[value] and not state:remove(var, value, c) then
                        return false
                    end
                end
            end
        end
        for i = 1, #vars do
            local a = vars[i]
            if a.size == 2 then
                local pair = a:snapshot()
                local twins = {}
                for j = 1, #vars do
                    local b = vars[j]
                    if b.size == 2 and b:contains(pair[1]) and b:contains(pair[2]) then
                        twins[#twins + 1] = j
                    end
                end
                if #twins > 2 then
                    return false
                end
                if #twins == 2 then
                    for j = 1, #vars do
                        if j ~= twins[1] and j ~= twins[2] then
                            if not state:remove(vars[j], pair[1], c) or not state:remove(vars[j], pair[2], c) then
                                return false
                            end
                        end
                    end
                end
            end
        end
        return true
    end, function(values)
        local seen = {}
        for i = 1, #vars do
            local value = values[vars[i].id]
            if seen[value] then
                return false
            end
            seen[value] = true
        end
        return true
    end)
end
local function linear(s, vars, coefficients, target, relation)
    local function accepted(value)
        if relation == "eq" then
            return value == target
        elseif relation == "le" then
            return value <= target
        else
            return value >= target
        end
    end
    return s:constraint("linear-" .. relation, vars, function(state, c)
        local minimum, maximum = 0, 0
        local lows, highs = {}, {}
        for i = 1, #vars do
            local lo, hi = vars[i]:bounds()
            local weight = coefficients[i]
            lows[i] = math.min(lo * weight, hi * weight)
            highs[i] = math.max(lo * weight, hi * weight)
            minimum += lows[i]
            maximum += highs[i]
        end
        if relation == "eq" and (target < minimum or target > maximum) then
            return false
        end
        if relation == "le" and minimum > target then
            return false
        end
        if relation == "ge" and maximum < target then
            return false
        end
        for i = 1, #vars do
            local otherMin = minimum - lows[i]
            local otherMax = maximum - highs[i]
            for value in vars[i]:values() do
                local lo = otherMin + value * coefficients[i]
                local hi = otherMax + value * coefficients[i]
                local feasible
                if relation == "eq" then
                    feasible = lo <= target and hi >= target
                elseif relation == "le" then
                    feasible = lo <= target
                else
                    feasible = hi >= target
                end
                if not feasible and not state:remove(vars[i], value, c) then
                    return false
                end
            end
        end
        return true
    end, function(values)
        local sum = 0
        for i = 1, #vars do
            sum += coefficients[i] * values[vars[i].id]
        end
        return accepted(sum)
    end)
end
local function tableConstraint(s, vars, tuples, label)
    return s:constraint(label or "table", vars, function(state, c)
        local supports = {}
        for i = 1, #vars do
            supports[i] = {}
        end
        local viable = 0
        for t = 1, #tuples do
            local tuple = tuples[t]
            local ok = true
            for i = 1, #vars do
                if not vars[i]:contains(tuple[i]) then
                    ok = false
                    break
                end
            end
            if ok then
                viable += 1
                for i = 1, #vars do
                    supports[i][tuple[i]] = true
                end
            end
        end
        if viable == 0 then
            return false
        end
        for i = 1, #vars do
            if not state:restrict(vars[i], function(value)
                return supports[i][value] == true
            end, c) then
                return false
            end
        end
        return true
    end, function(values)
        for t = 1, #tuples do
            local ok = true
            for i = 1, #vars do
                if values[vars[i].id] ~= tuples[t][i] then
                    ok = false
                    break
                end
            end
            if ok then
                return true
            end
        end
        return false
    end)
end
local function cardinality(s, vars, wanted, lower, upper)
    return s:constraint("cardinality", vars, function(state, c)
        local forced, possible = 0, 0
        for i = 1, #vars do
            if vars[i]:contains(wanted) then
                possible += 1
                if vars[i].size == 1 then
                    forced += 1
                end
            end
        end
        if forced > upper or possible < lower then
            return false
        end
        for i = 1, #vars do
            local var = vars[i]
            if var.size > 1 and var:contains(wanted) then
                if forced == upper then
                    if not state:remove(var, wanted, c) then
                        return false
                    end
                elseif possible == lower then
                    if not state:restrict(var, function(value)
                        return value == wanted
                    end, c) then
                        return false
                    end
                end
            end
        end
        return true
    end, function(values)
        local count = 0
        for i = 1, #vars do
            if values[vars[i].id] == wanted then
                count += 1
            end
        end
        return count >= lower and count <= upper
    end)
end
local function element(s, index, entries, result)
    local vars = {index, result}
    for i = 1, #entries do
        vars[#vars + 1] = entries[i]
    end
    return s:constraint("element", vars, function(state, c)
        local resultSupport = {}
        for position in index:values() do
            local entry = entries[position]
            local supported = false
            if entry then
                for value in entry:values() do
                    if result:contains(value) then
                        supported = true
                        resultSupport[value] = true
                    end
                end
            end
            if not supported and not state:remove(index, position, c) then
                return false
            end
        end
        if not state:restrict(result, function(value)
            return resultSupport[value] == true
        end, c) then
            return false
        end
        local selected = index:singleton()
        if selected then
            return state:restrict(entries[selected], function(value)
                return result:contains(value)
            end, c)
        end
        return true
    end, function(values)
        local selected = values[index.id]
        return entries[selected] ~= nil and values[entries[selected].id] == values[result.id]
    end)
end
local function regular(s, vars, states, initial, accepting, transition)
    local function step(current, value)
        return transition[current] and transition[current][value]
    end
    return s:constraint("regular", vars, function(state, c)
        local forward = {{[initial] = true}}
        for i = 1, #vars do
            local nextSet = {}
            for current = 1, states do
                if forward[i][current] then
                    for value in vars[i]:values() do
                        local nextState = step(current, value)
                        if nextState then
                            nextSet[nextState] = true
                        end
                    end
                end
            end
            forward[i + 1] = nextSet
        end
        local backward = {}
        backward[#vars + 1] = accepting
        for i = #vars, 1, -1 do
            local previous = {}
            for current = 1, states do
                for value in vars[i]:values() do
                    local nextState = step(current, value)
                    if nextState and backward[i + 1][nextState] then
                        previous[current] = true
                        break
                    end
                end
            end
            backward[i] = previous
        end
        if not backward[1][initial] then
            return false
        end
        for i = 1, #vars do
            for value in vars[i]:values() do
                local supported = false
                for current = 1, states do
                    local nextState = step(current, value)
                    if forward[i][current] and nextState and backward[i + 1][nextState] then
                        supported = true
                        break
                    end
                end
                if not supported and not state:remove(vars[i], value, c) then
                    return false
                end
            end
        end
        return true
    end, function(values)
        local current = initial
        for i = 1, #vars do
            current = step(current, values[vars[i].id])
            if not current then
                return false
            end
        end
        return accepting[current] == true
    end)
end
local function distance(s, a, b, result)
    local tuples = {}
    for x in a:values() do
        for y in b:values() do
            local d = abs(x - y)
            if result:contains(d) then
                tuples[#tuples + 1] = {x, y, d}
            end
        end
    end
    return tableConstraint(s, {a, b, result}, tuples, "distance")
end
local function product(s, a, b, result)
    local tuples = {}
    for x in a:values() do
        for y in b:values() do
            local p = x * y
            if result:contains(p) then
                tuples[#tuples + 1] = {x, y, p}
            end
        end
    end
    return tableConstraint(s, {a, b, result}, tuples, "product")
end
local function modulo(s, var, residue, modulus)
    return binary(s, var, residue, function(value, r)
        return value % modulus == r
    end, "modulo")
end
local function reifiedLess(s, a, b, flag)
    local tuples = {}
    for x in a:values() do
        for y in b:values() do
            local truth = x < y and 1 or 0
            tuples[#tuples + 1] = {x, y, truth}
        end
    end
    return tableConstraint(s, {a, b, flag}, tuples, "reified-less")
end
local function lexicographic(s, left, right)
    local vars = {}
    for i = 1, #left do
        vars[#vars + 1] = left[i]
        vars[#vars + 1] = right[i]
    end
    return s:constraint("lexicographic", vars, function(state, c)
        for i = 1, #left do
            local a = left[i]:singleton()
            local b = right[i]:singleton()
            if a ~= nil and b ~= nil then
                if a < b then
                    return true
                elseif a > b then
                    return false
                end
            else
                local low = left[i]:bounds()
                local _, high = right[i]:bounds()
                if not state:restrict(left[i], function(value)
                    return value <= high
                end, c) then
                    return false
                end
                if not state:restrict(right[i], function(value)
                    return value >= low
                end, c) then
                    return false
                end
                return true
            end
        end
        return true
    end, function(values)
        for i = 1, #left do
            local a = values[left[i].id]
            local b = values[right[i].id]
            if a ~= b then
                return a < b
            end
        end
        return true
    end)
end
local function circuit(s, successors)
    allDifferent(s, successors)
    for i = 1, #successors do
        unary(s, successors[i], function(value)
            return value ~= i
        end, "no-self-loop")
    end
    return s:constraint("circuit", successors, function(state, c)
        for start = 1, #successors do
            local seen = {}
            local current = start
            local length = 0
            while current and not seen[current] do
                seen[current] = true
                length += 1
                local nextNode = successors[current]:singleton()
                if nextNode == start and length < #successors then
                    return false
                end
                current = nextNode
            end
            if current == nil and length < #successors then
                local last = start
                while successors[last]:singleton() do
                    last = successors[last]:singleton()
                end
                if not state:remove(successors[last], start, c) then
                    return false
                end
            end
        end
        return true
    end, function(values)
        local visited = {}
        local current = 1
        for _ = 1, #successors do
            if visited[current] then
                return false
            end
            visited[current] = true
            current = values[successors[current].id]
        end
        return current == 1
    end)
end
local function cumulative(s, starts, durations, demands, capacity)
    return s:constraint("cumulative", starts, function(state, c)
        local first, last
        for i = 1, #starts do
            local lo, hi = starts[i]:bounds()
            first = first and math.min(first, lo) or lo
            last = last and math.max(last, hi + durations[i]) or hi + durations[i]
        end
        local mandatory = {}
        for time = first, last - 1 do
            local load = 0
            for i = 1, #starts do
                local lo, hi = starts[i]:bounds()
                if time >= hi and time < lo + durations[i] then
                    load += demands[i]
                end
            end
            if load > capacity then
                return false
            end
            mandatory[time] = load
        end
        for i = 1, #starts do
            local lo, hi = starts[i]:bounds()
            for value in starts[i]:values() do
                local feasible = true
                for time = value, value + durations[i] - 1 do
                    local ownMandatory = time >= hi and time < lo + durations[i]
                    local load = mandatory[time] + (ownMandatory and 0 or demands[i])
                    if load > capacity then
                        feasible = false
                        break
                    end
                end
                if not feasible and not state:remove(starts[i], value, c) then
                    return false
                end
            end
        end
        return true
    end, function(values)
        local usage = {}
        for i = 1, #starts do
            local start = values[starts[i].id]
            for time = start, start + durations[i] - 1 do
                usage[time] = (usage[time] or 0) + demands[i]
                if usage[time] > capacity then
                    return false
                end
            end
        end
        return true
    end)
end
local function inverse(s, forward, backward)
    allDifferent(s, forward)
    allDifferent(s, backward)
    for i = 1, #forward do
        for j = 1, #backward do
            binary(s, forward[i], backward[j], function(a, b)
                return (a == j) == (b == i)
            end, "inverse-channel")
        end
    end
end
local function among(s, vars, allowed, count)
    local flags = {}
    for i = 1, #vars do
        local flag = s:variable("membership" .. tostring(i), {0, 1})
        flags[i] = flag
        binary(s, vars[i], flag, function(value, truth)
            return (allowed[value] == true) == (truth == 1)
        end, "membership")
    end
    flags[#flags + 1] = count
    local weights = {}
    for i = 1, #vars do
        weights[i] = 1
    end
    weights[#flags] = -1
    linear(s, flags, weights, 0, "eq")
    return flags
end
local function buildQueens(s, salt)
    local n = 6 + salt % 2
    local queens = s:block("queen", n, range(1, n))
    allDifferent(s, queens)
    for i = 1, n do
        for j = i + 1, n do
            binary(s, queens[i], queens[j], function(a, b)
                return abs(a - b) ~= j - i
            end, "diagonal")
        end
    end
    unary(s, queens[1], function(value)
        return value <= floor((n + 1) / 2)
    end, "reflection-break")
    return queens, "queens"
end
local function buildLatin(s, salt)
    local n = 4
    local grid = {}
    for row = 1, n do
        grid[row] = s:block("cell" .. tostring(row) .. "_", n, range(1, n))
        allDifferent(s, grid[row])
    end
    for col = 1, n do
        local vars = {}
        for row = 1, n do
            vars[#vars + 1] = grid[row][col]
        end
        allDifferent(s, vars)
    end
    for col = 1, n do
        local wanted = (col + salt - 1) % n + 1
        unary(s, grid[1][col], function(value)
            return value == wanted
        end, "latin-clue")
    end
    less(s, grid[2][1], grid[3][1], 1)
    return grid[2], "latin"
end
local function buildColoring(s, salt)
    local vertices = s:block("vertex", 8, {1, 2, 3})
    local edges = {{1, 2}, {2, 3}, {3, 4}, {4, 5}, {5, 6}, {6, 7}, {7, 8}, {8, 1}, {1, 5}, {2, 6}, {3, 7}, {4, 8}, {1, 3}}
    for i = 1, #edges do
        local edge = edges[i]
        different(s, vertices[edge[1]], vertices[edge[2]])
    end
    local first = salt % 3 + 1
    unary(s, vertices[1], function(value)
        return value == first
    end, "color-anchor")
    cardinality(s, vertices, first, 2, 4)
    return vertices, "coloring"
end
local function buildCryptarithm(s, salt)
    local base = 7 + salt % 3
    local a = s:variable("A", range(1, base - 1))
    local b = s:variable("B", range(0, base - 1))
    local c = s:variable("C", range(1, base - 1))
    local carry = s:variable("carry", {0, 1})
    allDifferent(s, {a, b, c})
    linear(s, {b, c, a, carry}, {1, 1, -1, -base}, 0, "eq")
    linear(s, {a, carry, b}, {1, 1, -1}, 0, "eq")
    local parity = s:variable("parity", {0, 1})
    modulo(s, c, parity, 2)
    return {a, b, c, carry, parity}, "cryptarithm"
end
local function buildSchedule(s, salt)
    local starts = s:block("start", 5, range(0, 8))
    local durations = {2, 3, 2, 1, 2}
    local demands = {2, 1, 2, 1, 1}
    cumulative(s, starts, durations, demands, 3)
    less(s, starts[1], starts[3], durations[1])
    less(s, starts[2], starts[4], durations[2])
    less(s, starts[3], starts[5], durations[3])
    unary(s, starts[1], function(value)
        return value == salt % 2
    end, "release")
    linear(s, starts, {1, 1, 1, 1, 1}, 24, "le")
    return starts, "schedule"
end
local function buildSequence(s, salt)
    local sequence = s:block("symbol", 9, {0, 1, 2})
    local transition = {
        {[0] = 1, [1] = 2, [2] = 3},
        {[0] = 1, [2] = 3},
        {[0] = 1, [1] = 2},
    }
    regular(s, sequence, 3, 1, {[1] = true, [2] = true}, transition)
    cardinality(s, sequence, 1, 3, 3)
    cardinality(s, sequence, 2, 2, 2)
    unary(s, sequence[1], function(value)
        return value == salt % 3
    end, "sequence-start")
    local left = {sequence[2], sequence[3], sequence[4]}
    local right = {sequence[6], sequence[7], sequence[8]}
    lexicographic(s, left, right)
    return sequence, "sequence"
end
local function buildTour(s, salt)
    local successors = s:block("next", 6, range(1, 6))
    circuit(s, successors)
    for i = 1, 6 do
        unary(s, successors[i], function(value)
            return (i + value + salt) % 5 ~= 0
        end, "road-open")
    end
    return successors, "tour"
end
local function buildRuler(s, salt)
    local marks = s:block("mark", 4, range(0, 11))
    unary(s, marks[1], function(value)
        return value == 0
    end, "origin")
    for i = 1, #marks - 1 do
        less(s, marks[i], marks[i + 1], 1)
    end
    local gaps = {}
    for i = 1, #marks do
        for j = i + 1, #marks do
            local gap = s:variable("gap" .. tostring(i) .. tostring(j), range(1, 11))
            gaps[#gaps + 1] = gap
            distance(s, marks[i], marks[j], gap)
        end
    end
    allDifferent(s, gaps)
    unary(s, marks[4], function(value)
        return value <= 7 + salt % 3
    end, "ruler-bound")
    return marks, "ruler"
end
local function buildPacking(s, salt)
    local selected = s:block("take", 7, {0, 1})
    local weights = {2, 3, 4, 5, 2, 6, 3}
    local profits = {3, 5, 6, 7, 4, 9, 5}
    linear(s, selected, weights, 12 + salt % 3, "le")
    linear(s, selected, profits, 17, "ge")
    cardinality(s, selected, 1, 3, 4)
    binary(s, selected[2], selected[4], function(a, b)
        return a + b <= 1
    end, "incompatible-items")
    binary(s, selected[6], selected[1], function(a, b)
        return a <= b
    end, "dependency")
    return selected, "packing"
end
local function buildPermutation(s, salt)
    local forward = s:block("position", 5, range(1, 5))
    local backward = s:block("occupant", 5, range(1, 5))
    inverse(s, forward, backward)
    less(s, forward[1], forward[4], 1)
    different(s, forward[2], forward[3], 1)
    local index = s:variable("lookup", range(1, 5))
    local result = s:variable("result", {2 + salt % 2})
    element(s, index, forward, result)
    unary(s, index, function(value)
        return value % 2 == 1
    end, "odd-index")
    return forward, "permutation"
end
local function buildArithmetic(s, salt)
    local a = s:variable("factorA", range(-3, 4))
    local b = s:variable("factorB", range(-2, 5))
    local productVar = s:variable("product", range(-12, 20))
    local gap = s:variable("distance", range(0, 8))
    local residue = s:variable("residue", {salt % 3})
    product(s, a, b, productVar)
    distance(s, a, b, gap)
    modulo(s, productVar, residue, 3)
    local flag = s:variable("ascending", {0, 1})
    reifiedLess(s, a, b, flag)
    linear(s, {gap, flag}, {1, -2}, 4, "le")
    unary(s, productVar, function(value)
        return value ~= 0
    end, "nonzero-product")
    return {a, b, productVar, gap, residue, flag}, "arithmetic"
end
local function buildWord(s, salt)
    local letters = s:block("letter", 5, range(1, 4))
    local tuples = {
        {1, 2, 1}, {1, 3, 2}, {2, 1, 3}, {2, 4, 1},
        {3, 1, 4}, {3, 2, 3}, {4, 2, 1}, {4, 3, 2},
    }
    tableConstraint(s, {letters[1], letters[2], letters[3]}, tuples, "prefix-word")
    tableConstraint(s, {letters[3], letters[4], letters[5]}, tuples, "suffix-word")
    local vowels = s:variable("vowel-count", {2, 3})
    among(s, letters, {[1] = true, [3] = true}, vowels)
    binary(s, letters[1], letters[5], function(a, b)
        return (a + b + salt) % 2 == 0
    end, "word-parity")
    return letters, "word"
end
local function buildMagic(s, salt)
    local cells = s:block("magic", 9, range(1, 9))
    allDifferent(s, cells)
    local rows = {{1, 2, 3}, {4, 5, 6}, {7, 8, 9}, {1, 4, 7}, {2, 5, 8}, {3, 6, 9}, {1, 5, 9}, {3, 5, 7}}
    for i = 1, #rows do
        local indices = rows[i]
        linear(s, {cells[indices[1]], cells[indices[2]], cells[indices[3]]}, {1, 1, 1}, 15, "eq")
    end
    unary(s, cells[5], function(value)
        return value == 5
    end, "magic-center")
    local corner = salt % 2 == 0 and 2 or 4
    unary(s, cells[1], function(value)
        return value == corner
    end, "magic-corner")
    less(s, cells[2], cells[4], 1)
    return cells, "magic"
end
local function buildUnsatisfiable(s, salt)
    local vars = s:block("pigeon", 5, range(1, 4))
    allDifferent(s, vars)
    unary(s, vars[1], function(value)
        return value <= 2 + salt % 2
    end, "pigeon-restrict")
    return vars, "pigeonhole"
end
local function objectiveSummary(s, focus)
    local minimum, maximum
    local sums = {}
    local spectrum = {}
    for i = 1, #s.solutions do
        local solution = s.solutions[i]
        local sum = 0
        for j = 1, #focus do
            local value = solution[focus[j].id]
            sum += j * value
            spectrum[value] = (spectrum[value] or 0) + 1
        end
        sums[i] = sum
        minimum = minimum and math.min(minimum, sum) or sum
        maximum = maximum and math.max(maximum, sum) or sum
    end
    local keys = {}
    local recorded = {}
    for i = 1, #focus do
        for j = 1, #focus[i].order do
            local value = focus[i].order[j]
            if spectrum[value] and not recorded[value] then
                keys[#keys + 1] = value
                recorded[value] = true
            end
        end
    end
    table.sort(keys)
    local histogram = {}
    for i = 1, #keys do
        histogram[i] = tostring(keys[i]) .. "=" .. tostring(spectrum[keys[i]])
    end
    return minimum or 0, maximum or 0, table.concat(histogram, ","), sums
end
local function diversitySummary(s)
    local minimum, maximum, pairs, distanceSum = nil, 0, 0, 0
    local common = {}
    local first = s.solutions[1]
    if first then
        for column = 1, #first do
            local agreed = true
            for row = 2, #s.solutions do
                if s.solutions[row][column] ~= first[column] then
                    agreed = false
                    break
                end
            end
            if agreed then
                common[#common + 1] = column
            end
        end
    end
    for a = 1, #s.solutions do
        for b = a + 1, #s.solutions do
            local distance = 0
            for column = 1, #s.vars do
                if s.solutions[a][column] ~= s.solutions[b][column] then
                    distance += 1
                end
            end
            pairs += 1
            distanceSum += distance
            minimum = minimum and math.min(minimum, distance) or distance
            maximum = math.max(maximum, distance)
        end
    end
    return minimum or 0, maximum, pairs, distanceSum, joinNumbers(common)
end
local function inspectGraph(s)
    local visited = {}
    local components, largest = 0, 0
    local degreeHash = 53
    local function visit(var)
        if visited[var.id] then
            return 0
        end
        visited[var.id] = true
        local size = 1
        for i = 1, #var.watchers do
            local c = s.constraints[var.watchers[i]]
            for j = 1, #c.vars do
                size += visit(c.vars[j])
            end
        end
        return size
    end
    for i = 1, #s.vars do
        local var = s.vars[i]
        degreeHash = mix(degreeHash, #var.watchers)
        if not visited[i] then
            components += 1
            largest = math.max(largest, visit(var))
        end
    end
    return components, largest, degreeHash
end
local function trailProbe(s)
    local initial = s:domainHash()
    local mark = s:mark()
    local chosen = s:choose()
    local assigned, propagated = false, false
    local reduced = initial
    if chosen then
        local values = chosen:snapshot()
        assigned = s:assign(chosen, values[#values])
        if assigned then
            propagated = s:propagate()
        end
        reduced = s:domainHash()
        s:restore(mark)
    end
    local restored = s:domainHash()
    if restored ~= initial then
        error("trail restoration mismatch", 0)
    end
    for i = 1, #s.constraints do
        s:enqueue(i)
    end
    return assigned, propagated, reduced, restored
end
local function runFamily(builder, ordinal)
    local salt = abs(seed * 3 + mode * 7 + ordinal * 11)
    local solver = Solver.new("pending", salt)
    local focus, name = builder(solver, salt)
    solver.name = name
    local before = solver:domainHash()
    local graphCount, graphLargest, graphHash = inspectGraph(solver)
    local initialized = solver:propagate()
    local after = solver:domainHash()
    local probeA, probeB, probeHash, restoredHash = false, false, after, after
    if initialized then
        probeA, probeB, probeHash, restoredHash = trailProbe(solver)
        solver:search(2 + (mode + ordinal) % 3)
    end
    local calls, cuts, profileHash = solver:profile()
    local low, high, histogram, sums = objectiveSummary(solver, focus)
    print("family", ordinal, name, #solver.vars, #solver.constraints, initialized, solver.stopReason)
    print("domains", before, after, probeA, probeB, probeHash, restoredHash)
    print("graph", graphCount, graphLargest, graphHash, calls, cuts, profileHash)
    print("search", solver.stats.nodes, solver.stats.choices, solver.stats.failures, solver.stats.removals, solver.stats.restores)
    print("solutions", #solver.solutions, solver:solutionHash(), low, high, joinNumbers(sums))
    print("histogram", histogram)
    print("diversity", diversitySummary(solver))
    print("events", solver.eventHash, table.concat(solver.events, ";"))
    for i = 1, #solver.solutions do
        print("assignment", i, joinNumbers(solver.solutions[i]))
    end
    local fingerprint = mix(solver:solutionHash(), solver.eventHash)
    fingerprint = mix(fingerprint, graphHash)
    fingerprint = mix(fingerprint, profileHash)
    return fingerprint, #solver.solutions, solver.stats.nodes
end
local function invalidDomainProbe()
    local success, failure = pcall(function()
        local solver = Solver.new("invalid", 0)
        solver:variable("void", {})
    end)
    print("caught", success, tostring(failure))
    local success2, failure2 = pcall(function()
        local solver = Solver.new("partial", 0)
        solver:variable("undecided", {1, 2})
        solver:capture()
    end)
    print("caught", success2, tostring(failure2))
end
local families = {
    buildQueens, buildLatin, buildColoring, buildCryptarithm,
    buildSchedule, buildSequence, buildTour, buildRuler,
    buildPacking, buildPermutation, buildArithmetic, buildWord,
    buildMagic, buildUnsatisfiable,
}
print("constraint-search", seed, mode, #families)
invalidDomainProbe()
local combined, totalSolutions, totalNodes = 61, 0, 0
for i = 1, #families do
    local hash, count, nodes = runFamily(families[i], i)
    combined = mix(combined, hash)
    totalSolutions += count
    totalNodes += nodes
end
print("final", combined, totalSolutions, totalNodes, gcd(totalNodes, totalSolutions + 1))
