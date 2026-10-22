local seed = tonumber(...) or 1
local tokens = {"(", "2", "+", "(", tostring(seed), "+", "3", ")", ")"}
local cursor, visits = 1, 0
local parse
parse = function()
    visits += 1
    local token = tokens[cursor]
    cursor += 1
    if token == "(" then
        local left = parse()
        local op = tokens[cursor]
        cursor += 1
        local right = parse()
        local close = tokens[cursor]
        cursor += 1
        if op ~= "+" or close ~= ")" then return -999 end
        return left + right
    end
    return tonumber(token) or 0
end
print("parse", parse(), cursor, visits)
