local environment = getfenv()
local trace = {}
local old = function(...) print("old", select("#", ...), ...) end
local new = function(...) print("new", select("#", ...), ...) end
environment.destination = old
local function change()
    trace[#trace + 1] = "change"
    environment.destination = new
    return 7, 9
end
destination(change(), 4)
destination(change())
local object = {method = old}
local function replace()
    trace[#trace + 1] = "replace"
    object.method = new
    return 11, 13
end
object.method(replace(), 5)
object.method(replace())
print(table.concat(trace, ","))
