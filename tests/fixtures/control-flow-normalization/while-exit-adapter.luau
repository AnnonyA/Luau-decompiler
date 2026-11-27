local function consume(value)
    local count = 0
    while value do
        count += 1
        value = nil
    end
    return count, value
end

print(consume(""))
print(consume(false))
