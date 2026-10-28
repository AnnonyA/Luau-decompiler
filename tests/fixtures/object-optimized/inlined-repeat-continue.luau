local skip = ...
for index = 1, 3 do
    repeat
        if skip then
            continue
        end
        local function weighted(value)
            return (value * 7 + 3) % 97
        end
        print(weighted(index))
    until (index * 7 + 3) % 97 > 0
end
print("completed", skip ~= nil)
