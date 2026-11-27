local function observe(value)
    local rooted = value ^ 0.5
    print("same", rooted == rooted, "tail")
    print("ordered", rooted < 0, rooted <= 0, "tail")
    return rooted == rooted, rooted ~= rooted
end

for _, value in ipairs({ -9, 9, 0 }) do
    print("result", observe(value))
end
