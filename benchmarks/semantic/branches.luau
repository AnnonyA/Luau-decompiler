local function classify(value)
    if value < 0 then
        return "negative"
    elseif value == 0 then
        return "zero"
    end
    return "positive"
end
print("branches", classify(-3), classify(0), classify(7))
