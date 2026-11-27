continue = 6
local function transform(continue)
    return continue + 1
end
local record = { continue = 3 }
function record:continue(value)
    return value * 2
end
print(continue, record:continue(5), transform(4))
continue += 2
print(continue)
