local object = setmetatable({}, {
    __concat = function(left, right)
        print("concat", typeof(left), typeof(right))
        return "joined"
    end,
    __tostring = function()
        print("tostring")
        return "object"
    end,
})
local function render(value)
    return "value:" .. value
end
print("metamethod", render(object))
local okay = pcall(render, true)
print("boolean", okay)
print("number", render(12))
print("string", render("text"))
