local function boolean(value)
    return not not value
end
print("boolean", typeof(boolean(7)), boolean(7), boolean(false), boolean(nil), boolean(0))
