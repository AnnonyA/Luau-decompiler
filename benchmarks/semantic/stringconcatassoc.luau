local function render(a, b, c)
    return (a .. b) .. c, a .. (b .. c)
end
print(render("a", "b", "c"))
print(render(1, 2, 3))
print(render("", "x", ""))
