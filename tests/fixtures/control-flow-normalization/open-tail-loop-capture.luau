local function choose(limit)
    local saved
    for index = 1, limit do
        local square = index * index
        if square > 8 then
            saved = function()
                return square
            end
            break
        end
    end
    return "selected", saved()
end

print(choose(8))
print(choose(5))
