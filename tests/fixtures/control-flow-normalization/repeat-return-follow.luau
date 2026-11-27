local function scan(values, cancelled)
    local count = 0
    repeat
        count += 1
        if cancelled then
            return
        end
        local value = values[count]
    until value == nil or value < 0
    return count
end

local function observe(...)
    print(select("#", ...), ...)
end

observe(scan({2, 7, -4, 11}, false))
observe(scan({}, false))
observe(scan({2, 7}, true))
