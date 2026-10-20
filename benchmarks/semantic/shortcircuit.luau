-- Project-owned deterministic trace: each skipped operand must stay skipped.
local calls = 0
local function test(label, result)
    calls += 1
    print("eval", label)
    return result
end
local a = test("a", false) and test("skipped-and", true)
local b = test("b", true) or test("skipped-or", false)
local c = test("c", true) and test("d", 17)
local d = test("e", false) or test("f", 23)
print("shortcircuit", tostring(a), tostring(b), tostring(c), tostring(d), calls)
