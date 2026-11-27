local function recovered(value, index)
    local result = 0
    if value then
        if index then
            for index2 = 1, 2 do
                result = result + 1
                continue
            end
            return result
        else
            result = 10
        end
    else
        result = 100
    end
    return result
end

print(recovered(true,true), recovered(true,false), recovered(false,true), recovered(false,false))
