local replacementCalls = 0
vector = {
    create = function(...)
        replacementCalls += 1
        return "replacement"
    end,
}
local value = customVector(1, 2, 3, 4)
print(typeof(value), tostring(value), replacementCalls)
