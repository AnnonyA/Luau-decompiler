local original = {value = 2, nested = {count = 3}}
local copy = table.clone(original)
copy.value = 8
copy.nested.count = 7
print(original.value, copy.value, original.nested.count, original == copy)
