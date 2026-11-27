local config = {}
local search = function(node, wanted)
    while node do
        if node.tag == wanted then
            break
        end
        local snapshot = node
        node = node.parent
        continue
    end
    table.insert(config, "absent")
    return false, nil, nil
end
local choose = function(items)
    for _, value in items do
        if value == 3 then
            break
        end
        if value == 7 then
            break
        end
        table.insert(config, "step")
        continue
    end
    table.insert(config, "exhausted")
    return 0, nil, nil
end
local field = search
local field2 = choose
local config2 = { field, field2 }
local config3 = { tag = "root" }
local config4 = { tag = "leaf", parent = config3 }
local a, b, c = (if true then config2[1] else nil)(config4, "root")
local print2 = print
local result = c == config3
local select2 = select
print2(a, b, result, select2("#", (if true then config2[1] else nil)(config4, "missing")))
local value2 = config2[2]
local config5 = { 1, 3, 7 }
local value, gap, read = (if true then value2 else nil)(config5)
local print3 = print
local result2 = read
if result2 then
    result2 = read()
end
local select3 = select
local value3 = config2[2]
local config6 = { 7 }
print3(value, gap, result2, select3("#", (if true then value3 else nil)(config6)))
local print4 = print
local value4 = config2[2]
local config7 = { 1, 2 }
print4((if true then value4 else nil)(config7))
local print5 = print
print5(table.concat(config, ","))
