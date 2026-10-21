local function render(value)
    return "(" .. value .. ")"
end
print(render(0), render(-2), render(1.5), render(1000000))
local okay = pcall(render, nil)
print(okay)
