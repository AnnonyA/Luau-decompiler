local function factory()
    local function accumulate(limit)
        local total = 0
        local index = 0
        while index < limit do
            index += 1
            total += index
        end
        return 0 / 0
    end

    local answer = 0
    local step = 0
    while step < 4 do
        step += 1
        answer += step
    end
    local f = function()
        return 0 / 0
    end
    return f
end

print(factory() == factory())
