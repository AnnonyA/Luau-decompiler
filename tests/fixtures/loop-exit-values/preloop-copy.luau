local current = "value:" .. tostring(false)
local original = current
local iteration = 0
while iteration < 2 do
    iteration += 1
    current ..= original
    print(iteration, original, current)
end
print("after", original, current)
