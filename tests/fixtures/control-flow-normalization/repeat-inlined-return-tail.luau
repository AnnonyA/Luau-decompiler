local function scan(values)
    local count = 0
    repeat
        count += 1
        if cancelSearch then
            return
        end
        local value = values[count]
    until value == nil or value < 0
    return count
end

print(scan({2, 7, -4, 11}), scan({}))
