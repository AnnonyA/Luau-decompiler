local captured = ...
local function factory()
    return function(step)
        captured.count += step
        return captured
    end
end
return factory()
