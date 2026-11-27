local negative = 0 / 0
local positive = -(0 / 0)
local spelled = string.format("%g|%g", negative, positive)
print(spelled, #spelled)
local bytes = buffer.create(16)
buffer.writef64(bytes, 0, negative)
buffer.writef64(bytes, 8, positive)
print(buffer.readu32(bytes, 4), buffer.readu32(bytes, 12))
local pair = {negative, positive}
local function read()
    return pair[1], pair[2]
end
print(string.format("%f|%e", read()))
print(negative == negative, positive == positive, negative < 1, positive >= 1)
