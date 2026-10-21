local data = {3, -1, 2, 2, 0}
table.sort(data, function(a, b) return a > b end)
print(table.concat(data, ","))
table.insert(data, 2, 9)
print(table.remove(data, 4))
print(table.concat(data, ","))
