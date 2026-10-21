local function render(name, count)
    return `name={name}; count={count}; literal=\{x}; tick=\``
end
print(render("alpha", 3))
print(render("line\nbreak", 0))
