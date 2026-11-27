local turns = 0
local trace = {}
local saved = {}
repeat
    turns += 1
    local cell = turns * 7
    saved[turns] = function(delta)
        cell += delta
        return cell, nil, turns
    end
    table.insert(trace, "body:" .. turns)
until turns >= 3 or ((type(0 / 0) == "boolean") and ((0 / 0) or false) or (false or nil))
print(turns, table.concat(trace, "|"))
print(select("#", saved[1](0)), saved[1](2))
print(saved[3](5))
return turns, nil, saved[1](1)
