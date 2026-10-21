local function make(start)
    local value = start
    return function(delta)
        value += delta
        return value
    end
end
local nextA = make(5)
local nextB = make(-2)
print(nextA(1), nextB(3), nextA(4), nextB(-1))
