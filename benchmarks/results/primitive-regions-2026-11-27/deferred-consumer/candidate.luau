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

    local inlineResult = accumulate(4)
    local f = function()
        return inlineResult
    end
    return f
end

print(factory() == factory())
