local counter = 0
local saved = {}
while local current = counter < 4 and counter do
    saved[#saved + 1] = function() return current end
    counter = current + 1
end
print(counter, saved[1](), saved[2](), saved[3](), saved[4]())
