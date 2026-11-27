local calls = 0
local functions = {function()
    calls += 1
    return
end}
local function observe(...)
    print("arity", select("#", ...), ...)
end
local empty = functions[1]()
empty = empty and empty
observe(empty)
local another = functions[1]()
another = another or another
observe(another)
observe(functions[1]())
print("calls", calls)
