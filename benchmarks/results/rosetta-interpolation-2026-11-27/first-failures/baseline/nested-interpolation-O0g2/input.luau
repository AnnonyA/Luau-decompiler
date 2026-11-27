local function surround(value)
    return `outer {`inner -- {value}`} end`
end
print(surround("text"))
print(surround("-- literal"))
local function bytes()
    return "prefix:" .. ("\254\129" .. "-- literal")
end
print(bytes())
