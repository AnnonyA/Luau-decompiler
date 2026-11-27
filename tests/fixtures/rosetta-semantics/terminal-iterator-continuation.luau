local function inspect(items, adjust)
    for _, item in items do
        break
    end
    local record = {#items, 23}
    local read = function() return record end
    table.insert(record, -math.abs(record[2]))
    if adjust then
        local count = 0
        while count < 2 and not rawequal(0 / 0, true) do
            count += 1
        end
    elseif #items > 9 then
        print("many")
    else
        local compared = #items >= 0
    end
    return record[1], record[2], record[3], read() == record
end

print(inspect({}, true))
print(inspect({4, 8}, true))
print(inspect({6}, false))
