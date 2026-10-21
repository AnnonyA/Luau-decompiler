local function make(scale)
    local function sum(n)
        if n <= 0 then return 0 end
        return scale * n + sum(n - 1)
    end
    return sum
end
local two = make(2)
local three = make(3)
print(two(0), two(3), three(2))
