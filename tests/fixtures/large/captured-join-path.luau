local function joinPath(parent, name)
    if parent == '/' then return parent .. name end
    return parent .. '/' .. name
end
local function build(parts)
    local current = '/'
    local observers = {}
    for _, name in ipairs(parts) do
        current = joinPath(current, name)
        local ok, value = pcall(function() return current end)
        print(ok, value)
        table.insert(observers, function() return current end)
    end
    for _, observer in ipairs(observers) do print(observer()) end
end
build({'alpha', 'beta', 'gamma'})
build({'one'})
