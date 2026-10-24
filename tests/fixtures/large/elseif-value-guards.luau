local function choose(kind, x, y)
    local result
    if kind == 'sum' then
        if x == 0 then result = y
        elseif y == 0 then result = x
        elseif x == y then result = 2 * x
        elseif y < x then result = y + x + 1
        else result = x + y + 2 end
    elseif kind == 'product' then
        if x == 0 or y == 0 then result = 0
        elseif x == 1 then result = y
        elseif y == 1 then result = x
        else result = x * y end
    else
        result = x - y
    end
    return result
end
for _, kind in ipairs({'sum', 'product', 'difference'}) do
    for _, x in ipairs({0, 1, 3, 7}) do
        for _, y in ipairs({0, 1, 3, 8}) do
            print(kind, x, y, choose(kind, x, y))
        end
    end
end
