local function choose(a, b)
    if a then
        if b then return 11 else return 12 end
    else
        if b then return 21 else return 22 end
    end
end
print(choose(true, true), choose(true, false), choose(false, true), choose(false, false))
