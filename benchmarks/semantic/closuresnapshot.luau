local function make()
    local box = {value = 7}
    local saved = box.value
    local function read() return saved end
    box.value = 9
    return read
end
print(make()())
