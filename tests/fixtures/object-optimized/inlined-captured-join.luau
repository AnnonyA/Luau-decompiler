local value = 0
local function read()
    return value
end
local readers = {read}
local first = ...
local limit = tonumber(first) or 4
for index = 1, limit do
    if index % 2 == 0 then
        value += index
    else
        value -= index
    end
    value += 2
    value *= 3
    print("joined", index, readers[1](), value)
end
print("final", readers[1]())
