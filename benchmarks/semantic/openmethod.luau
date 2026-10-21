local object = {}
function object:observe(...)
    print("method", select("#", ...), ...)
end
local function many()
    return 1, 2
end
object:observe(many())
