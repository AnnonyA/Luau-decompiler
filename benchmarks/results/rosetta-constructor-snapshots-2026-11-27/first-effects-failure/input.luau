local trace = {}
local function emit(label, ...)
    trace[#trace + 1] = label
    return ...
end
local tag = ("TAG"):lower()
print(tag)
local result = {
    (emit("first", "start", "discard")),
    tag = tag,
    {7, "nested"},
    (emit("middle", 8, "discard")),
    emit("tail", 9, nil, 11),
}
print(table.concat(trace, ","))
tag = ("LATER"):lower()
print(tag)
print(result[1], result.tag, type(result[2]), result[3], result[4], result[5], result[6])
print(result[2][1], result[2][2], table.concat(trace, ","))
local alias = result
result[2][1] = 13
print(alias == result, alias[2][1])
