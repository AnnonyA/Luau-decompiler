local value = "a\nb\r\tc\00012\00123\03145"
print(#value, string.byte(value, 1, #value))
print(string.sub(value, 2, 5) == "\nb\r\t")
