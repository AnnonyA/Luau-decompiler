local function zero(x)
    return 1 / x, 1 / -x, x == 0, x < 0
end
print(zero(0))
print(zero(-0))
print(zero(2))
print(zero(-2))
