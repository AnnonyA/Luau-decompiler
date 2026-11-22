local game = {}
function game:GetService(name)
    assert(name == "Players")
    print("service", name)
    local signal = {}
    function signal:Connect(callback)
        print("connect")
        callback({ DisplayName = "Ada" })
        callback({ DisplayName = "Lin" })
    end
    return { PlayerAdded = signal }
end
