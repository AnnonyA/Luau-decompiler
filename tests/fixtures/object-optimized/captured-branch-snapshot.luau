local function scenario(initial, flag)
    local cell = initial
    local function read()
        return cell
    end
    local snapshot = cell
    if flag then
        cell = initial + 3
    else
        cell = initial - 2
    end
    return snapshot, cell, read()
end
local first = ...
local start = tonumber(first) or 5
for index = start, start + 3 do
    print("true", scenario(index, true))
    print("false", scenario(index, false))
end
