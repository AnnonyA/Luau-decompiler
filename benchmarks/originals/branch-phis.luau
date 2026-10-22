local seed = tonumber(...) or 1
local function choose(a, b)
    local x, y
    if a > 0 then
        if b then x, y = a + 3, a * 2 else x, y = a - 3, 7 end
    elseif a == 0 then
        x, y = 10, 20
    else
        x, y = -a, a - 1
    end
    for i = 1, 3 do
        if (x + i) % 2 == 0 then x += y else y -= i end
    end
    return x, y, x > y and "x" or "y"
end
print("positive", choose(seed, true))
print("alternate", choose(seed, false))
print("zero", choose(0, true))
print("negative", choose(-seed - 1, false))
