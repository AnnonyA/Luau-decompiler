local function absolute(size, position)
    return position < 0 and size + position + 1 or position
end

local function bounds(items, first, last)
    first = first and absolute(#items, first) or 1
    last = last and absolute(#items, last) or #items
    return first, last
end

print(bounds({10, 20, 30, 40}, 2, 3))
print(bounds({10, 20, 30, 40}, -2, -1))
print(bounds({10, 20, 30, 40}, nil, 3))
print(bounds({10, 20, 30, 40}, false, 0))
