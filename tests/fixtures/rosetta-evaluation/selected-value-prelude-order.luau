local function exercise()
    local _ = (function()
        print("before arithmetic")
        return 37
    end)()
    print(-missingOperand ^ 3, (-missingOperand) ^ 3)
    print(not missingOperand == secondOperand)
end
local ok, message = pcall(exercise)
print(ok, tostring(message):match("arithmetic %((%w+)%)"))
