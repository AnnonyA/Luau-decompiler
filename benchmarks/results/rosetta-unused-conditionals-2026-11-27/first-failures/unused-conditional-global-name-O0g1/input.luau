_ = "environment"
local calls = 0
local function observe()
    calls += 1
    return calls, nil, _
end
if observe() > 0 then end
print(_, calls)
print(select("#", observe()), observe())
