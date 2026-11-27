local function inspect(value, ...)
    print(typeof(value), tostring(value))
end

inspect(0i)
inspect(-1i)
inspect(9007199254740993i)
inspect(9223372036854775807i)
inspect(0x8000000000000000i)
