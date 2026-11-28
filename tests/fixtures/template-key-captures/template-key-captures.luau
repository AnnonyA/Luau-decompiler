local function choose(key)
    return { ready = function() return 1 end, [key] = function() return 2 end }
end
local same, different = choose("ready"), choose("other")
print(same.ready(), different.ready(), different.other())
print(debug.info(same.ready, "n"), debug.info(different.ready, "n"), debug.info(different.other, "n"))
local function many()
    return nil, 4, 5
end
local erased = { ready = function() return 9 end, ["ready"] = many() }
print(erased.ready, select("#", erased.ready))
erased.alpha = 1
erased.beta = 2
erased.gamma = 3
local keys = {}
for key in erased do
    table.insert(keys, key)
end
print(table.concat(keys, ","), #erased)
local saved = {}
for index = 1, 3 do
    local record = {}
    record.ready = function() return record, index end
    local first = record.ready
    record["ready"] = function() return record, index + 10, nil end
    table.insert(saved, { record, first, record.ready })
end
for _, group in saved do
    local firstRecord, firstIndex = group[2]()
    local secondRecord, secondIndex = group[3]()
    print(group[1] == firstRecord, firstRecord == secondRecord, firstIndex, secondIndex,
        group[2] == group[3], select("#", group[3]()), debug.info(group[2], "n"), debug.info(group[3], "n"))
end
print(saved[1][1] == saved[2][1])
