-- Project-owned differential: independently mutable reference captures.
-- Alternating calls must not merge captured storage or replay mutations.
local function counter(initial)
    local total = initial
    return function(change)
        if change == 0 then
            return total
        end
        total += change
        return total
    end
end

local first = counter(2)
local second = counter(10)
print("capture", first(3), second(2), first(0), second(-1), first(-4), second(0))
