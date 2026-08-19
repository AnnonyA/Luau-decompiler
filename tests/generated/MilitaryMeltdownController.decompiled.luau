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
local setGameMusicSuppressed
setGameMusicSuppressed = function(value2)
    if not value then
        local result: Instance = player:FindFirstChild("PlayerScripts")
        if result then
            local ReplicatedStorage2: ReplicatedStorage = game:GetService("ReplicatedStorage")
            ReplicatedStorage2 = ReplicatedStorage2.Controllers
        end
        result = ReplicatedStorage2 or ReplicatedStorage2:FindFirstChild("AudioClient")
        if result and result:IsA("ModuleScript") then
            local result2, value3 = pcall(require, result)
            if result2 then
                value = value3
            end
        end
    end
    if value and value.SetEventMusicSuppressed then
        local result = value2
        pcall(value.SetEventMusicSuppressed, result)
    end
end
local function createLoopedSound(value4, index, count)
    local value5: Sound = Instance.new("Sound")
    value5.Name = value4
    value5.SoundId = index
    value5.Looped = true
    value5.Volume = count
    value5.Parent = SoundService
    return value5
end

local function fadeSoundOut(value6)
    local config = { Volume = 0 }
    local value7 = TweenService:Create(value6, TweenInfo.new(2), config)
    local function function_()
        value6:Destroy()
    end

    value7.Completed:Once(function_)
    value7:Play()
end

local setDoorPose
setDoorPose = function(value9, index2)
    if value8 then
        value8:Stop(0)
    end
    local value10 = AnimationController:Play(value9, index2, 0)
    value10.Priority = Enum.AnimationPriority.Idle
    value10.Looped = true
    value8 = value10
end
local function playDoorTransition(value11, index3)
    local value12 = AnimationController:Play(value11, index3)
    value12.Priority = Enum.AnimationPriority.Action
    return value12
end

local closeSiloDoor
closeSiloDoor = function(value13)
    local value14 = AnimationController:Play(value13, 127905115426978)
    value14.Priority = Enum.AnimationPriority.Action
    local function function_2()
        if value8 then
            value8:Stop(0)
        end
        local value15 = AnimationController:Play(value13, 104097693446066, 0)
        value15.Priority = Enum.AnimationPriority.Idle
        value15.Looped = true
        value8 = value15
    end

    value14.Stopped:Once(function_2)
end
local playIntroCutscene
playIntroCutscene = function()
    local militaryMeltdown = ReplicatedStorage.Assets.CutScenes.MilitaryMeltdown
    local CityModel: Instance = workspace:WaitForChild("CityModel")
    local Center: Instance = workspace:WaitForChild("Center")
    local clone: Instance = militaryMeltdown.CutsceneFX:Clone()
    clone:PivotTo(clone, Center:GetPivot())
    clone.Parent = workspace
    local animator = CityModel.SiloDoor.AnimationController.Animator
    local value16: number = 133831286058861
    local config2 = { 73037425215243, value16, 127905115426978, 119837384893258, 104097693446066 }
    for _, value17 in config2 do
        AnimationController:Load(animator, value17)
    end
    local value18: ScreenGui = Instance.new("ScreenGui")
    value18.Name = "MeltdownCutsceneFade"
    value18.IgnoreGuiInset = true
    value18.DisplayOrder = 1000
    value18.Parent = player.PlayerGui
    local value19: Frame = Instance.new("Frame")
    value19.Size = UDim2.fromScale(1, 1)
    value19.BackgroundColor3 = Color3.new(0, 0, 0)
    value19.BackgroundTransparency = 1
    value19.BorderSizePixel = 0
    value19.Parent = value18
    local function fadeTo(value20)
        local config3 = { BackgroundTransparency = value20 }
        local value21 = TweenService:Create(value19, TweenInfo.new(0.5), config3)
        value21:Play()
        return value21
    end

    local config4 = { BackgroundTransparency = 0 }
    local value22 = TweenService:Create(value19, TweenInfo.new(0.5), config4)
    value22:Play()
    value22.Completed:Wait()
    local clone2: Instance = militaryMeltdown.Blr:Clone()
    clone2:PivotTo(Center:GetPivot() * CFrame.Angles(0, math.pi, 0))
    clone2.Parent = workspace
    local value23 = AnimationController:Load(clone2.AnimationController.Animator, 89400215976354)
    local currentCamera = workspace.CurrentCamera
    local config5 = {}
    local function_3
    function_3 = function()
        local timePosition = value23.TimePosition
        if value23.IsPlaying and value24 < timePosition then
            value24 = timePosition
            value25 = clone2.RootPart.CamPart.Part0.CFrame * clone2.RootPart.CamPart.C0 * clone2.RootPart.CamPart.Transform
        end
        if value25 then
            currentCamera.CameraType = Enum.CameraType.Scriptable
            currentCamera.CFrame = value25
        end
    end
    table.insert(config5, RunService.PreAnimation:Connect(function_3))
    local children: {Instance} = Lighting:GetChildren()
    for _, value26 in children do
        value26.Parent = nil
    end
    local lighting = militaryMeltdown.Lighting
    local config6 = {}
    for key in lighting:GetAttributes() do
        config6[key] = Lighting[key]
    end
    for _, value27 in lighting:Clone():GetChildren() do
        value27.Parent = Lighting
    end
    for key2, value28 in lighting:GetAttributes() do
        Lighting[key2] = value28
    end
    local config7 = {}
    for _, value29 in player.PlayerGui:GetChildren() do
        if value29 ~= value18 then
            if not value29:IsA("ScreenGui") then
                continue
            end
            if not value29.Enabled then
                continue
            end
            value29.Enabled = false
            table.insert(config7, value29)
        end
    end
    local floor: Instance = CityModel:FindFirstChild("Floor", true)
    local result3 = floor
    if result3 then
        result3 = floor:FindFirstChild("CityGui")
    end
    result3 = result3 or result3:FindFirstChild("UIScale")
    if result3 then
        result3.Scale = 0
    end
    local config8 = {
        ReplicatedStorage.Assets.CutScenes.ScreenEffects.ScreenGui:Clone(),
        ReplicatedStorage.Assets.CutScenes.ScreenEffects.Vignette:Clone(),
    }
    for _, value30 in config8 do
        value30.Parent = player.PlayerGui
    end
    local value31: Sound = Instance.new("Sound")
    value31.Name = "MeltdownCutsceneAmbience"
    value31.SoundId = "rbxassetid://113127659745813"
    value31.Looped = true
    value31.Volume = 0.4
    value31.Parent = SoundService
    value31.Looped = false
    local value32 = AnimationController:Load(animator, 73037425215243)
    local value33 = os.clock() + 5
    while os.clock() < value33 do
        if value23.Length > 0 and value32.Length > 0 then
            if not value31.IsLoaded then
                task.wait()
            end
            local value34 = Moonlite.CreatePlayer(militaryMeltdown.Intro)
            value34.Looped = false
            value23:Play()
            local value35 = AnimationController:Play(animator, 73037425215243)
            value35.Priority = Enum.AnimationPriority.Action
            value32 = value35
            value34:Play()
            local config9 = { BackgroundTransparency = 1 }
            TweenService:Create(value19, TweenInfo.new(0.5), config9):Play()
            local function function_4()
                value31:Play()
            end

            task.delay(0.6, function_4)
            ForgeVFX.emit(clone.CutsceneCamwork1)
            local result4: nil = nil
            local function_5
            function_5 = function()
                if not value36 and value34.TimePosition >= 4.833 then
                    value36 = true
                    ForgeVFX.emit(clone.EnabledBarrelSmoke)
                    ForgeVFX.emit(clone.OpenBarrelEmit)
                    ForgeVFX.emit(clone.CamZoom)
                end
                local result5 = result4
                if not result5 then
                    result5 = value34.TimePosition
                    if value34:GetTimeLength() - 0.5 <= result5 then
                        local config10 = { BackgroundTransparency = 0 }
                        local value37 = TweenService:Create(value19, TweenInfo.new(0.5), config10)
                        value37:Play()
                        result5 = value37
                        result4 = result5
                    end
                end
            end
            table.insert(config5, RunService.PreAnimation:Connect(function_5))
            value34.Completed:Wait()
            if not result4 then
                local config11 = { BackgroundTransparency = 0 }
                local value38 = TweenService:Create(value19, TweenInfo.new(0.5), config11)
                value38:Play()
                result4 = value38
            end
            local value38 = result4.PlaybackState
            if value38 == Enum.PlaybackState.Playing then
                result4.Completed:Wait()
            end
            if value8 then
                value8:Stop(0)
            end
            local config11: number = 0
            local value39 = AnimationController:Play(animator, 119837384893258, config11)
            value39.Priority = Enum.AnimationPriority.Idle
            value39.Looped = true
            value8 = value39
            value32:Stop()
            for _, value40 in config5 do
                value40:Disconnect()
            end
            value34:Stop()
            value34:Destroy()
            Lighting:ClearAllChildren()
            for key3, value41 in config6 do
                Lighting[key3] = value41
            end
            for _, value42 in children do
                value42.Parent = Lighting
            end
            fadeSoundOut(value31)
            for _, value43 in config8 do
                value43:Destroy()
            end
            for _, value44 in config7 do
                value44.Enabled = true
            end
            if result3 then
                result3.Scale = 1
            end
            clone2:Destroy()
            clone:Destroy()
            currentCamera.CameraType = Enum.CameraType.Custom
            local config12 = { BackgroundTransparency = 1 }
            local value45 = TweenService:Create(value19, TweenInfo.new(0.5), config12)
            value45:Play()
            value45.Completed:Wait()
            value18:Destroy()
            local value46 = AnimationController:Play(animator, 127905115426978)
            value46.Priority = Enum.AnimationPriority.Action
            local function function_6()
                if value8 then
                    value8:Stop(0)
                end
                local value47 = AnimationController:Play(animator, 104097693446066, 0)
                value47.Priority = Enum.AnimationPriority.Idle
                value47.Looped = true
                value8 = value47
            end

            value46.Stopped:Once(function_6)
        end
    end
end
local shakeOnImpact
shakeOnImpact = function()
    if not value48 then
        local function function_7(value49)
            local currentCamera2 = workspace.CurrentCamera
            if currentCamera2 then
                currentCamera2.CFrame = currentCamera2.CFrame * value49
            end
        end

        local value50 = CameraShaker.new(Enum.RenderPriority.Camera.Value + 1, function_7)
        value50:Start()
        value48 = value50
    end
    value48:ShakeOnce(6, 12, 0.1, 0.6)
end
local function attachTrail(value51)
    local result5 = if value51:IsA("Model") then value51.PrimaryPart else value51
    if not result5 then
        return
    else
        local value52: Attachment = Instance.new("Attachment")
        value52.Position = Vector3.new(0, result5.Size.Y / 2 + 0.4, 0)
        value52.Parent = result5
        local value53: Attachment = Instance.new("Attachment")
        value53.Position = Vector3.new(0, result5.Size.Y / 2 - 0.4, 0)
        value53.Parent = result5
        local value54: Trail = Instance.new("Trail")
        value54.Attachment0 = value52
        value54.Attachment1 = value53
        value54.Lifetime = 1.1
        value54.LightEmission = 1
        value54.Color = ColorSequence.new(Color3.new(1, 1, 1))
        local config13 = {
            NumberSequenceKeypoint.new(0, 0),
            NumberSequenceKeypoint.new(0.7, 0.25),
            NumberSequenceKeypoint.new(1, 1),
        }
        value54.Transparency = NumberSequence.new(config13)
        local config14 = { NumberSequenceKeypoint.new(0, 1.4), NumberSequenceKeypoint.new(1, 0.6) }
        value54.WidthScale = NumberSequence.new(config14)
        value54.FaceCamera = true
        value54.Parent = result5
    end
end

local function riseNukeFromSilo(value55)
    local config15 = { name = "MeltdownSiloNuke", withOverhead = false }
    local value56 = NukeVisual.build(value55.Tier, config15)
    if not value56 then
        config15 = value55.RiseTime
        task.wait(config15)
        return
    else
        local value57 = value55.Scale or 3
        local result6
        if value56:IsA("Model") then
            value56:ScaleTo(value57)
            for _, _ in value56:GetDescendants() do
                if _:IsA("BasePart") then
                    _.CanQuery = false
                    _.CanTouch = false
                    _.CastShadow = false
                end
            end
        else
            value56.Size = value56.Size * value57
            result6 = value56.Size.Y
            value56.CanQuery = false
            value56.CanTouch = false
            value56.CastShadow = false
        end
        attachTrail(value56)
        local position = workspace.Center:GetPivot().Position
        local value58 = -result6
        local value59 = value55.RiseHeight - value58
        value56.Parent = workspace.CurrentCamera
        local value60 = os.clock()
        local value61 = math.clamp((os.clock() - value60) / value55.RiseTime, 0, 1)
        local value62 = NukeBallistics.orientation(position + vector.create(0, 1, 0) * (value58 + value59 * value61 * value61), vector.create(0, 1, 0), 0)
        while value56:IsA("Model") do
            value56:PivotTo(value62)
            if value61 < 1 then
                RunService.RenderStepped:Wait()
            end
        end
        value61 = value55.TargetPosition
        local flightTime = value55.FlightTime
        value62 = value55.ArcHeight
        if value61 and flightTime then
            if not value62 then
                value56:Destroy()
                return
            else
                local function function_8()
                    local value63 = position + vector.create(0, 1, 0) * value55.RiseHeight
                    local result7 = value63
                    local value64 = os.clock()
                    while value56.Parent do
                        local value65 = math.clamp((os.clock() - value64) / flightTime, 0, 1)
                        local value66 = NukeBallistics.arc(value63, value61, value65, value62)
                        local value67 = NukeBallistics.orientation(value66, value66 - result7, value65)
                        if value56:IsA("Model") then
                            value56:PivotTo(value67)
                        else
                            value56.CFrame = value67
                        end
                        result7 = value66
                        if value65 < 1 then
                            RunService.RenderStepped:Wait()
                        end
                    end
                    value56:Destroy()
                end

                task.spawn(function_8)
            end
        end
    end
end

local playSiloLaunch
playSiloLaunch = function(value68)
    local CityModel2: Instance = workspace:WaitForChild("CityModel")
    local SiloDoor: Instance = CityModel2:WaitForChild("SiloDoor")
    local SiloLaunchVFX: Instance = CityModel2:WaitForChild("SiloLaunchVFX")
    local animator2 = SiloDoor.AnimationController.Animator
    local value69 = AnimationController:Play(animator2, 133831286058861)
    value69.Priority = Enum.AnimationPriority.Action
    local function function_9()
        if value8 then
            value8:Stop(0)
        end
        local value70 = AnimationController:Play(animator2, 119837384893258, 0)
        value70.Priority = Enum.AnimationPriority.Idle
        value70.Looped = true
        value8 = value70
    end

    value69.Stopped:Once(function_9)
    if value68.TargetUserId == player.UserId and value68.FlightTime then
        task.delay(value68.LaunchTime + value68.RiseTime + value68.FlightTime, shakeOnImpact)
    end
    local part: Instance = SiloDoor:FindFirstChild("Part")
    local result8 = if part and part:IsA("BasePart") then part.Color else nil
    if part and result8 then
        local config16 = { Color = Color3.new(1, 0.518958, 0.258824) }
        TweenService:Create(part, TweenInfo.new(value68.LaunchTime, Enum.EasingStyle.Cubic, Enum.EasingDirection.Out), config16):Play()
    end
    local function function_10()
        ForgeVFX.emit(SiloLaunchVFX)
        if part and result8 then
            local config17 = { Color = result8 }
            TweenService:Create(part, TweenInfo.new(1.6), config17):Play()
        end
        riseNukeFromSilo(value68)
        if value69.IsPlaying then
            value69.Stopped:Wait()
        end
        local value71 = AnimationController:Play(animator2, 127905115426978)
        value71.Priority = Enum.AnimationPriority.Action
        local function function_11()
            if value8 then
                value8:Stop(0)
            end
            local value72 = AnimationController:Play(animator2, 104097693446066, 0)
            value72.Priority = Enum.AnimationPriority.Idle
            value72.Looped = true
            value8 = value72
        end

        value71.Stopped:Once(function_11)
    end

    task.delay(value68.LaunchTime, function_10)
end
local Start
Start = function(value75)
    local function_12
    function_12 = function()
        if value73 then
            return
        else
            value73 = true
            value74 = true
            setGameMusicSuppressed(true)
            Players.LocalPlayer:SetAttribute("MeltdownCutsceneActive", true)
            playIntroCutscene()
            value73 = false
            Players.LocalPlayer:SetAttribute("MeltdownCutsceneActive", false)
        end
    end
    Remotes.MeltdownCutscene.OnClientEvent:Connect(function_12)
    local function_13
    function_13 = function()
        value74 = false
        setGameMusicSuppressed(false)
    end
    Remotes.MeltdownEnded.OnClientEvent:Connect(function_13)
    function_13 = playSiloLaunch
    Remotes.MeltdownSiloLaunch.OnClientEvent:Connect(function_13)
end
local module = { Start = Start }
return module
