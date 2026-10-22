local n = tonumber(...) or 0
local text = "q\000" .. tostring(n)
local copy = text
local size = #copy
local total = 0
for i = 1, size do total += string.byte(copy, i) end
print("text", text == copy, size, total)
local value = n
if n > 0 then value += 3 else value -= 5 end
print("branch", value)
