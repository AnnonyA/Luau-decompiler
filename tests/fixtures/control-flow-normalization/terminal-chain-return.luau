local function scan(records, expected)
    local position = 0
    local visits = {}
    while position < #records do
        position += 1
        local item = records[position]
        if not (item.left == expected.left and item.right == expected.right) then
            local result = { item }
            local remaining = position
            while remaining > 0 do
                table.insert(result, records[remaining])
                remaining -= 1
            end
            return result, position
        end
        for _, label in { "read", "accepted" } do
            visits[#visits + 1] = label
        end
    end
    return nil, position
end

local records = { { left = 1, right = 2 }, { left = 3, right = 4 } }
for _, expected in { records[1], records[2], { left = 9, right = 9 } } do
    local result, count = scan(records, expected)
    print("scan", if result then #result else 0, count)
end
