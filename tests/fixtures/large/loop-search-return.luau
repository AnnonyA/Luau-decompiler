local function search(current, key, fallback)
    while current do
        local value = current.values[key]
        if value ~= nil then
            return value
        end
        current = current.parent
    end
    return fallback
end
local base = {values = {width = 12, enabled = false}}
local leaf = {values = {color = 'red'}, parent = base}
print(search(leaf, 'width', -1), search(leaf, 'enabled', true))
print(search(leaf, 'color', 'none'), search(leaf, 'missing', 'fallback'))
print(search(nil, 'width', 99))
