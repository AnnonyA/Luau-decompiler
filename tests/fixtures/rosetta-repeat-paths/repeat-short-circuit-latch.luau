local turns = 0
local trace = {}
local function observe(delta)
    turns += delta
    return turns, nil, #trace
end
repeat
    turns += 1
    for inner = 1, 2 do
        table.insert(trace, turns * 10 + inner)
    end
until turns >= 3 or ((type(0 / 0) == "boolean") and ((0 / 0) or false) or (false or nil))
print(turns, table.concat(trace, ","))
print(select("#", observe(0)), observe(1))
return observe(2)
