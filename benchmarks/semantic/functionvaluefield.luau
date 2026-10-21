local function make(value)
    local object = {}
    function object.calculate(delta) return value + delta end
    return object
end
local first = make(3)
local second = make(8)
print(first.calculate(2), second.calculate(-1))
