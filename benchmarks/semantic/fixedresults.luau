local function many()
    return 1, 2, 3
end
local function observe(...)
    print("arguments", select("#", ...), ...)
end
local function one()
    return (many())
end
observe((many()))
print("return", select("#", one()), one())
