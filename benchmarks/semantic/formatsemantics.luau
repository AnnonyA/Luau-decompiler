local function render(value)
    return string.format("value: %s (100%%)", value)
end
print("string", render("text"))
print("number", render(12))
local okay = pcall(render, true)
print("boolean", okay)
local function shadowed(string)
    return string.format("%s", "text")
end
print("shadowed", shadowed({
    format = function(template, value)
        print("custom format")
        return template, value
    end,
}))
