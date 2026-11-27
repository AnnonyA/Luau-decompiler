local calls = 0
local function advance(limit, index)
    calls += 1
    index += 1
    if index <= limit then
        return index, index * 3
    end
end

local function inspect(limit, adjust)
    for key, value in advance, limit, 0 do
        break
    end
    local record = {limit, calls}
    if adjust then
        local count = 0
        while count < 2 and not rawequal(0 / 0, true) do
            count += 1
        end
    else
        local ignored = limit >= 0
    end
    return record[1], record[2], calls
end

print(inspect(0, true))
print(inspect(5, true))
print(inspect(2, false))
