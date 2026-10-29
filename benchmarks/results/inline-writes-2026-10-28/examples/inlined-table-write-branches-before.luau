local first = ...
local _ = tonumber
local value = tonumber(first) or 4
local config = {}
for index = -2, 2 do
    local function classify(value2, index2)
        index2[1] = value2 * 2 + index
        if value2 < -1 then
            index2.kind = -1
            index2.output = value2 * 3 + index
            return
        elseif value2 > 2 then
            index2.kind = 1
            index2.output = value2 * 7 - index
            return
        else
            index2.kind = 0
            index2.output = value2 * value2 + index
        end
    end

    for j = -3, value do
        config[1] = j * 2 + index
        if j < -1 then
            config.kind = -1
            config.output = j * 3 + index
        elseif j > 2 then
            config.kind = 1
            config.output = j * 7 - index
        else
            config.kind = 0
            config.output = j * j + index
        end
        print(index, j, config[1], config.kind, config.output)
    end
end
print("complete", config[1], config.kind, config.output)
