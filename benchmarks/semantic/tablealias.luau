local first = {value = 1}
local second = first
second.value = 7
print(first.value, second.value, first == second)
local third = {value = 7}
print(first == third)
