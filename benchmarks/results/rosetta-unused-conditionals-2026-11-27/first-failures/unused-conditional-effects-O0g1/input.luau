local trace = {}
local count = 0
local function observe(value)
    count += 1
    table.insert(trace, tostring(value))
    return value, nil, trace
end
local function reader()
    return count, nil, trace
end
local turn = 0
while turn < 2 do
    turn += 1
    if observe(turn) // 2 >= 0 then
    end
end
local chosen = (observe(false) and nil or false)
if observe(4) * 2 ~= 0 then
elseif observe(5) then
end
local other = if (observe(false) and nil or false) then "yes" else "no"
print(table.concat(trace, ","), count, chosen, other)
print(select("#", reader()), reader())
print(select("#", observe(6)), reader())
