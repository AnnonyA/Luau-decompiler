local sources = {
[=[local key, captured = ...
local function read()
    return captured
end
return { [key] = 1, read = read }
]=],
[=[local key, captured = ...
return { [key] = 1, read = function()
    return captured
end }
]=],
}
for _, source in sources do
    local make = assert(loadstring(source))
    local ok = pcall(make, nil, 1)
    local a, b, c = make("ok", 2).read, make("ok", 2).read, make("ok", 1).read
    print(ok, a == b, a(), b(), c(), a == c)
end
