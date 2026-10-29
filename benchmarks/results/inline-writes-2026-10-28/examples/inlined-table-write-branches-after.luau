local first = ...
local _ = tonumber
local value = tonumber(first) or 4
local config = {}
for index = -2, 2 do
    local function classify(j2, index2)
        index2[1] = j2 * 2 + index
        if j2 < -1 then
            index2.kind = -1
            index2.output = j2 * 3 + index
            return
        elseif j2 > 2 then
            index2.kind = 1
            index2.output = j2 * 7 - index
            return
        else
            index2.kind = 0
            index2.output = j2 * j2 + index
        end
    end

    for j = -3, value do
        classify(j, config)
        print(index, j, config[1], config.kind, config.output)
    end
end
print("complete", config[1], config.kind, config.output)
