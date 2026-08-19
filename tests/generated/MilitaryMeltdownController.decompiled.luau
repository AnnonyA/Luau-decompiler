local ReplicatedStorage: ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService: RunService = game:GetService("RunService")
local Players: Players = game:GetService("Players")
local Lighting: Lighting = game:GetService("Lighting")
local SoundService: SoundService = game:GetService("SoundService")
local TweenService: TweenService = game:GetService("TweenService")
local packages = ReplicatedStorage.Packages
local shared = ReplicatedStorage.Shared
local Remotes = require(packages.Remotes)
local Moonlite = require(packages.Moonlite)
local ForgeVFX = require(packages.ForgeVFX)
local CameraShaker = require(packages.CameraShaker)
local AnimationController = require(ReplicatedStorage.Controllers.AnimationController)
local NukeBallistics = require(shared.NukeBallistics)
local NukeVisual = require(shared.NukeVisual)
local player: Player = Players.LocalPlayer
local config = {}
local value: nil = nil
local setGameMusicSuppressed
setGameMusicSuppressed = function(value)
    if not up0 then
        local result
        if result then
            result = game:GetService("ReplicatedStorage")
            result = result.Controllers
        end
        local result2
        if result2 then
            result2 = result:FindFirstChild("AudioClient")
        end
        if result2 then
            if result2:IsA("ModuleScript") then
                local result3, value2 = pcall(require, result2)
                if result3 then
                    up0 = value2
                end
            end
        end
    end
    if up0 then
        if up0.SetEventMusicSuppressed then
            pcall(up0.SetEventMusicSuppressed, value)
        end
    end
end
local value2 = function(self, index, count)
    local value: Sound = Instance.new("Sound")
    value.Name = self
    value.SoundId = index
    value.Looped = true
    value.Volume = count
    value.Parent = up0
    return value
end
local value3 = function(value)
    local config = {}
    local value2 = up0:Create(value, up1, config)
    local value3 = function()
        up0:Destroy()
    end
    value2.Completed:Once(value3)
    value2:Play()
end
local setDoorPose
setDoorPose = function(self, index)
    if up0 then
        up0:Stop(0)
    end
    local value = up1:Play(self, index, 0)
    value.Priority = Enum.AnimationPriority.Idle
    value.Looped = true
    up0 = value
end
local value4 = function(self, index)
    local value = up0:Play(self, index)
    value.Priority = Enum.AnimationPriority.Action
    return value
end
local closeSiloDoor
closeSiloDoor = function(value)
    local value2 = up0:Play(value, 127905115426978)
    value2.Priority = Enum.AnimationPriority.Action
    local value3 = function()
        if up1 then
            up1:Stop(0)
        end
        local value2 = up2:Play(up0, 104097693446066, 0)
        value2.Priority = Enum.AnimationPriority.Idle
        value2.Looped = true
        up1 = value2
    end
    value2.Stopped:Once(value3)
end
local playIntroCutscene
playIntroCutscene = function()
    local militaryMeltdown = up0.Assets.CutScenes.MilitaryMeltdown
    local CityModel: Instance = workspace:WaitForChild("CityModel")
    local Center: Instance = workspace:WaitForChild("Center")
    local clone: Instance = militaryMeltdown.CutsceneFX:Clone()
    local value = Center:GetPivot()
    clone:PivotTo(value)
    clone.Parent = workspace
    local animator = CityModel.SiloDoor.AnimationController.Animator
    local config = {}
    result = 133831286058861
    local value2 = { 73037425215243, result, 127905115426978, 119837384893258, 104097693446066 }
    local value3: nil = nil
    result2 = nil
end
local shakeOnImpact
shakeOnImpact = function()
    if not up0 then
        local value = function(value)
            local currentCamera = workspace.CurrentCamera
            if currentCamera then
                currentCamera.CFrame = currentCamera.CFrame * value
            end
        end
        local value2 = up1.new(Enum.RenderPriority.Camera.Value + 1, value)
        value2:Start()
        up0 = value2
    end
    up0:ShakeOnce(6, 12, 0.1, 0.6)
end
local value5 = function(value)
    local result
    if value:IsA("Model") then
    end
    if not value then
        return
    else
        local value2: Attachment = Instance.new("Attachment")
        value2.Position = Vector3.new(0, value.Size.Y / 2 + 0.4, 0)
        value2.Parent = value
        local value3: Attachment = Instance.new("Attachment")
        value3.Position = Vector3.new(0, value.Size.Y / 2 - 0.4, 0)
        value3.Parent = value
        local value4: Trail = Instance.new("Trail")
        value4.Attachment0 = value2
        value4.Attachment1 = value3
        value4.Lifetime = 1.1
        value4.LightEmission = 1
        value4.Color = ColorSequence.new(Color3.new(1, 1, 1))
        local config = {}
        local value5 = NumberSequenceKeypoint.new(1, 1)
        local value6 = {}
        value4.Transparency = NumberSequence.new(value6)
        local config2 = {}
        local value7 = NumberSequenceKeypoint.new(1, 0.6)
        local value8 = {}
        value4.WidthScale = NumberSequence.new(value8)
        value4.FaceCamera = true
        value4.Parent = value
    end
end
local value6 = function(value)
    local config = {}
    local value2 = up0.build(value.Tier, config)
    if not value2 then
        task.wait(value.RiseTime)
        return
    else
        local value3 = value.Scale or 3
        local result
        if value2:IsA("Model") then
            value2:ScaleTo(value3)
            local result2: {Instance}, value4, value5 = value2:GetDescendants()
        else
            value2.Size = value2.Size * value3
            result = value2.Size.Y
            value2.CanQuery = false
            value2.CanTouch = false
            value2.CastShadow = false
        end
        up1(value2)
        local position = workspace.Center:GetPivot().Position
        local value6 = -result
        local value7 = value.RiseHeight - value6
        value2.Parent = workspace.CurrentCamera
        local value8 = os.clock()
        while not r11 do
            value2:PivotTo(r10)
            if 1 <= r8 then
                break
            end
            up3.RenderStepped:Wait()
        end
        local targetPosition = value.TargetPosition
        local flightTime = value.FlightTime
        local arcHeight = value.ArcHeight
        if targetPosition then
            if flightTime then
                if not arcHeight then
                else
                    local value9 = function()
                        local value2 = up0 + vector.create(0, 1, 0) * up1.RiseHeight
                        local value3 = os.clock()
                        while not vector.create(0, 1, 0) do
                            local value4 = math.clamp((os.clock() - value3) / up3, 0, 1)
                            local value5 = up4.arc(value2, up5, value4, up6)
                            local value6 = up4.orientation(value5, value5 - value2, value4)
                            if up2:IsA("Model") then
                                up2:PivotTo(value6)
                            else
                                up2.CFrame = value6
                            end
                            if 1 <= value4 then
                                break
                            end
                            up7.RenderStepped:Wait()
                        end
                        up2:Destroy()
                    end
                    task.spawn(value9)
                end
            end
        end
        value2:Destroy()
        return
    end
end
local playSiloLaunch
playSiloLaunch = function(value)
    local CityModel: Instance = workspace:WaitForChild("CityModel")
    local SiloDoor: Instance = CityModel:WaitForChild("SiloDoor")
    local SiloLaunchVFX: Instance = CityModel:WaitForChild("SiloLaunchVFX")
    local animator = SiloDoor.AnimationController.Animator
    local value2 = up0:Play(animator, 133831286058861)
    value2.Priority = Enum.AnimationPriority.Action
    local value3 = function()
        if up1 then
            up1:Stop(0)
        end
        local value2 = up2:Play(up0, 119837384893258, 0)
        value2.Priority = Enum.AnimationPriority.Idle
        value2.Looped = true
        up1 = value2
    end
    value2.Stopped:Once(value3)
    if value.TargetUserId == up2.UserId then
        if value.FlightTime then
            task.delay(value.LaunchTime + value.RiseTime + value.FlightTime, up3)
        end
    end
    local part: Instance = SiloDoor:FindFirstChild("Part")
    if part then
        if part:IsA("BasePart") then
            if part then
                if part.Color then
                    local config = { Color = nil }
                    config.Color = up5
                    up4:Create(part, TweenInfo.new(value.LaunchTime, Enum.EasingStyle.Cubic, Enum.EasingDirection.Out), config):Play()
                end
            end
            local value4 = function()
                up0.emit(up1)
                if up2 then
                    if up3 then
                        local config = { Color = nil }
                        config.Color = up3
                        up4:Create(up2, TweenInfo.new(1.6), config):Play()
                    end
                end
                up5(up6)
                if up7.IsPlaying then
                    up7.Stopped:Wait()
                end
                local value2 = up9:Play(up8, 127905115426978)
                value2.Priority = Enum.AnimationPriority.Action
                local value3 = function()
                    if up1 then
                        up1:Stop(0)
                    end
                    local value = up2:Play(up0, 104097693446066, 0)
                    value.Priority = Enum.AnimationPriority.Idle
                    value.Looped = true
                    up1 = value
                end
                value2.Stopped:Once(value3)
            end
            task.delay(value.LaunchTime, value4)
        end
    end
    result = nil
end
local Start
Start = function(value)
    local value2 = function()
        if up0 then
            return
        else
            up0 = true
            up1 = true
            up2(true)
            up3.LocalPlayer:SetAttribute("MeltdownCutsceneActive", true)
            up4()
            up0 = false
            up3.LocalPlayer:SetAttribute("MeltdownCutsceneActive", false)
        end
    end
    up0.OnClientEvent:Connect(value2)
    local value3 = function()
        up0 = false
        up1(false)
    end
    up6.OnClientEvent:Connect(value3)
    up7.OnClientEvent:Connect(up8)
end
config.Start = Start
return config
