local captured = ...
local function factory()
    return function() return captured end
end
return factory(), factory()
