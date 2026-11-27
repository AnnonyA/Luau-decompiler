for key, value in pairs({apple = "red", pear = "green"}) do
    local _ = (function()
        print(key, value)
        return 41
    end)()
end
print(("complete"):upper())
