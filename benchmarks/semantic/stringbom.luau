local prefix = "\239\187\191x"
local middle = "x\239\187\191y"
print(#prefix, string.byte(prefix, 1, #prefix))
print(#middle, string.byte(middle, 1, #middle))
