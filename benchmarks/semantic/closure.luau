local function makeAdder(value)
    return function(other)
        return value + other
    end
end
local addTen = makeAdder(10)
print("closure", addTen(3), addTen(-2))
