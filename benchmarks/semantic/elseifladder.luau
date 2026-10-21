local function classify(x)
    if x < 0 then return "negative"
    elseif x == 0 then return "zero"
    elseif x < 10 then return "small"
    else return "large" end
end
print(classify(-1), classify(0), classify(1), classify(10), classify(20))
