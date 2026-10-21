local function default(value)
    if value == nil then return "default" end
    return value
end
print(default(nil), default(false), default(0), default(""), default("text"))
