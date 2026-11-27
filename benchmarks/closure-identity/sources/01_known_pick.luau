local function pick(flag)
    local selected
    if flag then
        selected = function(x) return x + 10 end
    else
        selected = function(x) return x - 5 end
    end
    return selected
end

local first = pick(true)
local second = pick(false)
print(first(2), second(9), first == pick(true), second == pick(false))
