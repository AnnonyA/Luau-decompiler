local function visit(weights, preferEven)
    local index = 1
    local total = 0
    local trace = {}
    while index <= #weights do
        local weight = weights[index]
        if preferEven and weight % 2 == 0 then
            if weight < 50 then
                trace[#trace + 1] = "even"
                total += weight
                index += 2
            else
                break
            end
        else
            if weight < 40 then
                trace[#trace + 1] = "other"
                total -= weight
                index += 1
            else
                break
            end
        end
    end
    return total, index, table.concat(trace, ",")
end
for _, weights in {{2,3,4,5,6}, {1,4,3,50,5}, {2,1,70}, {40}, {}} do
    print(visit(weights, true))
    print(visit(weights, false))
end
