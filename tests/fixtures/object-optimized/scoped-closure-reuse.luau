local function makeCheck(expected)
    return function(values)
        return values[1] == expected
    end
end

local function makeOrder(offset)
    return function(left, right)
        return left + offset <= right
    end
end

local function exercise(seed)
    local check = makeCheck(3)
    print("check", check({3}), check({seed}))
    local first = makeOrder(seed + 1)
    print("first", first(4, 7), first(7, 4))
    local second = makeOrder(seed - 1)
    print("second", second(4, 7), second(7, 4))
    local third = makeOrder(seed * 2)
    print("third", third(4, 7), third(7, 4))
end

for seed = -3, 4 do
    exercise(seed)
end
