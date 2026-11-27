local calls = 0
local factories = {function()
    calls += 1
    return calls
end}
local value = factories[1]()
value = value + value
print(value, calls)
