local object = {count = 0, jobs = {}}
function object:add(id, dependencies, priority, callback)
    self.jobs[id] = {state = "done", score = callback(priority)}
end
for phase = 1, 2 do
    for domain = 1, 3 do
        local id = "d" .. tostring(domain) .. "-" .. tostring(phase)
        local dependencies = {}
        if phase > 1 then dependencies[1] = tostring(phase - 1) end
        object:add(id, dependencies, domain + phase, math.abs)
    end
end
local steps, clock = object:add("last", {}, 3, math.abs)
local score, count = 0, 0
for domain = 1, 3 do
    local job = object.jobs["d" .. tostring(domain) .. "-2"]
    assert(job.state == "done", "unfinished")
    score += job.score
    count += 1
    print(domain, score, count)
end
