local n = tonumber(...) or 0
local function test(a, b)
    local x, y
    if a < 0 then
        if b then x, y = a * 3, 9 else x, y = 4, -a end
    elseif b then
        x, y = a + 2, a - 1
    else
        x, y = 7, a + 5
    end
    print("selected", x, y)
    for i = 1, 2 do
        if i % 2 == 0 then x += y else y -= x end
    end
    return x, y
end
print("true", test(n, true))
print("false", test(n, false))
