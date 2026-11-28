-- Project-authored: calls and captured writes cannot be consumed as a pure guard.
local function exercise(first, final)
    local cell = 4
    local saved = cell
    local reader = function() return cell end
    local effects = {}
    local function condition()
        cell += 3
        effects[#effects + 1] = "condition"
        return final
    end
    if first or condition() then
        effects[#effects + 1] = "body"
        print("selected", saved, reader())
    end
    print("state", first, final, saved, reader(), table.concat(effects, "/"))
end
exercise(true, true)
exercise(false, true)
exercise(false, false)
local function nested(flag, value)
    local callbacks = {}
    if flag or value > 0 then
        for index = 1, value do
            local cell = index
            callbacks[#callbacks + 1] = function() cell += 1 return cell end
        end
    end
    for _, callback in callbacks do print("nested", callback(), callback()) end
end
nested(false, 3)
nested(true, 2)
nested(false, 0)
