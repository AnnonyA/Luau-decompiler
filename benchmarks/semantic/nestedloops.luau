local total = 0
for outer = 1, 3 do
    for inner = 1, 2 do
        total += outer * inner
    end
end
print("nestedloops", total)
