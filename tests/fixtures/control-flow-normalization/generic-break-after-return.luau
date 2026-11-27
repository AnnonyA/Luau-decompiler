local function firstMatch(values, target, cancelled)
    local result
    for index, value in values do
        if value == target then
            result = index
            if cancelled then
                return
            end
            break
        end
    end
    if result == nil then
        return "missing"
    end
    return result
end

local function observe(...)
    print(select("#", ...), ...)
end

observe(firstMatch({4, 9, 4, 9}, 9, false))
observe(firstMatch({4, 9, 4, 9}, 9, true))
observe(firstMatch({4, 9}, 2, false))
observe(firstMatch({}, 9, false))
