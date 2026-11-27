local mode = tonumber((...)) or 0
local function makeDriver(gain)
    local distance, active, lastTarget = 0, true, 0
    local function step(dt)
        if not active then return lastTarget end
        distance += dt * gain
        lastTarget = distance
        return lastTarget
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
        while accumulator >= dt do
            step(dt)
            accumulator -= dt
            executed += 1
        end
        return executed, accumulator / dt
    end
end
local driver, stopDriver = makeDriver(3 + mode)
local function step(dt)
    return driver(dt)
end
local advance = fixedClock(step, 0.015625)
for frame = 1, 80 do
    local dt = if frame % 3 == 0 then 0.046875 else 0.015625
    advance(dt)
end
print(stopDriver(), stopDriver())
