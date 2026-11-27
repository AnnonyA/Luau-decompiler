local calls = 0
local function check(value)
    calls += 1
    print("check", calls, value)
    return value
end

local function choose(first, second)
    print((first and check(second)) or (second and check(3)) or check(4))
end

choose(false, true)
choose(true, false)
choose(true, nil)
print("total", calls)
