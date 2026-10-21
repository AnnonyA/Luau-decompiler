local function make(n)
    local functions = {}
    for i = 1, n do
        functions[i] = function() return i end
    end
    return functions
end
local functions = make(3)
print(functions[1](), functions[2](), functions[3]())
