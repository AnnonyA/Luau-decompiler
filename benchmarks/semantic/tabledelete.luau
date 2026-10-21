local data = {a = 1, b = 2}
data.a = nil
print(tostring(data.a), data.b)
data.b = nil
print(next(data) == nil)
