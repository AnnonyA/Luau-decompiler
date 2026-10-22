local seed = tonumber(...) or 1
local input = "A\0009\255\128" .. string.char(65 + seed % 20) .. "é"
local encoded = {}
for i = 1, #input do
    encoded[i] = string.format("%02X", string.byte(input, i))
end
local hex = table.concat(encoded, ":")
local decoded = {}
for pair in string.gmatch(hex, "[%x][%x]") do
    decoded[#decoded + 1] = string.char(tonumber(pair, 16))
end
local output = table.concat(decoded)
print("codec", #input, #output, input == output, hex)
local n = 0
for i = 1, #output do n += string.byte(output, i) * i end
print("checksum", n)
