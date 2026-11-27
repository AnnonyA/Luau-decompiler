local prior = string.format("%s:%d", "before", 7)
local data = {[""] = #prior, key = prior, [2] = 19}
local alias = data
print(type(data), data[""], data.key, data[2], alias == data)
