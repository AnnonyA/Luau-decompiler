local flag = ... ~= 'false'
local function factory()
    return function(value) return value + 1 end
end
local first = factory()
local second
if flag then second = factory() else second = first end
print(first == second, first(3), second(7))
