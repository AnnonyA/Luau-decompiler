local input = game:GetService("UserInputService")
local clock = game:GetService("RunService")
local sounds = game:GetService("SoundService")
local players = game:GetService("Players")
local part = Instance.new("Part")
local remote = Instance.new("RemoteEvent")

local function positionOf(raw)
    return raw.Position
end

local function keyOf(raw)
    return raw.KeyCode
end

local function checkSound(child)
    return child:IsA("Sound")
end

local function showMixed(item)
    print(type(item))
end

input.InputBegan:Connect(function(raw, handled)
    print(positionOf(raw), keyOf(raw), handled)
    showMixed(raw)
end)

clock.Heartbeat:Once(function(dt)
    print(dt)
    showMixed(dt)
end)

sounds.ChildAdded:Connect(function(child)
    print(checkSound(child))
end)

part.Touched:ConnectParallel(function(hit)
    print(hit.Name)
end)

players.PlayerAdded:Connect(function(joined)
    joined.CharacterAdded:Once(function(model)
        print(model.Name)
    end)
end)

remote.OnServerEvent:Connect(function(sender, payload)
    print(sender.DisplayName, payload)
end)

customSignals.InputBegan:Connect(function(value, value2)
    print(value, value2)
end)

local function observeFake(game, Instance)
    local fakeClock = game:GetService("RunService")
    fakeClock.Heartbeat:Once(function(value)
        print(value)
    end)
    local fakePart = Instance.new("Part")
    fakePart.Touched:Connect(function(value)
        print(value)
    end)
end

observeFake(customGame, customInstance)
