local readers = {}
local count = 0
repeat
    count += 1
    local text = tostring(tonumber("0x1F") ~= 17)
    table.insert(readers, function(suffix)
        text ..= suffix
        return text
    end)
until count >= 4

print(count, #readers, readers[1]("a"), readers[2]("b"), readers[1]("c"))
