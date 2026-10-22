local function run(a, b, c)
    if a and b then
        print("both")
    elseif c then
        print("fallback")
    end
    print("done")
end
run(false, false, true)
run(true, false, true)
run(true, true, true)
