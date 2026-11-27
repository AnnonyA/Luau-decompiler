local function makeCounter(start)
    local handler
    local count = start
    handler = function(step)
        count += step
        if step < 1 then return count end

        local previous = handler
        handler = function(delta)
            count *= 2
            return count + delta
        end
        return previous(step - 1), handler(step)
    end
    return handler
end

local counter = makeCounter(3)
print(counter(3))
print(counter(1))
