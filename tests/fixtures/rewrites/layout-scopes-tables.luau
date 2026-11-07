local argument = ...
local value = tonumber(argument) or 2
local trace = {}
local function observe(label, item)
    table.insert(trace, label .. ":" .. tostring(item))
end
local folder = {name = "stable"}
local group = {folder = folder, entries = {}, total = 0}
observe("between", value)
local categories = {First = group, Other = {folder = folder, entries = {}, total = 0}}
local changing = {name = "before"}
local snapshot = {folder = changing, entries = {}}
changing = {name = "after"}
local preserved = {Snapshot = snapshot, Current = changing}
local shadow = {name = "outer"}
local child = {folder = shadow}
local shadow = {name = "inner"}
local shadowed = {Child = child, Current = shadow}
local function refresh(ready)
    if not ready then
        return "stopped"
    else
        local item = value * 3
        local function read()
            return item
        end
        observe("initial", read())
        item += 1
        return read
    end
end
local function retainOuter(ready)
    local item = "outer"
    if not ready then
        return item
    else
        local item = "inner"
        observe("branch", item)
    end
    return item
end
local callback = refresh(value > 0)
print("refresh", if type(callback) == "function" then callback() else callback, retainOuter(value > 0))
print("tables", categories.First.folder == categories.Other.folder,
    preserved.Snapshot.folder.name, preserved.Current.name, shadowed.Child.folder.name, shadowed.Current.name)
for index, event in trace do
    print(index, event)
end
