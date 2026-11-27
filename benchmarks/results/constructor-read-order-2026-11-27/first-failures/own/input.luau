local cell = 10
local trace = {}
local function advance(amount)
    cell += amount
    table.insert(trace, tostring(cell))
    return cell, nil, cell + 100
end
local function reader()
    return cell, nil, trace
end
local first = {cell, advance(2), cell}
local second = {cell, advance(3), cell, advance(4), cell}
local open = {before = cell, cell, advance(5)}
print(first[1], first[2], first[3])
print(second[1], second[2], second[3], second[4], second[5])
print(open.before, open[1], open[2], open[3], open[4])
print(table.concat(trace, ","), select("#", reader()), reader())
print(select("#", advance(1)), reader())
