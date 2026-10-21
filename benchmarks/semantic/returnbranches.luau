local function many()
    return 11, 22
end
local function choose(flag)
    if flag then
        return many()
    else
        return 0
    end
end
print("true", select("#", choose(true)), choose(true))
print("false", select("#", choose(false)), choose(false))
