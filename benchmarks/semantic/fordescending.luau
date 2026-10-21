local function countdown(n)
    local out = ""
    for i = n, 1, -1 do out = out .. tostring(i) end
    return out
end
print(countdown(0), countdown(1), countdown(4))
