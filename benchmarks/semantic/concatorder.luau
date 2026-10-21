local object = setmetatable({}, {
    __concat = function(left, right)
        print("concat", type(left), type(right))
        return "joined"
    end,
})
print("result", object .. object .. object)
