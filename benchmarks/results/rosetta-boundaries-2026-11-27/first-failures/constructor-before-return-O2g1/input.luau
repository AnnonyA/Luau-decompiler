local function message()
    local record = {
        read = function()
            return "kept"
        end,
    }
    return record.read()
end
print(message())
