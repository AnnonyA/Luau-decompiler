local function sample(x)
    return math.abs(x), math.floor(x), math.ceil(x), math.clamp(x, -2, 2), math.sign(x)
end
print(sample(-3.25))
print(sample(0))
print(sample(1.75))
print(sample(8))
