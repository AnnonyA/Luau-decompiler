local n = tonumber(...) or 0
local function check(a, b)
    if a or b then print("early", a, b) return 3 end
    print("late", a, b)
    return n + 5
end
for _, a in ipairs({false, true}) do
    for _, b in ipairs({false, true}) do print("result", check(a, b)) end
end
