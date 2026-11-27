local settings = {count = 7}
local function make()
    return function() return settings.count end
end
local first = make()
local selected
if ... == "left" then
    settings.count += 1
    selected = make()
else
    settings.count += 2
    selected = make()
end
local keys = {[first] = "first"}
keys[selected] = "selected"
print(first == selected, keys[first], keys[selected], first(), selected())
