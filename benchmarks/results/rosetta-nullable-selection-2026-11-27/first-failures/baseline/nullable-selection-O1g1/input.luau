local function choose(left, right, flag)
    print((left ~= right and "selected" or (if flag then nil else "fallback")) or true)
end
choose(1, 1, true)
choose(2, 1, true)
choose(1, 1, false)
