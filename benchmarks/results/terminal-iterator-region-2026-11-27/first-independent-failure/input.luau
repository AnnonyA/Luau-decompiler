local calls = 0
local function step(state, previous)
    calls += 1
    if previous == nil and state[1] ~= nil then
        return 1, state[1]
    end
    return nil
end

local function choose(left, right)
    local result = left
    if -(left + right) ~= -(left - right) then
        result += right
        for key, value in step, {8} do
            break
        end
    end
    return result, nil
end

local functions = {choose}
print(functions[1](3, 2))
print(calls)
print(functions[1](3, 0))
print(calls)
