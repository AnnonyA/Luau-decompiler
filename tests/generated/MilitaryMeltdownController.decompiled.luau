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
setGameMusicSuppressed = function(value)
    if not callback then
        local result: Instance = player:FindFirstChild("PlayerScripts")
        if result then
            local ReplicatedStorage2: ReplicatedStorage = game:GetService("ReplicatedStorage")
            ReplicatedStorage2 = ReplicatedStorage2.Controllers
        end
        result = ReplicatedStorage2 or ReplicatedStorage2:FindFirstChild("AudioClient")
        if result and result:IsA("ModuleScript") then
            local result2, value2 = pcall(require, result)
            if result2 then
                callback = value2
            end
        end
    end
    if callback and callback.SetEventMusicSuppressed then
        local result = value
        pcall(callback.SetEventMusicSuppressed, result)
    end
end
local function createLoopedSound(value3, index, count)
    local value4: Sound = Instance.new("Sound")
    value4.Name = value3
    value4.SoundId = index
    value4.Looped = true
    value4.Volume = count
    value4.Parent = SoundService
    return value4
end

local function fadeSoundOut(value5)
    local config = { Volume = 0 }
    local value6 = TweenService:Create(value5, TweenInfo.new(2), config)
    local function onCompleted()
        value5:Destroy()
    end

    value6.Completed:Once(onCompleted)
    value6:Play()
end

local setDoorPose
setDoorPose = function(value7, index2)
    if callback2 then
        callback2:Stop(0)
    end
    local value8 = AnimationController:Play(value7, index2, 0)
    value8.Priority = Enum.AnimationPriority.Idle
    value8.Looped = true
    callback2 = value8
end
local function playDoorTransition(value9, index3)
    local value10 = AnimationController:Play(value9, index3)
    value10.Priority = Enum.AnimationPriority.Action
    return value10
end

local closeSiloDoor
closeSiloDoor = function(value11)
    local value12 = AnimationController:Play(value11, 127905115426978)
    value12.Priority = Enum.AnimationPriority.Action
    local function onStopped()
        if callback2 then
            callback2:Stop(0)
        end
        local value13 = AnimationController:Play(value11, 104097693446066, 0)
        value13.Priority = Enum.AnimationPriority.Idle
        value13.Looped = true
        callback2 = value13
    end

    value12.Stopped:Once(onStopped)
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
    local value14: number = 133831286058861
    local config2 = { 73037425215243, value14, 127905115426978, 119837384893258, 104097693446066 }
    for _, value15 in config2 do
        AnimationController:Load(animator, value15)
    end
    local value16: ScreenGui = Instance.new("ScreenGui")
    value16.Name = "MeltdownCutsceneFade"
    value16.IgnoreGuiInset = true
    value16.DisplayOrder = 1000
    value16.Parent = player.PlayerGui
    local value17: Frame = Instance.new("Frame")
    value17.Size = UDim2.fromScale(1, 1)
    value17.BackgroundColor3 = Color3.new(0, 0, 0)
    value17.BackgroundTransparency = 1
    value17.BorderSizePixel = 0
    value17.Parent = value16
    local function fadeTo(value18)
        local config3 = { BackgroundTransparency = value18 }
        local value19 = TweenService:Create(value17, TweenInfo.new(0.5), config3)
        value19:Play()
        return value19
    end

    local config4 = { BackgroundTransparency = 0 }
    local value20 = TweenService:Create(value17, TweenInfo.new(0.5), config4)
    value20:Play()
    value20.Completed:Wait()
    local clone2: Instance = militaryMeltdown.Blr:Clone()
    clone2:PivotTo(Center:GetPivot() * CFrame.Angles(0, math.pi, 0))
    clone2.Parent = workspace
    local value21 = AnimationController:Load(clone2.AnimationController.Animator, 89400215976354)
    local currentCamera = workspace.CurrentCamera
    local config5 = {}
    local onPreAnimation
    onPreAnimation = function()
        local timePosition = value21.TimePosition
        if value21.IsPlaying and callback3 < timePosition then
            callback3 = timePosition
            callback4 = clone2.RootPart.CamPart.Part0.CFrame * clone2.RootPart.CamPart.C0 * clone2.RootPart.CamPart.Transform
        end
        if callback4 then
            currentCamera.CameraType = Enum.CameraType.Scriptable
            currentCamera.CFrame = callback4
        end
    end
    table.insert(config5, RunService.PreAnimation:Connect(onPreAnimation))
    local children: {Instance} = Lighting:GetChildren()
    for _, value22 in children do
        value22.Parent = nil
    end
    local lighting = militaryMeltdown.Lighting
    local config6 = {}
    for key in lighting:GetAttributes() do
        config6[key] = Lighting[key]
    end
    for _, value23 in lighting:Clone():GetChildren() do
        value23.Parent = Lighting
    end
    for key2, value24 in lighting:GetAttributes() do
        Lighting[key2] = value24
    end
    local config7 = {}
    for _, value25 in player.PlayerGui:GetChildren() do
        if value25 == value16 then
            continue
        end
        if not value25:IsA("ScreenGui") then
            continue
        end
        if not value25.Enabled then
            continue
        end
        value25.Enabled = false
        table.insert(config7, value25)
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
    for _, value26 in config8 do
        value26.Parent = player.PlayerGui
    end
    local value27: Sound = Instance.new("Sound")
    value27.Name = "MeltdownCutsceneAmbience"
    value27.SoundId = "rbxassetid://113127659745813"
    value27.Looped = true
    value27.Volume = 0.4
    value27.Parent = SoundService
    value27.Looped = false
    local value28 = AnimationController:Load(animator, 73037425215243)
    local value29 = os.clock() + 5
    while os.clock() < value29 do
        if value21.Length > 0 and (value28.Length > 0 and value27.IsLoaded) then
            break
        end
        task.wait()
    end
    local value30 = Moonlite.CreatePlayer(militaryMeltdown.Intro)
    value30.Looped = false
    value21:Play()
    local value31 = AnimationController:Play(animator, 73037425215243)
    value31.Priority = Enum.AnimationPriority.Action
    value28 = value31
    value30:Play()
    local config9 = { BackgroundTransparency = 1 }
    TweenService:Create(value17, TweenInfo.new(0.5), config9):Play()
    local function delayed()
        value27:Play()
    end

    task.delay(0.6, delayed)
    ForgeVFX.emit(clone.CutsceneCamwork1)
    local result4 = nil
    local onPreAnimation2
    onPreAnimation2 = function()
        if not callback5 and value30.TimePosition >= 4.833 then
            callback5 = true
            ForgeVFX.emit(clone.EnabledBarrelSmoke)
            ForgeVFX.emit(clone.OpenBarrelEmit)
            ForgeVFX.emit(clone.CamZoom)
        end
        local result5 = result4
        if not result5 then
            result5 = value30.TimePosition
            if value30:GetTimeLength() - 0.5 <= result5 then
                local config10 = { BackgroundTransparency = 0 }
                local value32 = TweenService:Create(value17, TweenInfo.new(0.5), config10)
                value32:Play()
                result5 = value32
                result4 = result5
            end
        end
    end
    table.insert(config5, RunService.PreAnimation:Connect(onPreAnimation2))
    value30.Completed:Wait()
    if not result4 then
        local config11 = { BackgroundTransparency = 0 }
        local value33 = TweenService:Create(value17, TweenInfo.new(0.5), config11)
        value33:Play()
        result4 = value33
    end
    local value33 = result4.PlaybackState
    if value33 == Enum.PlaybackState.Playing then
        result4.Completed:Wait()
    end
    if callback2 then
        callback2:Stop(0)
    end
    local config11: number = 0
    local value34 = AnimationController:Play(animator, 119837384893258, config11)
    value34.Priority = Enum.AnimationPriority.Idle
    value34.Looped = true
    callback2 = value34
    value28:Stop()
    for _, value35 in config5 do
        value35:Disconnect()
    end
    value30:Stop()
    value30:Destroy()
    Lighting:ClearAllChildren()
    for key3, value36 in config6 do
        Lighting[key3] = value36
    end
    for _, value37 in children do
        value37.Parent = Lighting
    end
    fadeSoundOut(value27)
    for _, value38 in config8 do
        value38:Destroy()
    end
    for _, value39 in config7 do
        value39.Enabled = true
    end
    if result3 then
        result3.Scale = 1
    end
    clone2:Destroy()
    clone:Destroy()
    currentCamera.CameraType = Enum.CameraType.Custom
    local config12 = { BackgroundTransparency = 1 }
    local value40 = TweenService:Create(value17, TweenInfo.new(0.5), config12)
    value40:Play()
    value40.Completed:Wait()
    value16:Destroy()
    local value41 = AnimationController:Play(animator, 127905115426978)
    value41.Priority = Enum.AnimationPriority.Action
    local function onStopped()
        if callback2 then
            callback2:Stop(0)
        end
        local value42 = AnimationController:Play(animator, 104097693446066, 0)
        value42.Priority = Enum.AnimationPriority.Idle
        value42.Looped = true
        callback2 = value42
    end

    value41.Stopped:Once(onStopped)
end
local shakeOnImpact
shakeOnImpact = function()
    if not callback6 then
        local function onShake(value43)
            local currentCamera2 = workspace.CurrentCamera
            if currentCamera2 then
                currentCamera2.CFrame *= value43
            end
        end

        local value44 = CameraShaker.new(Enum.RenderPriority.Camera.Value + 1, onShake)
        value44:Start()
        callback6 = value44
    end
    callback6:ShakeOnce(6, 12, 0.1, 0.6)
end
local function attachTrail(value45)
    local result5 = if value45:IsA("Model") then value45.PrimaryPart else value45
    if not result5 then
        return
    end
    local value46: Attachment = Instance.new("Attachment")
    value46.Position = Vector3.new(0, result5.Size.Y / 2 + 0.4, 0)
    value46.Parent = result5
    local value47: Attachment = Instance.new("Attachment")
    value47.Position = Vector3.new(0, result5.Size.Y / 2 - 0.4, 0)
    value47.Parent = result5
    local value48: Trail = Instance.new("Trail")
    value48.Attachment0 = value46
    value48.Attachment1 = value47
    value48.Lifetime = 1.1
    value48.LightEmission = 1
    value48.Color = ColorSequence.new(Color3.new(1, 1, 1))
    local config13 = {
        NumberSequenceKeypoint.new(0, 0),
        NumberSequenceKeypoint.new(0.7, 0.25),
        NumberSequenceKeypoint.new(1, 1),
    }
    value48.Transparency = NumberSequence.new(config13)
    local config14 = { NumberSequenceKeypoint.new(0, 1.4), NumberSequenceKeypoint.new(1, 0.6) }
    value48.WidthScale = NumberSequence.new(config14)
    value48.FaceCamera = true
    value48.Parent = result5
end

local function riseNukeFromSilo(value49)
    local config15 = { name = "MeltdownSiloNuke", withOverhead = false }
    local value50 = NukeVisual.build(value49.Tier, config15)
    if not value50 then
        config15 = value49.RiseTime
        task.wait(config15)
        return
    else
        local value51 = value49.Scale or 3
        local result6
        if value50:IsA("Model") then
            value50:ScaleTo(value51)
            for _, _ in value50:GetDescendants() do
                if _:IsA("BasePart") then
                    _.CanQuery = false
                    _.CanTouch = false
                    _.CastShadow = false
                end
            end
        else
            value50.Size *= value51
            result6 = value50.Size.Y
            value50.CanQuery = false
            value50.CanTouch = false
            value50.CastShadow = false
        end
        attachTrail(value50)
        local position = workspace.Center:GetPivot().Position
        local value52 = -result6
        local value53 = value49.RiseHeight - value52
        value50.Parent = workspace.CurrentCamera
        local value54 = os.clock()
        local value55 = math.clamp((os.clock() - value54) / value49.RiseTime, 0, 1)
        local value56 = NukeBallistics.orientation(position + vector.create(0, 1, 0) * (value52 + value53 * value55 * value55), vector.create(0, 1, 0), 0)
        while value50:IsA("Model") do
            value50:PivotTo(value56)
            if value55 >= 1 then
                break
            end
            RunService.RenderStepped:Wait()
        end
        value55 = value49.TargetPosition
        local flightTime = value49.FlightTime
        value56 = value49.ArcHeight
        if value55 and flightTime then
            if not value56 then
                value50:Destroy()
                return
            else
                local function spawned()
                    local value57 = position + vector.create(0, 1, 0) * value49.RiseHeight
                    local result7 = value57
                    local value58 = os.clock()
                    while value50.Parent do
                        local value59 = math.clamp((os.clock() - value58) / flightTime, 0, 1)
                        local value60 = NukeBallistics.arc(value57, value55, value59, value56)
                        local value61 = NukeBallistics.orientation(value60, value60 - result7, value59)
                        if value50:IsA("Model") then
                            value50:PivotTo(value61)
                        else
                            value50.CFrame = value61
                        end
                        result7 = value60
                        if value59 >= 1 then
                            break
                        end
                        RunService.RenderStepped:Wait()
                    end
                    value50:Destroy()
                end

                task.spawn(spawned)
            end
        end
    end
end

local playSiloLaunch
playSiloLaunch = function(value62)
    local CityModel2: Instance = workspace:WaitForChild("CityModel")
    local SiloDoor: Instance = CityModel2:WaitForChild("SiloDoor")
    local SiloLaunchVFX: Instance = CityModel2:WaitForChild("SiloLaunchVFX")
    local animator2 = SiloDoor.AnimationController.Animator
    local value63 = AnimationController:Play(animator2, 133831286058861)
    value63.Priority = Enum.AnimationPriority.Action
    local function onStopped2()
        if callback2 then
            callback2:Stop(0)
        end
        local value64 = AnimationController:Play(animator2, 119837384893258, 0)
        value64.Priority = Enum.AnimationPriority.Idle
        value64.Looped = true
        callback2 = value64
    end

    value63.Stopped:Once(onStopped2)
    if value62.TargetUserId == player.UserId and value62.FlightTime then
        task.delay(value62.LaunchTime + value62.RiseTime + value62.FlightTime, shakeOnImpact)
    end
    local part: Instance = SiloDoor:FindFirstChild("Part")
    local result8 = if part and part:IsA("BasePart") then part.Color else nil
    if part and result8 then
        local config16 = { Color = Color3.new(1, 0.518958, 0.258824) }
        TweenService:Create(part, TweenInfo.new(value62.LaunchTime, Enum.EasingStyle.Cubic, Enum.EasingDirection.Out), config16):Play()
    end
    local function delayed2()
        ForgeVFX.emit(SiloLaunchVFX)
        if part and result8 then
            local config17 = { Color = result8 }
            TweenService:Create(part, TweenInfo.new(1.6), config17):Play()
        end
        riseNukeFromSilo(value62)
        if value63.IsPlaying then
            value63.Stopped:Wait()
        end
        local value65 = AnimationController:Play(animator2, 127905115426978)
        value65.Priority = Enum.AnimationPriority.Action
        local function onStopped()
            if callback2 then
                callback2:Stop(0)
            end
            local value66 = AnimationController:Play(animator2, 104097693446066, 0)
            value66.Priority = Enum.AnimationPriority.Idle
            value66.Looped = true
            callback2 = value66
        end

        value65.Stopped:Once(onStopped)
    end

    task.delay(value62.LaunchTime, delayed2)
end
local Start
Start = function(value67)
    local onClientEvent2
    onClientEvent2 = function()
        if callback7 then
            return
        end
        callback7 = true
        callback8 = true
        setGameMusicSuppressed(true)
        Players.LocalPlayer:SetAttribute("MeltdownCutsceneActive", true)
        playIntroCutscene()
        callback7 = false
        Players.LocalPlayer:SetAttribute("MeltdownCutsceneActive", false)
    end
    Remotes.MeltdownCutscene.OnClientEvent:Connect(onClientEvent2)
    local onClientEvent
    onClientEvent = function()
        callback8 = false
        setGameMusicSuppressed(false)
    end
    Remotes.MeltdownEnded.OnClientEvent:Connect(onClientEvent)
    onClientEvent = playSiloLaunch
    Remotes.MeltdownSiloLaunch.OnClientEvent:Connect(onClientEvent)
end
local module = { Start = Start }
return module
