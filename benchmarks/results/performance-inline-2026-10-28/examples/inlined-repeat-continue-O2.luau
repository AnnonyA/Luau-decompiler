local first = ...
for index = 1, 3 do
    repeat
        if first then
            continue
        end
        local function weighted(seed)
            return (seed * 7 + 3) % 97
        end

        print(weighted(index))
    until (index * 7 + 3) % 97 > 0
end
local value2: string = "completed"
local result = first ~= nil
print(value2, result)
