local function call(callback)
    return callback()
end
local function values() return 7, nil, 9 end
local a, b, c = call(values)
print(a, tostring(b), c)
print(select("#", call(values)))
