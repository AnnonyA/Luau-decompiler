local object = { offset = 10 }
function object:read(delta)
    return self.offset + delta
end
local function choose(flag, value)
    return if flag then object:read(value) else ("value=%d"):format(value)
end
print(choose(true, 4), choose(false, 6))
local function fallback(first, second)
    return first and first:read(3) or second:read(5)
end
print(fallback(object, object), fallback(nil, object))
