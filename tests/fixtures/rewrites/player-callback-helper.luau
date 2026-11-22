local Players = game:GetService("Players")

local function formatName(p)
    return p.DisplayName
end

Players.PlayerAdded:Connect(function(p)
    print(formatName(p))
end)
