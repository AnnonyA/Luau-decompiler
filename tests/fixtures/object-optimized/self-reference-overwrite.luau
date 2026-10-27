local function named()
    local object = {}
    object.self = object
    object.self = 9
    return object.self
end
local function indexed()
    local object = {}
    object[1] = object
    object[1] = 11
    return object[1]
end
local function computed(key)
    local object = {}
    object[key] = object
    object[key] = 13
    return object[key]
end
print(named(), indexed(), computed("self"))
