local Players: Players = game:GetService("Players")
local ReplicatedStorage: ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService: RunService = game:GetService("RunService")
local Nukes: Instance = ReplicatedStorage:WaitForChild("Nukes")
local Commanders: Instance = ReplicatedStorage.Assets:WaitForChild("Commanders")
local ImageColor3: Color3 = Color3.fromRGB(0, 0, 0)
local value2: Color3 = Color3.fromRGB(255, 255, 255)
local FramesManager = require(script.Parent.FramesManager)
local BigNum = require(ReplicatedStorage.Shared.BigNum)
local DataController = require(ReplicatedStorage.Controllers.DataController)
local CommanderData = require(ReplicatedStorage.Shared.CommanderData)
local IndexVisibility = require(ReplicatedStorage.Shared.IndexVisibility)
local CommanderRarityFlags = require(ReplicatedStorage.Shared.CommanderRarityFlags)
local ExplosionVFXData = require(ReplicatedStorage.Shared.ExplosionVFXData)
local MutationData = require(ReplicatedStorage.Shared.MutationData)
local MutationVisual = require(ReplicatedStorage.Shared.MutationVisual)
local BaseSkinData = require(ReplicatedStorage.Shared.BaseSkinData)
local BaseSkinController = require(ReplicatedStorage.Controllers.BaseSkinController)
local TooltipController = require(ReplicatedStorage.Controllers.TooltipController)
local entries = {}
local BaseSkins = { total = 0, entries = entries, discovered = {} }
BaseSkins = "Nukes"
entries = false
local Visible: boolean = false
local value4 = nil
local value5 = nil
local PlayerGui: Instance = Players.LocalPlayer:WaitForChild("PlayerGui")
local ScreenGui: Instance = PlayerGui:WaitForChild("ScreenGui")
local Frames: Instance = ScreenGui:WaitForChild("Frames")
local IndexFrame: Instance = Frames:WaitForChild("IndexFrame")
local ScrollContainer: Instance = IndexFrame:WaitForChild("ScrollContainer")
local ScrollingFrame: Instance = ScrollContainer:WaitForChild("ScrollingFrame")
local Tabs: Instance = IndexFrame:WaitForChild("Tabs")
local Template: Instance = ScrollingFrame:WaitForChild("Template")
Template.Parent = nil
local CommanderTemplate: Instance = ScrollingFrame:WaitForChild("CommanderTemplate")
CommanderTemplate.Parent = nil
local MutationTemplate: Instance = ScrollingFrame:WaitForChild("MutationTemplate")
MutationTemplate.Parent = nil
local clone: Instance = Template:Clone()
clone.Name = "ExplosionTemplate"
local viewportFrame: Instance = clone:FindFirstChild("ViewportFrame")
local instance: ImageLabel = Instance.new("ImageLabel")
instance.Name = "Icon"
instance.BackgroundTransparency = 1
instance.AnchorPoint = Vector2.new(0.5, 0.5)
instance.Position = UDim2.fromScale(0.5, 0.5)
instance.Size = UDim2.fromScale(1, 1)
instance.ScaleType = Enum.ScaleType.Fit
instance.ZIndex = 1
instance.Parent = clone
local config11 = {
    Nukes = { total = 0, folder = Nukes, entries = {}, discovered = {} },
    Commanders = { total = 0, folder = Commanders, entries = {}, discovered = {} },
    ExplosionVFXs = { total = 0, entries = {}, discovered = {} },
    Mutations = { total = 0, entries = {}, discovered = {} },
    BaseSkins = BaseSkins,
}
local module = {}
if viewportFrame then
    viewportFrame:Destroy()
end
local rarityOutline: Instance = clone:FindFirstChild("RarityOutline")
if rarityOutline then
    rarityOutline.ZIndex = 2
end
local textLabel: Instance = clone:FindFirstChild("TextLabel")
if textLabel then
    textLabel:Destroy()
end
local textLabel2: Instance = CommanderTemplate:FindFirstChild("TextLabel")
if textLabel2 then
    textLabel2:Clone().Parent = clone
end
local rarityLabel: Instance = CommanderTemplate:FindFirstChild("RarityLabel")
if rarityLabel and not clone:FindFirstChild("RarityLabel") then
    rarityLabel:Clone().Parent = clone
end
local clone2: Instance = Template:Clone()
clone2.Name = "BaseSkinTemplate"
textLabel = "TextLabel"
local child: Instance = clone2:FindFirstChild(textLabel)
if child then
    child:Destroy()
end
textLabel2 = "TextLabel"
local child2: Instance = CommanderTemplate:FindFirstChild(textLabel2)
if child2 then
    child2:Clone().Parent = clone2
end
rarityLabel = "RarityLabel"
local child3: Instance = CommanderTemplate:FindFirstChild(rarityLabel)
if child3 then
    child3:Clone().Parent = clone2
end
local Header: Instance = IndexFrame:WaitForChild("Header")
local Discovered: Instance = Header:WaitForChild("Discovered")
local function getNukeIds()
    local config12 = {}
    for _, value7 in pairs(config11.Nukes.folder:GetChildren()) do
        local value8: number? = tonumber(value7.Name)
        if value8 then
            table.insert(config12, value8)
        end
    end
    local function compare(value9, index)
        local value10 = value9 < index
        return value10
    end

    table.sort(config12, compare)
    return config12
end

local function getCommanderIds()
    local config13 = {}
    for key, _ in CommanderData do
        table.insert(config13, key)
    end
    local function compare2(value11, index2)
        local rarity = CommanderData[value11].Rarity
        local rarity2 = CommanderData[index2].Rarity
        local result = rarity and rarity.Order or 0
        local result2 = rarity2 and rarity2.Order or 0
        if result ~= result2 then
            local value12 = result < result2
            return value12
        else
            local value122 = value11 < index2
            return value122
        end
    end

    table.sort(config13, compare2)
    return config13
end

local function getExplosionVFXIds()
    local config14 = {}
    for key2, value13 in ExplosionVFXData.List do
        if not value13.Collectible then
            continue
        end
        if value13.HideFromIndex then
            continue
        end
        table.insert(config14, key2)
    end
    local function compare3(value14, index3)
        local rarity3 = ExplosionVFXData.List[value14].Rarity
        local rarity4 = ExplosionVFXData.List[index3].Rarity
        local result3 = rarity3 and rarity3.Order or 0
        local result4 = rarity4 and rarity4.Order or 0
        if result3 ~= result4 then
            local value15 = result3 < result4
            return value15
        else
            local value152 = value14 < index3
            return value152
        end
    end

    table.sort(config14, compare3)
    return config14
end

local function getMutationIds()
    local config15 = {}
    for key3 in MutationData do
        table.insert(config15, key3)
    end
    local function compare4(value16, index4)
        local value17 = ExplosionVFXData.Rarities[MutationData[value16].Rarity]
        local value18 = ExplosionVFXData.Rarities[MutationData[index4].Rarity]
        local result5 = value17 and value17.Order or 0
        local result6 = value18 and value18.Order or 0
        if result5 ~= result6 then
            local value19 = result5 < result6
            return value19
        else
            local value192 = value16 < index4
            return value192
        end
    end

    table.sort(config15, compare4)
    return config15
end

local function getBaseSkinIds()
    local config16 = {}
    for key4 in BaseSkinData.Skins do
        table.insert(config16, key4)
    end
    local function compare5(value20, index5)
        local order = BaseSkinData.Skins[value20].Rarity.Order
        local order2 = BaseSkinData.Skins[index5].Rarity.Order
        if order ~= order2 then
            local value21 = order < order2
            return value21
        else
            local value212 = value20 < index5
            return value212
        end
    end

    table.sort(config16, compare5)
    return config16
end

local function displayValue(seed)
    return 2 ^ (seed - 1)
end

local function formatTierNumber(seed)
    return BigNum.format(BigNum.new(seed))
end

local function entryVisible(value24, index6)
    return if config11[value24].discovered[index6] then true else IndexVisibility.isVisible(value24, index6)
end

local applyEntryVisibility
applyEntryVisibility = function(value25, index7)
    local value26 = config11[value25].entries[index7]
    if not value26 then
        return
    end
    local frame = value26.frame
    local Visible2: boolean = false
    if BaseSkins == value25 then
        Visible2 = if value25 then true else IndexVisibility.isVisible(value25, index7)
    end
    frame.Visible = Visible2
end
local refreshCounter
refreshCounter = function()
    if not Discovered then
        return
    end
    local Discovered2 = config11[BaseSkins]
    local value27: number = 0
    for _ in Discovered2.entries do
        if Discovered2.discovered[_] then
            value27 += 1
        end
    end
end
local refreshVisibility
refreshVisibility = function()
    for key5 in config11[BaseSkins].entries do
        local value28 = config11[BaseSkins].entries[key5]
        if not value28 then
            continue
        end
        local frame2 = value28.frame
        local Visible2: boolean = false
        if BaseSkins == BaseSkins then
            Visible2 = if BaseSkins then true else IndexVisibility.isVisible(BaseSkins, key5)
        end
        frame2.Visible = Visible2
    end
    refreshCounter()
end
local function visibleFrame(seed)
    local vector3 = vector.create(1000000000, 1000000000, 1000000000)
    local vector32 = vector.create(-1000000000, -1000000000, -1000000000)
    local value32 = vector.create(0, 0, 0)
    local value33: number = 0
    for _, Y in seed:GetDescendants() do
        if Y:IsA("BasePart") then
            if Y.Transparency >= 1 then
                continue
            end
            local cframe = Y.CFrame
            local size = Y.Size
            for i = -1, 1, 2 do
                for j = -1, 1, 2 do
                    for k = -1, 1, 2 do
                        local position = (cframe * CFrame.new(size.X * 0.5 * i, size.Y * 0.5 * j, size.Z * 0.5 * k)).Position
                        vector3 = Vector3.new(math.min(vector3.X, position.X), math.min(vector3.Y, position.Y), math.min(vector3.Z, position.Z))
                        vector32 = Vector3.new(math.max(vector32.X, position.X), math.max(vector32.Y, position.Y), math.max(vector32.Z, position.Z))
                    end
                    if value33 <= 0 then
                        return nil, nil
                    end
                    local value35 = vector32 - vector3
                    local _2 = value35.X
                    Y = value35.Y
                    cframe = value35.Z
                    return value32 / value33, math.max(_2, Y, cframe)
                end
            end
            local value36 = math.max(size.X * size.Y * size.Z, 0.001)
            value32 += Y.Position * value36
            value33 += value36
        end
    end
end

local function loopAnimation(value37, AnimationContent)
    if value37 then
        if not AnimationContent then
            return false
        end
        local instance2: Animation = Instance.new("Animation")
        if typeof(AnimationContent) == "string" then
            instance2.AnimationId = AnimationContent
        else
            local function protected()
                instance2.AnimationContent = AnimationContent
            end

            pcall(protected)
        end
        local function protected2()
            return value37:LoadAnimation(instance2)
        end

        local result8, value39 = pcall(protected2)
        if result8 then
            if not value39 then
                return false
            end
            value39.Looped = true
            value39.Priority = Enum.AnimationPriority.Action
            value39:Play(0)
            return true
        end
    end
end

local function setupCommanderAnimation(value40, index12)
    if not index12 then
        return
    end
    local mount: Instance = value40:FindFirstChild("Mount")
    local ClaimableCommanderIdleAnimation = mount
    if ClaimableCommanderIdleAnimation then
        ClaimableCommanderIdleAnimation = mount:FindFirstChildWhichIsA("Animator", true)
    end
    loopAnimation(ClaimableCommanderIdleAnimation, index12.ClaimableMountIdleAnimation)
    local child4 = (value40:FindFirstChild("Commander") or value40):FindFirstChildWhichIsA("Animator", true)
    ClaimableCommanderIdleAnimation = index12.ClaimableCommanderIdleAnimation
    if not ClaimableCommanderIdleAnimation then
        ClaimableCommanderIdleAnimation = index12.HelicopterIdleAnimation
    end
    loopAnimation(child4, ClaimableCommanderIdleAnimation)
end

local connection = nil
local config17 = {}
local ensureBobbingLoop
ensureBobbingLoop = function()
    if connection then
        return
    end
    local onRenderStepped
    onRenderStepped = function()
        local Visible2 = IndexFrame.Visible
        if Visible2 then
            Visible2 = BaseSkins
            if Visible2 ~= "Commanders" then
                return
            end
            local value42 = os.clock()
            local value43: number = 0
            local value44 = math.cos(value42 * 1.5) * 0.04
            local value45 = CFrame.new(0, math.sin(value42 * 2) * 0.25, 0) * CFrame.Angles(math.sin(value42 * 1.2) * 0.04, value43, value44)
            for _, _2 in config17 do
                if _2.Parent then
                    _2:PivotTo(_2 * value45)
                    continue
                end
                config17[_2] = nil
            end
        end
    end
    local connection2: RBXScriptConnection = RunService.RenderStepped:Connect(onRenderStepped)
    connection = connection2
end
local startCommanderAnimation
startCommanderAnimation = function(a, b, c)
    if b then
        if not c then
            return
        end
        local instance2: WorldModel = Instance.new("WorldModel")
        instance2.Parent = a
        b.Parent = instance2
        setupCommanderAnimation(b, c)
        if b:FindFirstChild("Mount") then
            config17[b] = b:GetPivot()
            if connection then
                return
            end
            local function onRenderStepped()
                local Visible2 = IndexFrame.Visible
                if Visible2 then
                    Visible2 = BaseSkins
                    if Visible2 ~= "Commanders" then
                        return
                    end
                    local value48 = os.clock()
                    local value49: number = 0
                    local value50 = math.cos(value48 * 1.5) * 0.04
                    local value51 = CFrame.new(0, math.sin(value48 * 2) * 0.25, 0) * CFrame.Angles(math.sin(value48 * 1.2) * 0.04, value49, value50)
                    for _, _2 in config17 do
                        if _2.Parent then
                            _2:PivotTo(_2 * value51)
                            continue
                        end
                        config17[_2] = nil
                    end
                end
            end

            connection = RunService.RenderStepped:Connect(onRenderStepped)
        end
    end
end
local function populateViewport(value52, index14, count2, options, arg4)
    local result11 = count2 or index14:FindFirstChild(count2)
    if not result11 then
        return
    end
    for _, _2 in value52:GetChildren() do
        local result12: string = "BasePart"
        if _2:IsA(result12) then
            continue
        end
        result12 = "Model"
        if _2:IsA(result12) then
            continue
        end
        result12 = "WorldModel"
        if _2:IsA(result12) then
            continue
        end
        result12 = "Camera"
        if _2:IsA(result12) then
            _2:Destroy()
        end
    end
end

module.PopulateViewport = populateViewport
module.SetupCommanderAnimation = setupCommanderAnimation
module.LoopAnimation = loopAnimation
local function refreshCommanderTooltip(seed)
    local value54 = config11.Commanders.entries[seed]
    if not value54 then
        return
    end
    local value55 = CommanderData[seed]
    if config11.Commanders.discovered[seed] and value55 then
        if value55.Specialty then
            TooltipController:AddTooltip(value54.frame, "Role: %*":format(value55.Specialty))
            return
        else
            TooltipController:RemoveTooltip(value54.frame)
        end
    end
end

local function refreshMutationTooltip(seed)
    local value57 = config11.Mutations.entries[seed]
    if not value57 then
        return
    end
    local value58 = MutationData[seed]
    if config11.Mutations.discovered[seed] then
        if value58 then
            TooltipController:AddTooltip(TooltipController:AddTooltip())
            return
        else
            TooltipController:RemoveTooltip(value57.frame)
        end
    end
end

local function applyEntryState(value59, index15)
    local value60 = config11[value59].entries[index15]
    if not value60 then
        return
    end
    local value61 = config11[value59].discovered[index15]
    local viewport = value60.viewport
    local Visible2 = value61 and value2 or ImageColor3
    viewport.ImageColor3 = Visible2
    if value59 == "Commanders" then
        Visible2 = index15
        refreshCommanderTooltip(Visible2)
    end
    if value59 == "Commanders" then
        if not value60.commanderData.ViewportDoNotFloatAnimation then
            local textLabel3 = value60.frame.TextLabel
            Visible2 = value61 == true
            textLabel3.Visible = Visible2
            if value61 then
                textLabel3 = value60.model
                if textLabel3 then
                    textLabel3 = value60.animated
                    if not textLabel3 then
                        Visible2 = value60.viewport
                        startCommanderAnimation(Visible2, value60.model, value60.commanderData)
                        value60.animated = true
                        return
                    end
                end
            end
        elseif value59 == "ExplosionVFXs" then
            if value60.label then
                local label = value60.label
                Visible2 = value61 == true
                label.Visible = Visible2
            end
            local label2 = value60.viewport
            Visible2 = 0
            label2.ImageTransparency = Visible2
            return
        elseif value59 == "Mutations" then
            local label3 = value60.label
            if label3 then
                label3 = value60.label
                Visible2 = value61 == true
                label3.Visible = Visible2
            end
            label3 = config11.Mutations.entries[index15]
            if not label3 then
                return
            end
            local value62 = MutationData[index15]
            if config11.Mutations.discovered[index15] then
                if value62 then
                    TooltipController:AddTooltip(TooltipController:AddTooltip())
                    return
                else
                    TooltipController:RemoveTooltip(label3.frame)
                    return
                end
            end
        elseif value59 == "BaseSkins" then
            local label4 = value60.label
            if label4 then
                label4 = value60.label
                local Visible3 = value61 == true
                label4.Visible = Visible3
            end
        end
    end
end

local onDiscoveredNuke
onDiscoveredNuke = function(value63, index16)
    if index16 == nil then
        return
    end
    local value64: number? = tonumber(value63)
    if value64 then
        if config11.Nukes.discovered[value64] then
            return
        end
        config11.Nukes.discovered[value64] = true
        local value65 = config11.Nukes.entries[value64]
        if not value65 then
        else
            local viewport2 = value65.viewport
            local ImageColor32 = config11.Nukes.discovered[value64] and value2 or ImageColor3
            viewport2.ImageColor3 = ImageColor32
        end
        local viewport22 = config11
        value65 = viewport22.Nukes.entries[value64]
        if not value65 then
        else
            local frame3 = value65.frame
            viewport22 = false
            local result16 = BaseSkins
            if result16 == "Nukes" then
                result16 = config11.Nukes.discovered[value64]
                if result16 then
                    viewport22 = true
                else
                    result16 = "Nukes"
                    viewport22 = IndexVisibility.isVisible(result16, value64)
                end
            end
            frame3.Visible = viewport22
        end
        value65 = BaseSkins
        if value65 == "Nukes" then
            refreshCounter()
        end
    end
end
local onDiscoveredCommander
onDiscoveredCommander = function(value66, index17)
    if index17 == nil then
        return
    end
    local value67: string = tostring(value66)
    if value67 then
        if config11.Commanders.discovered[value67] then
            return
        end
        config11.Commanders.discovered[value67] = true
        local value68 = config11.Commanders.entries[value67]
        if not value68 then
        else
            local value69 = config11.Commanders.discovered[value67]
            local viewport3 = value68.viewport
            local Visible2 = value69 and value2 or ImageColor3
            viewport3.ImageColor3 = Visible2
            Visible2 = value67
            refreshCommanderTooltip(Visible2)
            if not value68.commanderData.ViewportDoNotFloatAnimation then
                local textLabel4 = value68.frame.TextLabel
                Visible2 = value69 == true
                textLabel4.Visible = Visible2
                if value69 then
                    textLabel4 = value68.model
                    if textLabel4 then
                        textLabel4 = value68.animated
                        if not textLabel4 then
                            Visible2 = value68.viewport
                            startCommanderAnimation(Visible2, value68.model, value68.commanderData)
                            value68.animated = true
                        end
                    end
                end
            end
        end
        value68 = config11.Commanders.entries[value67]
        if not value68 then
        else
            local frame4 = value68.frame
            local Visible3: boolean = false
            local result17 = BaseSkins
            if result17 == "Commanders" then
                result17 = config11.Commanders.discovered[value67]
                if result17 then
                    Visible3 = true
                else
                    result17 = "Commanders"
                    Visible3 = IndexVisibility.isVisible(result17, value67)
                end
            end
            frame4.Visible = Visible3
        end
        value68 = BaseSkins
        if value68 == "Commanders" then
            refreshCounter()
        end
    end
end
local onDiscoveredMutation
onDiscoveredMutation = function(value70, index18)
    if index18 == nil then
        return
    end
    local value71: string = tostring(value70)
    if config11.Mutations.discovered[value71] then
        return
    end
    config11.Mutations.discovered[value71] = true
    local value72 = config11.Mutations.entries[value71]
    if not value72 then
    else
        local value73 = config11.Mutations.discovered[value71]
        local viewport4 = value72.viewport
        local Visible2 = value73 and value2 or ImageColor3
        viewport4.ImageColor3 = Visible2
        local viewport42 = value72.label
        if viewport42 then
            viewport42 = value72.label
            Visible2 = value73 == true
            viewport42.Visible = Visible2
        end
        viewport42 = config11.Mutations.entries[value71]
        if not viewport42 then
        else
            local value74 = MutationData[value71]
            if config11.Mutations.discovered[value71] then
                if value74 then
                    TooltipController:AddTooltip(TooltipController:AddTooltip())
                else
                    TooltipController:RemoveTooltip(viewport42.frame)
                end
            end
        end
    end
    local viewport43 = config11
    value72 = viewport43.Mutations.entries[value71]
    if not value72 then
    else
        local frame5 = value72.frame
        viewport43 = false
        local value742 = BaseSkins
        if value742 == "Mutations" then
            value742 = config11.Mutations.discovered[value71]
            if value742 then
                viewport43 = true
            else
                value742 = "Mutations"
                viewport43 = IndexVisibility.isVisible(value742, value71)
            end
        end
        frame5.Visible = viewport43
    end
    value72 = BaseSkins
    if value72 == "Mutations" then
        refreshCounter()
    end
end
local onDiscoveredExplosionVFX
onDiscoveredExplosionVFX = function(value75, index19)
    if index19 == nil then
        return
    end
    local value76: string = tostring(value75)
    if config11.ExplosionVFXs.discovered[value76] then
        return
    end
    config11.ExplosionVFXs.discovered[value76] = true
    local value77 = config11.ExplosionVFXs.entries[value76]
    if not value77 then
    else
        local value78 = config11.ExplosionVFXs.discovered[value76]
        local viewport5 = value77.viewport
        local ImageTransparency = value78 and value2 or ImageColor3
        viewport5.ImageColor3 = ImageTransparency
        local viewport52 = value77.label
        if viewport52 then
            viewport52 = value77.label
            ImageTransparency = value78 == true
            viewport52.Visible = ImageTransparency
        end
        viewport52 = value77.viewport
        ImageTransparency = 0
        viewport52.ImageTransparency = ImageTransparency
    end
    local viewport53 = config11
    value77 = viewport53.ExplosionVFXs.entries[value76]
    if not value77 then
    else
        local frame6 = value77.frame
        viewport53 = false
        local result19 = BaseSkins
        if result19 == "ExplosionVFXs" then
            result19 = config11.ExplosionVFXs.discovered[value76]
            if result19 then
                viewport53 = true
            else
                result19 = "ExplosionVFXs"
                viewport53 = IndexVisibility.isVisible(result19, value76)
            end
        end
        frame6.Visible = viewport53
    end
    value77 = BaseSkins
    if value77 == "ExplosionVFXs" then
        refreshCounter()
    end
end
local onDiscoveredBaseSkin
onDiscoveredBaseSkin = function(value79, index20)
    if index20 == nil then
        return
    end
    local value80: string = tostring(value79)
    if config11.BaseSkins.discovered[value80] then
        return
    end
    config11.BaseSkins.discovered[value80] = true
    local value81 = config11.BaseSkins.entries[value80]
    if not value81 then
    else
        local value82 = config11.BaseSkins.discovered[value80]
        local viewport6 = value81.viewport
        local Visible2 = value82 and value2 or ImageColor3
        viewport6.ImageColor3 = Visible2
        local viewport62 = value81.label
        if viewport62 then
            viewport62 = value81.label
            Visible2 = value82 == true
            viewport62.Visible = Visible2
        end
    end
    local viewport63 = config11
    value81 = viewport63.BaseSkins.entries[value80]
    if not value81 then
    else
        local frame7 = value81.frame
        viewport63 = false
        local result20 = BaseSkins
        if result20 == "BaseSkins" then
            result20 = config11.BaseSkins.discovered[value80]
            if result20 then
                viewport63 = true
            else
                result20 = "BaseSkins"
                viewport63 = IndexVisibility.isVisible(result20, value80)
            end
        end
        frame7.Visible = viewport63
    end
    value81 = BaseSkins
    if value81 == "BaseSkins" then
        refreshCounter()
    end
end
local switchTab
switchTab = function(seed)
    if BaseSkins == seed then
        return
    end
    BaseSkins = seed
    for _, _2 in config11[BaseSkins].entries do
        _2.frame.Visible = false
    end
end
local refreshMutationLock
refreshMutationLock = function()
    if value4 then
        value4.Text = "Unlocks at rebirth %*!":format(3)
        value4.Visible = not Visible
    end
    local result21 = value5
    if result21 then
        result21 = value5
        result21.Visible = Visible
    end
end
local buildCategory
buildCategory = function(value84, index21, count3, options2)
    local result21 = value84 == "Nukes" and getNukeIds() or getCommanderIds()
    config11[value84].total = #result21
    for LayoutOrder, value85 in result21 do
        local clone3: Instance = index21:Clone()
        clone3.Name = `{count3}_` .. tostring(value85)
        clone3.Visible = true
        clone3.LayoutOrder = LayoutOrder
        local commanderData = CommanderData[value85]
        local textLabel5: Instance = clone3:FindFirstChild("TextLabel")
        if textLabel5 then
            if options2 then
                textLabel5.Text = `Tier {BigNum.format(BigNum.new(2 ^ (value85 - 1)))}`
            else
                local Text = commanderData and commanderData.DisplayName or tostring(value85)
                textLabel5.Text = Text
            end
            if value84 == "Commanders" then
                local Visible2 = config11[value84].discovered[value85] == true
                textLabel5.Visible = Visible2
            end
        end
        local rarityLabel2: Instance = clone3:FindFirstChild("RarityLabel")
        if rarityLabel2 then
            local result23 = commanderData or commanderData.Rarity
            if result23 then
                rarityLabel2.Text = result23.DisplayName
                if typeof(result23.Color) == "Color3" then
                    rarityLabel2.TextColor3 = result23.Color
                elseif typeof(result23.Color) == "ColorSequence" then
                    local instance2 = rarityLabel2:FindFirstChildOfClass("UIGradient")
                    if not instance2 then
                        instance2 = Instance.new("UIGradient")
                        instance2.Parent = rarityLabel2
                    end
                    instance2.Color = result23.Color
                end
                local LayoutOrder2 = (result23.Order or 1) * 1000 + LayoutOrder
                clone3.LayoutOrder = LayoutOrder2
            end
        end
        local viewportFrame2: Instance = clone3:FindFirstChild("ViewportFrame")
        local ViewportTemplateInstance = nil
        if viewportFrame2 then
            if value84 == "Commanders" then
                ViewportTemplateInstance = commanderData.ViewportTemplateInstance
                if not ViewportTemplateInstance then
                    ViewportTemplateInstance = commanderData.ClaimableCommanderTemplateInstance or tostring(value85)
                end
            else
                ViewportTemplateInstance = tostring(value85)
            end
            local folder = config11[value84].folder
            local value87 = value84 == "Commanders"
            ViewportTemplateInstance = populateViewport(viewportFrame2, folder, ViewportTemplateInstance, value87, commanderData)
            viewportFrame2.ImageColor3 = ImageColor3
        end
        local locked: Instance = clone3:FindFirstChild("Locked")
        local Parent: boolean = false
        if BaseSkins == value84 then
            ViewportTemplateInstance = config11
            Parent = if value84 then true else IndexVisibility.isVisible(value84, value85)
        end
        clone3.Visible = Parent
        Parent = ScrollingFrame
        clone3.Parent = Parent
        Parent = config11[value84]
        Parent = Parent.entries
        local config18 = {
            animated = false,
            frame = clone3,
            viewport = viewportFrame2,
            label = textLabel5,
            lockedFrame = locked,
            model = ViewportTemplateInstance,
            commanderData = commanderData,
        }
        Parent[value85] = config18
    end
    for key7 in config11[value84].discovered do
        value86 = value84
        textLabel5 = key7
        applyEntryState(value86, textLabel5)
    end
end
local buildExplosionCategory
buildExplosionCategory = function()
    local explosionVFXIds = getExplosionVFXIds()
    config11.ExplosionVFXs.total = #explosionVFXIds
    for key8, value89 in explosionVFXIds do
        local value90 = ExplosionVFXData.List[value89]
        local clone4: Instance = clone:Clone()
        clone4.Name = `ExplosionVFX_{value89}`
        clone4.LayoutOrder = (value90.Rarity.Order or 1) * 1000 + key8
        local icon: Instance = clone4:FindFirstChild("Icon")
        if icon then
            icon.Image = value90.PreviewImage
            icon.ImageColor3 = ImageColor3
        end
        local rarityOutline2: Instance = clone4:FindFirstChild("RarityOutline")
        if rarityOutline2 then
            rarityOutline2.ImageColor3 = value90.Rarity.Color
        end
        local textLabel6: Instance = clone4:FindFirstChild("TextLabel")
        if textLabel6 then
            textLabel6.Text = value90.DisplayName
            local Visible2 = config11.ExplosionVFXs.discovered[value89] == true
            textLabel6.Visible = Visible2
        end
        local rarityLabel3: Instance = clone4:FindFirstChild("RarityLabel")
        if rarityLabel3 then
            rarityLabel3.Text = value90.Rarity.DisplayName
            if typeof(value90.Rarity.Color) == "Color3" then
                rarityLabel3.TextColor3 = value90.Rarity.Color
                local child5 = rarityLabel3:FindFirstChildOfClass("UIGradient")
                if child5 then
                    child5.Enabled = false
                end
            end
        end
        local child52: boolean = false
        if BaseSkins == "ExplosionVFXs" then
            child52 = if "ExplosionVFXs" then true else IndexVisibility.isVisible("ExplosionVFXs", value89)
        end
        clone4.Visible = child52
        child52 = ScrollingFrame
        clone4.Parent = child52
        child52 = config11
        child52 = child52.ExplosionVFXs
        child52 = child52.entries
        local config19 = { animated = false, frame = clone4, viewport = icon, label = textLabel6 }
        child52[value89] = config19
    end
    for key9 in config11.ExplosionVFXs.discovered do
        icon = config11
        value90 = icon.ExplosionVFXs.entries[key9]
        if not value90 then
            continue
        end
        local value92 = rarityOutline2.ExplosionVFXs.discovered[key9]
        local viewport7 = value90.viewport
        rarityOutline2 = value92 and value2 or ImageColor3
        viewport7.ImageColor3 = rarityOutline2
        local viewport72 = value90.label
        if viewport72 then
            viewport72 = value90.label
            rarityOutline2 = value92 == true
            viewport72.Visible = rarityOutline2
        end
        viewport72 = value90.viewport
        rarityOutline2 = 0
        viewport72.ImageTransparency = rarityOutline2
    end
end
local buildMutationCategory
buildMutationCategory = function()
    local mutationIds = getMutationIds()
    config11.Mutations.total = #mutationIds
    for key10, value94 in mutationIds do
        local value95 = MutationData[value94]
        local value96 = ExplosionVFXData.Rarities[value95.Rarity]
        local clone5: Instance = MutationTemplate:Clone()
        clone5.Name = `Mutation_{value94}`
        local result26 = value96 and value96.Order or 1
        clone5.LayoutOrder = result26 * 1000 + key10
        result26 = "Icon"
        local child6: Instance = clone5:FindFirstChild(result26)
        if child6 then
            child6.Image = value95.Icon
            child6.ImageColor3 = ImageColor3
        end
        local rarityOutline3: Instance = clone5:FindFirstChild("RarityOutline")
        if rarityOutline3 and (value96 and typeof(value96.Color) == "Color3") then
            rarityOutline3.ImageColor3 = value96.Color
        end
        local textLabel7: Instance = clone5:FindFirstChild("TextLabel")
        if textLabel7 then
            textLabel7.Text = value95.Name
            local Visible2 = config11.Mutations.discovered[value94] == true
            textLabel7.Visible = Visible2
        end
        local rarityLabel4: Instance = clone5:FindFirstChild("RarityLabel")
        if rarityLabel4 and value96 then
            rarityLabel4.Text = value96.DisplayName
            if typeof(value96.Color) == "Color3" then
                rarityLabel4.TextColor3 = value96.Color
            end
        end
        local Mutations: boolean = false
        if BaseSkins == "Mutations" then
            Mutations = if "Mutations" then true else IndexVisibility.isVisible("Mutations", value94)
        end
        clone5.Visible = Mutations
        Mutations = ScrollingFrame
        clone5.Parent = Mutations
        Mutations = config11
        Mutations = Mutations.Mutations
        Mutations = Mutations.entries
        local config20 = { animated = false, frame = clone5, viewport = child6, label = textLabel7 }
        Mutations[value94] = config20
        Mutations = config11.Mutations.entries[value94]
        if not Mutations then
            continue
        end
        local value98 = MutationData[value94]
        if not config11.Mutations.discovered[value94] then
            continue
        end
        if value98 then
            TooltipController:AddTooltip(TooltipController:AddTooltip())
        else
            TooltipController:RemoveTooltip(Mutations.frame)
        end
    end
    for key11 in config11.Mutations.discovered do
        local clone52 = config11
        local value952 = clone52.Mutations.entries[key11]
        if not value952 then
            continue
        end
        local value99 = child6.Mutations.discovered[key11]
        local viewport8 = value952.viewport
        child6 = value99 and value2 or ImageColor3
        viewport8.ImageColor3 = child6
        local viewport82 = value952.label
        if viewport82 then
            viewport82 = value952.label
            child6 = value99 == true
            viewport82.Visible = child6
        end
        viewport82 = config11.Mutations.entries[key11]
        if not viewport82 then
        else
            local value100 = MutationData[key11]
            if config11.Mutations.discovered[key11] then
                if value100 then
                    rarityLabel4 = viewport82.frame
                    local value982 = value100
                    TooltipController:AddTooltip(TooltipController:AddTooltip())
                else
                    rarityLabel4 = viewport82.frame
                    TooltipController:RemoveTooltip(rarityLabel4)
                end
            end
        end
    end
end
local buildBaseSkinCategory
buildBaseSkinCategory = function()
    config11.BaseSkins.discovered[BaseSkinData.DefaultKey] = true
    local baseSkinIds = getBaseSkinIds()
    config11.BaseSkins.total = #baseSkinIds
    for key12, value102 in baseSkinIds do
        local value103 = BaseSkinData.Skins[value102]
        local rarity5 = value103.Rarity
        local clone6: Instance = clone2:Clone()
        clone6.Name = `BaseSkin_{value102}`
        clone6.LayoutOrder = rarity5.Order * 1000 + key12
        local textLabel8: Instance = clone6:FindFirstChild("TextLabel")
        if textLabel8 then
            textLabel8.Text = value103.DisplayName
            local Visible2 = config11.BaseSkins.discovered[value102] == true
            textLabel8.Visible = Visible2
        end
        local rarityLabel5: Instance = clone6:FindFirstChild("RarityLabel")
        if rarityLabel5 then
            rarityLabel5.Text = rarity5.DisplayName
            if typeof(rarity5.Color) == "Color3" then
                rarityLabel5.TextColor3 = rarity5.Color
                local child7 = rarityLabel5:FindFirstChildOfClass("UIGradient")
                if child7 then
                    child7.Enabled = false
                end
            elseif typeof(rarity5.Color) == "ColorSequence" then
                local instance2 = rarityLabel5:FindFirstChildOfClass("UIGradient")
                if not instance2 then
                    instance2 = Instance.new("UIGradient")
                    instance2.Parent = rarityLabel5
                end
                instance2.Enabled = true
                instance2.Color = rarity5.Color
            end
        end
        local viewportFrame3: Instance = clone6:FindFirstChild("ViewportFrame")
        if viewportFrame3 then
            if value103.Icon then
                local instance3: ImageLabel = Instance.new("ImageLabel")
                instance3.Name = "Icon"
                instance3.BackgroundTransparency = 1
                instance3.Size = UDim2.fromScale(1, 1)
                instance3.ScaleType = Enum.ScaleType.Fit
                instance3.Image = value103.Icon
                instance3.ImageColor3 = ImageColor3
                instance3.Parent = viewportFrame3
                result29 = instance3
            else
                populateViewport(viewportFrame3, nil, BaseSkinController.BuildPreviewIsland(value102), false, nil)
                viewportFrame3.ImageColor3 = ImageColor3
            end
        end
        local BaseSkins2 = false
        if BaseSkins == "BaseSkins" then
            BaseSkins2 = if "BaseSkins" then true else IndexVisibility.isVisible("BaseSkins", value102)
        end
        clone6.Visible = BaseSkins2
        BaseSkins2 = ScrollingFrame
        clone6.Parent = BaseSkins2
        BaseSkins2 = config11
        BaseSkins2 = BaseSkins2.BaseSkins
        BaseSkins2 = BaseSkins2.entries
        local config21 = { animated = false, frame = clone6, viewport = BaseSkins2, label = textLabel8 }
        BaseSkins2[value102] = config21
    end
    for key13 in config11.BaseSkins.discovered do
        clone6 = config11
        value103 = clone6.BaseSkins.entries[key13]
        if not value103 then
            continue
        end
        local value106 = textLabel8.BaseSkins.discovered[key13]
        local viewport9 = value103.viewport
        textLabel8 = value106 and value2 or ImageColor3
        viewport9.ImageColor3 = textLabel8
        local viewport92 = value103.label
        if not viewport92 then
            continue
        end
        viewport92 = value103.label
        textLabel8 = value106 == true
        viewport92.Visible = textLabel8
    end
end
local function refreshCommanderRarities()
    local commanderIds = getCommanderIds()
    for key14, value108 in commanderIds do
        local value109 = config11.Commanders.entries[value108]
        if not value109 then
            continue
        end
        local value110 = CommanderData[value108]
        local Rarity = value110
        if Rarity then
            Rarity = value110.Rarity
        end
        if not Rarity then
            continue
        end
        local rarityLabel6: Instance = value109.frame:FindFirstChild("RarityLabel")
        if rarityLabel6 then
            rarityLabel6.Text = Rarity.DisplayName
            local child8 = rarityLabel6:FindFirstChildOfClass("UIGradient")
            if typeof(Rarity.Color) == "Color3" then
                rarityLabel6.TextColor3 = Rarity.Color
                if child8 then
                    child8.Enabled = false
                end
            elseif typeof(Rarity.Color) == "ColorSequence" then
                if not child8 then
                    child8 = Instance.new("UIGradient")
                    child8.Parent = rarityLabel6
                end
                child8.Enabled = true
                child8.Color = Rarity.Color
            end
        end
        local child82 = value109.frame
        child82.LayoutOrder = (Rarity.Order or 1) * 1000 + key14
    end
end

local buildAll
buildAll = function()
    if entries then
        return
    end
    entries = true
    local child9 = ScrollingFrame:FindFirstChildOfClass("UIGridLayout")
    if child9 then
        child9.SortOrder = Enum.SortOrder.LayoutOrder
    end
    buildCategory("Nukes", Template, "Tier", true)
    buildCategory("Commanders", CommanderTemplate, "Commander", false)
    buildExplosionCategory()
    buildMutationCategory()
    buildBaseSkinCategory()
    refreshCounter()
end
function module.Start()
    buildAll()
    CommanderRarityFlags.onChanged(refreshCommanderRarities)
    local Nukes2: Instance = Tabs:WaitForChild("Nukes")
    local TextButton: Instance = Nukes2:WaitForChild("TextButton")
    local Commanders2: Instance = Tabs:WaitForChild("Commanders")
    local TextButton2: Instance = Commanders2:WaitForChild("TextButton")
    local Explosions: Instance = Tabs:WaitForChild("Explosions")
    local TextButton3: Instance = Explosions:WaitForChild("TextButton")
    local BaseSkins2: Instance = Tabs:WaitForChild("BaseSkins")
    local TextButton4: Instance = BaseSkins2:WaitForChild("TextButton")
    local Mutations: Instance = Tabs:WaitForChild("Mutations")
    local TextButton5: Instance = Mutations:WaitForChild("TextButton")
    value4 = Mutations:FindFirstChild("unlocks")
    value5 = Mutations:FindFirstChild("TextLabel")
    local function onActivated5()
        switchTab("Nukes")
    end

    TextButton.Activated:Connect(onActivated5)
    local function onActivated()
        switchTab("Commanders")
    end

    TextButton2.Activated:Connect(onActivated)
    local function onActivated2()
        switchTab("ExplosionVFXs")
    end

    TextButton3.Activated:Connect(onActivated2)
    local function onActivated3()
        switchTab("Mutations")
    end

    TextButton5.Activated:Connect(onActivated3)
    local function onActivated4()
        switchTab("BaseSkins")
    end

    TextButton4.Activated:Connect(onActivated4)
    local Left: Instance = ScreenGui:WaitForChild("Left")
    local SquareBtns: Instance = Left:WaitForChild("SquareBtns")
    local Index: Instance = SquareBtns:WaitForChild("Index")
    local onActivated6
    onActivated6 = function()
        FramesManager.Toggle("IndexFrame")
        for key15 in config11[BaseSkins].entries do
            local value111 = config11[BaseSkins].entries[key15]
            if not value111 then
                continue
            end
            local frame8 = value111.frame
            local Visible2: boolean = false
            if BaseSkins == BaseSkins then
                Visible2 = if BaseSkins then true else IndexVisibility.isVisible(BaseSkins, key15)
            end
            frame8.Visible = Visible2
        end
        refreshCounter()
    end
    Index.Activated:Connect(onActivated6)
    local value112 = DataController:Get()
    value112:ObserveKeys({ "discoveredTiers" }, onDiscoveredNuke)
    value112:ObserveKeys({ "DiscoveredCommanders" }, onDiscoveredCommander)
    value112:ObserveKeys({ "DiscoveredMutations" }, onDiscoveredMutation)
    value112:ObserveKeys({ "ExplosionVFXs", "Owned" }, onDiscoveredExplosionVFX)
    value112:ObserveKeys({ "BaseSkins", "Owned" }, onDiscoveredBaseSkin)
    local function observer(seed)
        local value114 = (tonumber(seed) or 0) >= 3
        Visible = value114
        value114 = value4
        if value114 then
            value4.Text = "Unlocks at rebirth %*!":format(3)
            value4.Visible = not Visible
        end
        if value5 then
            value5.Visible = Visible
        end
    end

    local config27 = { "rebirthLevel" }
    value112:Observe(config27, observer)
    config27 = refreshVisibility
    IndexVisibility.Changed:Connect(config27)
    local spawned
    spawned = function()
        task.wait(30)
        while IndexFrame.Visible do
            if IndexVisibility.hasTimeWindows() then
                for key16 in config11[BaseSkins].entries do
                    local value115 = config11[BaseSkins].entries[key16]
                    if not value115 then
                        continue
                    end
                    local frame9 = value115.frame
                    local Visible2: boolean = false
                    if BaseSkins == BaseSkins then
                        Visible2 = if BaseSkins then true else IndexVisibility.isVisible(BaseSkins, key16)
                    end
                    frame9.Visible = Visible2
                end
            end
        end
    end
    task.spawn(spawned)
end

return module
