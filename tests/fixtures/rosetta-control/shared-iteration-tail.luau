local cursor = 0
local level = 0
local observed = {}
while cursor < 8 do
    if cursor == 1 then
        level += 1
    elseif cursor == 3 then
        level -= 1
        if level < 0 then error("negative nesting") end
    elseif cursor % 2 == 0 and level == 0 then
        observed[#observed + 1] = cursor
    else
        cursor += 1
        continue
    end
    cursor += 1
end
print(cursor, level, table.concat(observed, ","))
