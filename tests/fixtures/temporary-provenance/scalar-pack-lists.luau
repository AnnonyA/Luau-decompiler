local trace = {}
local function many(mode)
    trace[#trace + 1] = "many:" .. mode
    if mode == 0 then
        return
    elseif mode == 1 then
        return 11
    end
    return 11, nil, 33, 44
end

local function observe(label, ...)
    local values = table.pack(...)
    local output = {label, tostring(values.n)}
    for index = 1, values.n do
        output[#output + 1] = tostring(values[index])
    end
    print(table.concat(output, ":"))
end

local function tail(mode)
    return "prefix", (many(mode))
end

local function varargs(...)
    observe("varargs-scalar", (...))
    observe("varargs-open", ...)
    return "varargs-return", (...)
end

local provider = {}
function provider:values(mode)
    return many(mode)
end

for mode = 0, 2 do
    observe("argument-scalar", (many(mode)))
    observe("argument-open", many(mode))
    observe("return-scalar", tail(mode))
    observe("method-scalar", (provider:values(mode)))
    local items = {"prefix", (many(mode))}
    observe("table", items[1], items[2], items[3])
    local a, b, c = (many(mode))
    observe("declaration", a, b, c)
    a, b, c = (many(mode))
    observe("assignment", a, b, c)
end
observe("returned", varargs())
observe("returned", varargs(7, nil, 9))
print(table.concat(trace, "|"))
