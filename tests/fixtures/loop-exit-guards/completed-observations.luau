-- Completed control; initial observations.luau and its original failures remain sealed.
local trace = {}
local function mark(name, value)
    table.insert(trace, name)
    return value, nil, "extra"
end
local saved = {}
local picked = -1
for i = 1, 5 do
    if mark("left" .. i, i > 1) and mark("right" .. i, i == 3) then
        local value = i
        saved[#saved + 1] = function() return value end
        picked = i
        break
    end
end
print("pick", picked, saved[1](), saved[1] == saved[1], table.concat(trace, ","))

trace = {}
local function pack(value)
    table.insert(trace, "pack" .. value)
    return value, nil, value + 1, nil
end
local function selectItem(items)
    for _, item in items do
        if mark("try" .. item, item > 2) then
            table.insert(trace, "chosen" .. item)
            return pack(item)
        end
    end
    return false
end
local function report(...)
    print(select("#", ...), ...)
end
report(selectItem({1, 2, 4, 8}))
report(selectItem({1, 2}))
print(table.concat(trace, ","))

trace = {}
local i = 0
local value = "outside"
while i < 5 do
    i += 1
    if mark("while" .. i, i == 2) then
        local value = "inside"
        table.insert(trace, value)
        break
    end
end
print(i, value, table.concat(trace, ","))

trace = {}
local count = 0
repeat
    count += 1
    if mark("repeat" .. count, count == 2) then
        table.insert(trace, "stopped")
        break
    end
until mark("until" .. count, count == 4)
print(count, table.concat(trace, ","))

trace = {}
local ordering = {__lt = function(_, other)
    table.insert(trace, "compare" .. other.n)
    return other.n == 2
end}
local a = setmetatable({}, ordering)
for n = 1, 3 do
    if a < setmetatable({n = n}, ordering) then
        table.insert(trace, "ordered")
        break
    end
end
local nan = 0 / 0
for n = 1, 2 do
    if not (nan < n) then
        table.insert(trace, "nan")
        break
    end
end
print(table.concat(trace, ","))

trace = {}
local found = nil
for i = 1, 4 do
    if i == 3 then
        local cell = i
        found = function() return cell end
        table.insert(trace, "captured" .. cell)
        break
    end
end
print(found(), table.concat(trace, ","))
local function directReturn(items)
    for _, item in items do
        if item == 2 then
            table.insert(trace, "direct")
            return pack(item)
        end
    end
    return false
end
report(directReturn({1, 2, 3}))
print(table.concat(trace, ","))
