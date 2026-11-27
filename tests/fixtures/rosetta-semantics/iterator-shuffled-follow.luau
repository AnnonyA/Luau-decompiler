local function walk(items)
    local total = 0
    for key, value in items do
        print(key, value)
        total += #key + value
    end
    print("finished", total)
end
walk({apricot = 7})
walk({blue = 9})
walk({})
