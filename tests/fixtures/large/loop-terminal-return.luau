local function compare(left, right)
    for i = 1, #left do
        local a, b = left[i], right[i]
        if a ~= nil and b ~= nil then
            if a < b then return true
            elseif b < a then return false end
        else
            return false
        end
    end
    return true
end
for _, pair in ipairs({{{2, 9}, {2, 3}}, {{1, 2}, {2, 1}}, {{4, 4}, {4, 4}}, {{}, {}}}) do
    print(compare(pair[1], pair[2]))
end
