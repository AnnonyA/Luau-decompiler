local trace, a, b, c = {}, {}, {}, {}
local function many(label)
    table.insert(trace, "many:" .. label)
    return label, label .. "-extra", nil
end
local function none()
    table.insert(trace, "none")
end
local function fill(left, middle, right)
    left.value, middle.value, right.value = many("first"), many("second"), none()
end
fill(a, b, c)
print(table.concat(trace, "|"), a.value, b.value, c.value, select("#", a.value, b.value, c.value))

local closures, records = {}, {}
for index = 1, 4 do
    local current = { id = index }
    local function read()
        return current, current.id, nil
    end
    local function save(left, right, value, reader)
        left[1], right[1] = value, reader
    end
    local left, right = {}, {}
    save(left, right, current, read)
    table.insert(records, left[1])
    table.insert(closures, right[1])
    current.id += 10
end
for index, reader in closures do
    local record, id, missing = reader()
    print(index, record == records[index], id, missing, select("#", reader()))
end
print(closures[1] == closures[2], records[1] == records[2])
