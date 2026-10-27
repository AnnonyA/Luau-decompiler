-- Original system: stateful integer audio graph, automation, and block boundaries.
local seedArg, modeArg = ...
local seed = tonumber(seedArg) or 0
local mode = tonumber(modeArg) or 0
local trace = {}
local function log(kind, a, b)
    trace[#trace + 1] = kind .. ":" .. tostring(a) .. ":" .. tostring(b)
end
local function clamp(value, limit)
    if value > limit then
        return limit
    elseif value < -limit then
        return -limit
    end
    return value
end
local function divide(value, divisor)
    if value < 0 then
        return -math.floor(-value / divisor)
    end
    return math.floor(value / divisor)
end

local Ring = {}
Ring.__index = Ring
function Ring.new(size)
    local values = {}
    for i = 1, size do
        values[i] = 0
    end
    return setmetatable({values = values, head = 1, size = size, written = 0}, Ring)
end
function Ring:exchange(value)
    local previous = self.values[self.head]
    self.values[self.head] = value
    self.head = self.head % self.size + 1
    self.written += 1
    return previous
end
function Ring:tap(distance)
    local index = (self.head - distance - 1) % self.size + 1
    return self.values[index]
end
function Ring:checksum()
    local total = 0
    for i, value in ipairs(self.values) do
        total += value * i
    end
    return total + self.head * 31 + self.written
end

local function makeNode(name, process, inspect)
    local calls = 0
    return setmetatable({name = name}, {
        __call = function(_, sample, time)
            calls += 1
            return process(sample, time)
        end,
        __index = function(_, key)
            if key == "calls" then
                return calls
            elseif key == "state" then
                return inspect()
            end
            return nil
        end,
    })
end
local function gainNode(parameters)
    local accumulator = 0
    return makeNode("gain", function(sample)
        local result = divide(sample * parameters.gain, 8)
        accumulator = (accumulator + result) % 100003
        return result
    end, function()
        return accumulator
    end)
end
local function smoothingNode(width)
    local window = Ring.new(width)
    local sum = 0
    return makeNode("smooth", function(sample)
        sum += sample - window:exchange(sample)
        return divide(sum, width)
    end, function()
        return sum * 13 + window:checksum()
    end)
end
local function delayNode(length, parameters)
    local memory = Ring.new(length)
    local feedbackEnergy = 0
    return makeNode("delay", function(sample)
        local delayed = memory:tap(length)
        local feedback = divide(delayed * parameters.feedback, 8)
        local stored = clamp(sample + feedback, 4096)
        local previous = memory:exchange(stored)
        assert(previous == delayed, "delay cursor moved early")
        feedbackEnergy = (feedbackEnergy + math.abs(feedback)) % 65521
        return sample + divide(delayed * parameters.wet, 8)
    end, function()
        return memory:checksum() + feedbackEnergy
    end)
end
local function limiterNode(limit, release)
    local envelope = 0
    local clipped = 0
    return makeNode("limit", function(sample)
        envelope = math.max(math.abs(sample), math.max(0, envelope - release))
        if envelope > limit then
            clipped += 1
            return divide(sample * limit, envelope)
        end
        return sample
    end, function()
        return envelope * 17 + clipped
    end)
end

local Pipeline = {}
Pipeline.__index = Pipeline
function Pipeline.new(parameters)
    local gain = gainNode(parameters)
    local smooth = smoothingNode(3 + mode % 2)
    local delay = delayNode(4 + mode, parameters)
    local limit = limiterNode(900 + mode * 100, 37)
    return setmetatable({
        nodes = {gain, smooth, delay, limit}, gain = gain, smooth = smooth,
        delay = delay, limit = limit, parameters = parameters, time = 0,
        meters = {}, events = {}, nextEvent = 1, output = {},
    }, Pipeline)
end
function Pipeline:automate(time, update)
    self.events[#self.events + 1] = {time = time, update = update}
end
function Pipeline:process(block)
    local blockSum = 0
    for _, sample in ipairs(block) do
        self.time += 1
        while self.nextEvent <= #self.events and self.events[self.nextEvent].time <= self.time do
            local event = self.events[self.nextEvent]
            event.update(self.parameters, self.time)
            self.nextEvent += 1
        end
        local amplified = self.gain(sample, self.time)
        local smoothed = self.smooth(amplified, self.time)
        local delayed = self.delay(smoothed, self.time)
        local mixed = delayed
        if self.parameters.bypass then
            mixed = amplified
        elseif self.parameters.parallel then
            mixed = divide(delayed + amplified, 2)
        end
        local result = self.limit(mixed, self.time)
        self.output[#self.output + 1] = result
        blockSum += result
        for _, meter in ipairs(self.meters) do
            meter(result, self.time)
        end
    end
    return blockSum
end
function Pipeline:meter(callback)
    self.meters[#self.meters + 1] = callback
end

local parameters = {gain = 8 + mode, feedback = 3, wet = 5, bypass = false, parallel = mode % 2 == 0}
local automationAlias = parameters
local pipeline = Pipeline.new(parameters)
local energy = {sum = 0, peaks = 0, checksum = 0}
local energyAlias = energy
pipeline:meter(function(sample, time)
    energyAlias.sum += math.abs(sample)
    energyAlias.checksum = (energyAlias.checksum * 29 + sample + time) % 1000003
    if math.abs(sample) >= 700 then
        energyAlias.peaks += 1
    end
end)
local eventReaders = {}
for eventIndex = 1, 5 do
    local time = eventIndex * 11 - 3
    local calls = 0
    pipeline:automate(time, function(p, actualTime)
        calls += 1
        p.gain = 5 + (eventIndex + mode) % 8
        p.feedback = (eventIndex + seed) % 6
        p.bypass = eventIndex == 3 and mode > 1
        p.parallel = eventIndex % 2 == 0
        log("event", actualTime, tostring(eventIndex) .. "," .. tostring(p.gain) .. "," .. tostring(p.feedback))
    end)
    eventReaders[eventIndex] = function()
        return eventIndex, calls
    end
end
local source = {}
local randomState = (seed % 997) + 1
for time = 1, 67 + mode do
    randomState = (randomState * 109 + 89) % 65521
    local sample = randomState % 3001 - 1500
    if time % 9 == 0 then
        sample = 0
    elseif time % 13 == 0 then
        sample = -sample
    end
    source[#source + 1] = sample
end
local cursor = 1
local blockIndex = 0
while cursor <= #source do
    blockIndex += 1
    local blockSize = 1 + (blockIndex * 7 + mode) % 12
    local block = {}
    for _ = 1, blockSize do
        if cursor > #source then
            break
        end
        block[#block + 1] = source[cursor]
        cursor += 1
    end
    local sum = pipeline:process(block)
    log("block", blockIndex, tostring(#block) .. "," .. tostring(sum))
end
automationAlias.wet = 8
local tail = {}
for i = 1, 18 do
    tail[i] = 0
end
log("tail", #tail, pipeline:process(tail))
for index, reader in ipairs(eventReaders) do
    local captured, calls = reader()
    assert(captured == index and calls == 1, "automation capture or scheduling changed")
end
local states = {}
for _, node in ipairs(pipeline.nodes) do
    assert(node.calls == pipeline.time, "node skipped state advance")
    states[#states + 1] = node.name .. "=" .. tostring(node.state) .. "/" .. tostring(node.calls)
end
print("streaming-audio", seed, mode, pipeline.time, energy.sum, energy.peaks, energy.checksum)
print(table.concat(states, ","))
print(table.concat(pipeline.output, ","))
print(table.concat(trace, "|"))
