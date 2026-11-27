local function observeFirst(values)
    for _, value in values do
        print("element", value < 6, value)
        break
    end
    print("done")
end

observeFirst({4, 9})
observeFirst({})
