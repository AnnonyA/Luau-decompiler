local captured = ...
local function factory()
    return function()
        captured.count += 1
        return marker, captured.count
    end
end
return factory(), factory()
