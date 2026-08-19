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
local LocalPlayer: Player = Players.LocalPlayer
local value: boolean = false
local value2: boolean = false
local value3 = nil
local value4 = nil
local setGameMusicSuppressed
setGameMusicSuppressed = function(seed)
    if not value4 then
        local result: Instance = LocalPlayer:FindFirstChild("PlayerScripts")
        if result then
            local ReplicatedStorage2: ReplicatedStorage = game:GetService("ReplicatedStorage")
            ReplicatedStorage2 = ReplicatedStorage2.Controllers
        end
        result = ReplicatedStorage2 or ReplicatedStorage2:FindFirstChild("AudioClient")
        if result and result:IsA("ModuleScript") then
            local result2, value6 = pcall(require, result)
            if result2 then
                value4 = value6
            end
        end
    end
    if value4 and value4.SetEventMusicSuppressed then
        local result3 = seed
        pcall(value4.SetEventMusicSuppressed, result3)
    end
end
local function createLoopedSound(a, b, c)
    local instance: Sound = Instance.new("Sound")
    instance.Name = a
    instance.SoundId = b
    instance.Looped = true
    instance.Volume = c
    instance.Parent = SoundService
    return instance
end

local function fadeSoundOut(seed)
    local tween = TweenService:Create(seed, TweenInfo.new(2), { Volume = 0 })
    local function onCompleted()
        seed:Destroy()
    end

    tween.Completed:Once(onCompleted)
    tween:Play()
end

local setDoorPose
setDoorPose = function(value11, index2)
    if value3 then
        value3:Stop(0)
    end
    local value12 = AnimationController:Play(value11, index2, 0)
    value12.Priority = Enum.AnimationPriority.Idle
    value12.Looped = true
    value3 = value12
end
local function playDoorTransition(value13, index3)
    local value14 = AnimationController:Play(value13, index3)
    value14.Priority = Enum.AnimationPriority.Action
    return value14
end

local closeSiloDoor
closeSiloDoor = function(seed)
    local value16 = AnimationController:Play(seed, 127905115426978)
    value16.Priority = Enum.AnimationPriority.Action
    local function onStopped()
        if value3 then
            value3:Stop(0)
        end
        local value17 = AnimationController:Play(seed, 104097693446066, 0)
        value17.Priority = Enum.AnimationPriority.Idle
        value17.Looped = true
        value3 = value17
    end

    value16.Stopped:Once(onStopped)
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
    local value18: number = 133831286058861
    local config2 = { 73037425215243, value18, 127905115426978, 119837384893258, 104097693446066 }
    for _, value19 in config2 do
        AnimationController:Load(animator, value19)
    end
    local instance: ScreenGui = Instance.new("ScreenGui")
    instance.Name = "MeltdownCutsceneFade"
    instance.IgnoreGuiInset = true
    instance.DisplayOrder = 1000
    instance.Parent = LocalPlayer.PlayerGui
    local instance2: Frame = Instance.new("Frame")
    instance2.Size = UDim2.fromScale(1, 1)
    instance2.BackgroundColor3 = Color3.new(0, 0, 0)
    instance2.BackgroundTransparency = 1
    instance2.BorderSizePixel = 0
    instance2.Parent = instance
    local function fadeTo(seed)
        local config3 = { BackgroundTransparency = seed }
        local tween = TweenService:Create(instance2, TweenInfo.new(0.5), config3)
        tween:Play()
        return tween
    end

    local config4 = { BackgroundTransparency = 0 }
    local tween = TweenService:Create(instance2, TweenInfo.new(0.5), config4)
    tween:Play()
    tween.Completed:Wait()
    local clone2: Instance = militaryMeltdown.Blr:Clone()
    clone2:PivotTo(Center:GetPivot() * CFrame.Angles(0, math.pi, 0))
    clone2.Parent = workspace
    local value25 = AnimationController:Load(clone2.AnimationController.Animator, 89400215976354)
    local currentCamera = workspace.CurrentCamera
    local value26: number = 0
    local CFrame = nil
    local config5 = {}
    local onPreAnimation
    onPreAnimation = function()
        local timePosition = value25.TimePosition
        if value25.IsPlaying and value26 < timePosition then
            value26 = timePosition
            CFrame = clone2.RootPart.CamPart.Part0.CFrame * clone2.RootPart.CamPart.C0 * clone2.RootPart.CamPart.Transform
        end
        if CFrame then
            currentCamera.CameraType = Enum.CameraType.Scriptable
            currentCamera.CFrame = CFrame
        end
    end
    table.insert(config5, RunService.PreAnimation:Connect(onPreAnimation))
    local children: {Instance} = Lighting:GetChildren()
    for _2, value28 in children do
        value28.Parent = nil
    end
    local lighting = militaryMeltdown.Lighting
    local config6 = {}
    for key in lighting:GetAttributes() do
        config6[key] = Lighting[key]
    end
    for _3, value29 in lighting:Clone():GetChildren() do
        value29.Parent = Lighting
    end
    for key2, value30 in lighting:GetAttributes() do
        Lighting[key2] = value30
    end
    local config7 = {}
    for _4, value31 in LocalPlayer.PlayerGui:GetChildren() do
        if value31 == instance then
            continue
        end
        if not value31:IsA("ScreenGui") then
            continue
        end
        if not value31.Enabled then
            continue
        end
        value31.Enabled = false
        table.insert(config7, value31)
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
    for _5, value32 in config8 do
        value32.Parent = LocalPlayer.PlayerGui
    end
    local instance3: Sound = Instance.new("Sound")
    instance3.Name = "MeltdownCutsceneAmbience"
    instance3.SoundId = "rbxassetid://113127659745813"
    instance3.Looped = true
    instance3.Volume = 0.4
    instance3.Parent = SoundService
    instance3.Looped = false
    local value34 = AnimationController:Load(animator, 73037425215243)
    local value35 = os.clock() + 5
    while os.clock() < value35 do
        if value25.Length > 0 and (value34.Length > 0 and instance3.IsLoaded) then
            break
        end
        task.wait()
    end
    local value36 = Moonlite.CreatePlayer(militaryMeltdown.Intro)
    value36.Looped = false
    value25:Play()
    local value37 = AnimationController:Play(animator, 73037425215243)
    value37.Priority = Enum.AnimationPriority.Action
    value34 = value37
    value36:Play()
    local config9 = { BackgroundTransparency = 1 }
    TweenService:Create(instance2, TweenInfo.new(0.5), config9):Play()
    local function delayed()
        instance3:Play()
    end

    task.delay(0.6, delayed)
    ForgeVFX.emit(clone.CutsceneCamwork1)
    local result4 = nil
    local value38: boolean = false
    local onPreAnimation2
    onPreAnimation2 = function()
        if not value38 and value36.TimePosition >= 4.833 then
            value38 = true
            ForgeVFX.emit(clone.EnabledBarrelSmoke)
            ForgeVFX.emit(clone.OpenBarrelEmit)
            ForgeVFX.emit(clone.CamZoom)
        end
        local TimePosition = result4
        if not TimePosition then
            TimePosition = value36.TimePosition
            if value36:GetTimeLength() - 0.5 <= TimePosition then
                local config10 = { BackgroundTransparency = 0 }
                local tween2 = TweenService:Create(instance2, TweenInfo.new(0.5), config10)
                tween2:Play()
                TimePosition = tween2
                result4 = TimePosition
            end
        end
    end
    table.insert(config5, RunService.PreAnimation:Connect(onPreAnimation2))
    value36.Completed:Wait()
    if not result4 then
        local tween2 = TweenService:Create(instance2, TweenInfo.new(0.5), value26)
        tween2:Play()
        result4 = tween2
    end
    local PlaybackState = result4.PlaybackState
    if PlaybackState == Enum.PlaybackState.Playing then
        result4.Completed:Wait()
    end
    if value3 then
        value3:Stop(0)
    end
    local value41 = AnimationController:Play(animator, 119837384893258, value26)
    value41.Priority = Enum.AnimationPriority.Idle
    value41.Looped = true
    value3 = value41
    value34:Stop()
    for _6, value42 in config5 do
        value42:Disconnect()
    end
    value36:Stop()
    value36:Destroy()
    Lighting:ClearAllChildren()
    for key3, value43 in config6 do
        Lighting[key3] = value43
    end
    for _7, value44 in children do
        value44.Parent = Lighting
    end
    fadeSoundOut(instance3)
    for _8, value45 in config8 do
        value45:Destroy()
    end
    for _9, value46 in config7 do
        value46.Enabled = true
    end
    if result3 then
        result3.Scale = 1
    end
    clone2:Destroy()
    clone:Destroy()
    currentCamera.CameraType = Enum.CameraType.Custom
    local config12 = { BackgroundTransparency = 1 }
    local tween3 = TweenService:Create(instance2, TweenInfo.new(0.5), config12)
    tween3:Play()
    tween3.Completed:Wait()
    instance:Destroy()
    local value48 = AnimationController:Play(animator, 127905115426978)
    value48.Priority = Enum.AnimationPriority.Action
    local function onStopped()
        if value3 then
            value3:Stop(0)
        end
        local value49 = AnimationController:Play(animator, 104097693446066, 0)
        value49.Priority = Enum.AnimationPriority.Idle
        value49.Looped = true
        value3 = value49
    end

    value48.Stopped:Once(onStopped)
end
local value50 = nil
local shakeOnImpact
shakeOnImpact = function()
    if not value50 then
        local function onShake(seed)
            local currentCamera2 = workspace.CurrentCamera
            if currentCamera2 then
                currentCamera2.CFrame *= seed
            end
        end

        local cameraShaker = CameraShaker.new(Enum.RenderPriority.Camera.Value + 1, onShake)
        cameraShaker:Start()
        value50 = cameraShaker
    end
    value50:ShakeOnce(6, 12, 0.1, 0.6)
end
local function attachTrail(seed)
    local Parent = if seed:IsA("Model") then seed.PrimaryPart else seed
    if not Parent then
        return
    end
    local instance: Attachment = Instance.new("Attachment")
    instance.Position = Vector3.new(0, Parent.Size.Y / 2 + 0.4, 0)
    instance.Parent = Parent
    local instance2: Attachment = Instance.new("Attachment")
    instance2.Position = Vector3.new(0, Parent.Size.Y / 2 - 0.4, 0)
    instance2.Parent = Parent
    local instance3: Trail = Instance.new("Trail")
    instance3.Attachment0 = instance
    instance3.Attachment1 = instance2
    instance3.Lifetime = 1.1
    instance3.LightEmission = 1
    instance3.Color = ColorSequence.new(Color3.new(1, 1, 1))
    instance3.Transparency = NumberSequence.new({
        NumberSequenceKeypoint.new(0, 0),
        NumberSequenceKeypoint.new(0.7, 0.25),
        NumberSequenceKeypoint.new(1, 1),
    })
    instance3.WidthScale = NumberSequence.new({ NumberSequenceKeypoint.new(0, 1.4), NumberSequenceKeypoint.new(1, 0.6) })
    instance3.FaceCamera = true
    instance3.Parent = Parent
end

local function riseNukeFromSilo(seed)
    local RiseTime = { name = "MeltdownSiloNuke", withOverhead = false }
    local value58 = NukeVisual.build(seed.Tier, RiseTime)
    if not value58 then
        RiseTime = seed.RiseTime
        task.wait(RiseTime)
        return
    else
        local value59 = seed.Scale or 3
        local Y
        if value58:IsA("Model") then
            value58:ScaleTo(value59)
            for _, _2 in value58:GetDescendants() do
                if _2:IsA("BasePart") then
                    _2.CanQuery = false
                    _2.CanTouch = false
                    _2.CastShadow = false
                end
            end
        else
            value58.Size *= value59
            Y = value58.Size.Y
            value58.CanQuery = false
            value58.CanTouch = false
            value58.CastShadow = false
        end
        attachTrail(value58)
        local position = workspace.Center:GetPivot().Position
        local value60 = -Y
        local value61 = seed.RiseHeight - value60
        value58.Parent = workspace.CurrentCamera
        local value62 = os.clock()
        local TargetPosition = math.clamp((os.clock() - value62) / seed.RiseTime, 0, 1)
        local ArcHeight = NukeBallistics.orientation(position + vector.create(0, 1, 0) * (value60 + value61 * TargetPosition * TargetPosition), vector.create(0, 1, 0), 0)
        while value58:IsA("Model") do
            value58:PivotTo(ArcHeight)
            if TargetPosition >= 1 then
                break
            end
            RunService.RenderStepped:Wait()
        end
        TargetPosition = seed.TargetPosition
        local flightTime = seed.FlightTime
        ArcHeight = seed.ArcHeight
        if TargetPosition and flightTime then
            if not ArcHeight then
                value58:Destroy()
                return
            else
                local function spawned()
                    local value65 = position + vector.create(0, 1, 0) * seed.RiseHeight
                    local result7 = value65
                    local value66 = os.clock()
                    while value58.Parent do
                        local value67 = math.clamp((os.clock() - value66) / flightTime, 0, 1)
                        local value68 = NukeBallistics.arc(value65, TargetPosition, value67, ArcHeight)
                        local CFrame = NukeBallistics.orientation(value68, value68 - result7, value67)
                        if value58:IsA("Model") then
                            value58:PivotTo(CFrame)
                        else
                            value58.CFrame = CFrame
                        end
                        result7 = value68
                        if value67 >= 1 then
                            break
                        end
                        RunService.RenderStepped:Wait()
                    end
                    value58:Destroy()
                end

                task.spawn(spawned)
            end
        end
    end
end

local playSiloLaunch
playSiloLaunch = function(seed)
    local CityModel2: Instance = workspace:WaitForChild("CityModel")
    local SiloDoor: Instance = CityModel2:WaitForChild("SiloDoor")
    local SiloLaunchVFX: Instance = CityModel2:WaitForChild("SiloLaunchVFX")
    local animator2 = SiloDoor.AnimationController.Animator
    local value71 = AnimationController:Play(animator2, 133831286058861)
    value71.Priority = Enum.AnimationPriority.Action
    local function onStopped2()
        if value3 then
            value3:Stop(0)
        end
        local value72 = AnimationController:Play(animator2, 119837384893258, 0)
        value72.Priority = Enum.AnimationPriority.Idle
        value72.Looped = true
        value3 = value72
    end

    value71.Stopped:Once(onStopped2)
    if seed.TargetUserId == LocalPlayer.UserId and seed.FlightTime then
        task.delay(seed.LaunchTime + seed.RiseTime + seed.FlightTime, shakeOnImpact)
    end
    local part: Instance = SiloDoor:FindFirstChild("Part")
    local Color = if part and part:IsA("BasePart") then part.Color else nil
    if part and Color then
        local config16 = { Color = Color3.new(1, 0.518958, 0.258824) }
        TweenService:Create(part, TweenInfo.new(seed.LaunchTime, Enum.EasingStyle.Cubic, Enum.EasingDirection.Out), config16):Play()
    end
    local function delayed2()
        ForgeVFX.emit(SiloLaunchVFX)
        if part and Color then
            local config17 = { Color = Color }
            TweenService:Create(part, TweenInfo.new(1.6), config17):Play()
        end
        riseNukeFromSilo(seed)
        if value71.IsPlaying then
            value71.Stopped:Wait()
        end
        local value73 = AnimationController:Play(animator2, 127905115426978)
        value73.Priority = Enum.AnimationPriority.Action
        local function onStopped()
            if value3 then
                value3:Stop(0)
            end
            local value74 = AnimationController:Play(animator2, 104097693446066, 0)
            value74.Priority = Enum.AnimationPriority.Idle
            value74.Looped = true
            value3 = value74
        end

        value73.Stopped:Once(onStopped)
    end

    task.delay(seed.LaunchTime, delayed2)
end
local Start
Start = function(seed)
    local onClientEvent2
    onClientEvent2 = function()
        if value then
            return
        end
        value2 = true
        setGameMusicSuppressed(true)
        Players.LocalPlayer:SetAttribute("MeltdownCutsceneActive", true)
        playIntroCutscene()
        value = false
        Players.LocalPlayer:SetAttribute("MeltdownCutsceneActive", false)
    end
    Remotes.MeltdownCutscene.OnClientEvent:Connect(onClientEvent2)
    local onClientEvent
    onClientEvent = function()
        value2 = false
        setGameMusicSuppressed(false)
    end
    Remotes.MeltdownEnded.OnClientEvent:Connect(onClientEvent)
    onClientEvent = playSiloLaunch
    Remotes.MeltdownSiloLaunch.OnClientEvent:Connect(onClientEvent)
end
local module = { Start = Start }
return module
