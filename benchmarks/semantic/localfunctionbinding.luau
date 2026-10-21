local function run(value)
    local function outer() return value end
    do
        local outer = function() return outer() end
        return outer()
    end
end
print(run(7), run(-2))
