local function create(flag)
    local record = {
        callback = if flag then function(value) return value, nil end else function(value) return -value end,
    }
    return record
end
local a, b = create(true), create(false)
print(debug.info(a.callback, "n"), debug.info(b.callback, "n"), a.callback(7), b.callback(7))
print(select("#", a.callback(7)), select("#", b.callback(7)))
local closures, records, current = {}, {}, 0
for index = 1, 3 do
    local record = {}
    record["callback"] = function()
        return record, index, current
    end
    table.insert(closures, record.callback)
    table.insert(records, record)
    current += index
end
current = 20
for index, reader in closures do
    local record, originalIndex, changed = reader()
    print(record == records[index], originalIndex, changed, debug.info(reader, "n"))
end
print(closures[1] == closures[2], records[1] == records[2])
