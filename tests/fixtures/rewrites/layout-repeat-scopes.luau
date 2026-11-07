local argument = ...
local limit = math.max(1, tonumber(argument) or 3)
local count = 0
local trace = {}
local function fetch()
    count += 1
    local object = {done = count >= limit, index = count}
    function object:method()
        table.insert(trace, self.index)
        return {value = self.index}
    end
    return object
end
repeat
    local gui = fetch()
    local panel = gui:method()
    print("receiver", panel.value)
until gui.done
count = 0
repeat
    local gui = fetch()
    local panel = gui:method()
    print("captured-receiver", panel.value)
until (function() return gui.done end)()
count = 0
repeat
    local folder = fetch()
    local group = {folder = folder, entries = {}}
    local categories = {First = group}
    print("table", categories.First.folder.index)
until group.folder.done
count = 0
repeat
    local folder = fetch()
    local group = {folder = folder, entries = {}}
    local categories = {First = group}
    print("captured-table", categories.First.folder.index)
until (function() return group.folder.done end)()
print("trace", table.concat(trace, ","))
