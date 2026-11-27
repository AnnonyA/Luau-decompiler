local function locate(values, wanted)
    local index = 0
    local found = false
    repeat
        index += 1
        if values[index] == wanted then
            found = true
            break
        end
    until index >= #values
    return found, index
end
print(locate({4, 9, 16, 25}, 9))
print(locate({4, 9, 16, 25}, 30))
