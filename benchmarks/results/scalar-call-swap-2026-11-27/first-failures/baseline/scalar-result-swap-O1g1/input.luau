local original = 1.75
local chosen = math.min(-0.5, original)
chosen, original = original, chosen
print("swap", chosen, original, -chosen)
local count = 0
while count < 2 do
    count += 1
    chosen /= 2
end
print("after", chosen, original)
