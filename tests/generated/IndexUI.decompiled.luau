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
    for _, value5 in pairs(config11.Nukes.folder:GetChildren()) do
        local value6: number? = tonumber(value5.Name)
        if value6 then
            table.insert(config12, value6)
        end
    end
    local function compare(value7, index)
        local value8 = value7 < index
        return value8
    end

    table.sort(config12, compare)
    return config12
end

local function getCommanderIds()
    local config13 = {}
    for key, _ in CommanderData do
        table.insert(config13, key)
    end
    local function compare2(value9, index2)
        local rarity = CommanderData[value9].Rarity
        local rarity2 = CommanderData[index2].Rarity
        local result = rarity and rarity.Order or 0
        local result2 = rarity2 and rarity2.Order or 0
        if result ~= result2 then
            local value10 = result < result2
            return value10
        else
            local value10 = value9 < index2
            return value10
        end
    end

    table.sort(config13, compare2)
    return config13
end

local function getExplosionVFXIds()
    local config14 = {}
    for key2, value11 in ExplosionVFXData.List do
        if not value11.Collectible then
            continue
        end
        if value11.HideFromIndex then
            continue
        end
        table.insert(config14, key2)
    end
    local function compare3(value12, index3)
        local rarity3 = ExplosionVFXData.List[value12].Rarity
        local rarity4 = ExplosionVFXData.List[index3].Rarity
        local result3 = rarity3 and rarity3.Order or 0
        local result4 = rarity4 and rarity4.Order or 0
        if result3 ~= result4 then
            local value13 = result3 < result4
            return value13
        else
            local value13 = value12 < index3
            return value13
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
    local function compare4(value14, index4)
        local value15 = ExplosionVFXData.Rarities[MutationData[value14].Rarity]
        local value16 = ExplosionVFXData.Rarities[MutationData[index4].Rarity]
        local result5 = value15 and value15.Order or 0
        local result6 = value16 and value16.Order or 0
        if result5 ~= result6 then
            local value17 = result5 < result6
            return value17
        else
            local value17 = value14 < index4
            return value17
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
    local function compare5(value18, index5)
        local order = BaseSkinData.Skins[value18].Rarity.Order
        local order2 = BaseSkinData.Skins[index5].Rarity.Order
        if order ~= order2 then
            local value19 = order < order2
            return value19
        else
            local value19 = value18 < index5
            return value19
        end
    end

    table.sort(config16, compare5)
    return config16
end

local function displayValue(value20)
    return 2 ^ (value20 - 1)
end

local function formatTierNumber(value21)
    return BigNum.format(BigNum.new(value21))
end

local function entryVisible(value22, index6)
    return if config11[value22].discovered[index6] then true else IndexVisibility.isVisible(value22, index6)
end

local applyEntryVisibility
applyEntryVisibility = function(value23, index7)
    local value24 = config11[value23].entries[index7]
    if not value24 then
        return
    end
    local frame = value24.frame
    local Visible: boolean = false
    if BaseSkins == value23 then
        Visible = if value23 then true else IndexVisibility.isVisible(value23, index7)
    end
    frame.Visible = Visible
end
local refreshCounter
refreshCounter = function()
    if not Discovered then
        return
    end
    local Discovered = config11[BaseSkins]
    local value25: number = 0
    for _ in Discovered.entries do
        if Discovered.discovered[_] then
            value25 += 1
        end
    end
end
local refreshVisibility
refreshVisibility = function()
    for key5 in config11[BaseSkins].entries do
        local value26 = config11[BaseSkins].entries[key5]
        if not value26 then
            continue
        end
        local frame2 = value26.frame
        local Visible2: boolean = false
        if BaseSkins == BaseSkins then
            Visible2 = if BaseSkins then true else IndexVisibility.isVisible(BaseSkins, key5)
        end
        frame2.Visible = Visible2
    end
    refreshCounter()
end
local function visibleFrame(value27)
    local value28 = vector.create(1000000000, 1000000000, 1000000000)
    local value29 = vector.create(-1000000000, -1000000000, -1000000000)
    local value30 = vector.create(0, 0, 0)
    local value31: number = 0
    for _, Y in value27:GetDescendants() do
        if Y:IsA("BasePart") then
            if Y.Transparency >= 1 then
                continue
            end
            local cframe = Y.CFrame
            local size = Y.Size
            local result8
            local result9
            for i = -1, 1, 2 do
                local vector3
                local vector32
                for j = -1, 1, 2 do
                    for k = -1, 1, 2 do
                        local position = (cframe * CFrame.new(size.X * 0.5 * i, size.Y * 0.5 * j, size.Z * 0.5 * k)).Position
                        vector3 = Vector3.new(math.min(vector3.X, position.X), math.min(vector3.Y, position.Y), math.min(vector3.Z, position.Z))
                        vector32 = Vector3.new(math.max(vector32.X, position.X), math.max(vector32.Y, position.Y), math.max(vector32.Z, position.Z))
                    end
                    if value31 <= 0 then
                        return nil, nil
                    end
                    local value33 = vector32 - vector3
                    local _ = value33.X
                    Y = value33.Y
                    cframe = value33.Z
                    return value30 / value31, math.max(_, Y, cframe)
                end
            end
            local value34 = math.max(size.X * size.Y * size.Z, 0.001)
            value30 += Y.Position * value34
            value31 += value34
        end
    end
end

local function loopAnimation(value35, AnimationContent)
    if value35 then
        if not AnimationContent then
            return false
        end
        local instance: Animation = Instance.new("Animation")
        if typeof(AnimationContent) == "string" then
            instance.AnimationId = AnimationContent
        else
            local function protected()
                instance.AnimationContent = AnimationContent
            end

            pcall(protected)
        end
        local function protected2()
            return value35:LoadAnimation(instance)
        end

        local result12, value37 = pcall(protected2)
        if result12 then
            if not value37 then
                return false
            end
            value37.Looped = true
            value37.Priority = Enum.AnimationPriority.Action
            value37:Play(0)
            return true
        end
    end
end

local function setupCommanderAnimation(value38, index12)
    if not index12 then
        return
    end
    local mount: Instance = value38:FindFirstChild("Mount")
    local ClaimableCommanderIdleAnimation = mount
    if ClaimableCommanderIdleAnimation then
        ClaimableCommanderIdleAnimation = mount:FindFirstChildWhichIsA("Animator", true)
    end
    loopAnimation(ClaimableCommanderIdleAnimation, index12.ClaimableMountIdleAnimation)
    local child4 = (value38:FindFirstChild("Commander") or value38):FindFirstChildWhichIsA("Animator", true)
    ClaimableCommanderIdleAnimation = index12.ClaimableCommanderIdleAnimation
    if not ClaimableCommanderIdleAnimation then
        ClaimableCommanderIdleAnimation = index12.HelicopterIdleAnimation
    end
    loopAnimation(child4, ClaimableCommanderIdleAnimation)
end

local config17 = {}
local ensureBobbingLoop
ensureBobbingLoop = function()
    if callback then
        return
    end
    local onRenderStepped
    onRenderStepped = function()
        local Visible = IndexFrame.Visible
        if Visible then
            Visible = BaseSkins
            if Visible ~= "Commanders" then
                return
            end
            local value39 = os.clock()
            local value40: number = 0
            local value41 = math.cos(value39 * 1.5) * 0.04
            local value42 = CFrame.new(0, math.sin(value39 * 2) * 0.25, 0) * CFrame.Angles(math.sin(value39 * 1.2) * 0.04, value40, value41)
            for _, _ in config17 do
                if _.Parent then
                    _:PivotTo(_ * value42)
                    continue
                end
                config17[_] = nil
            end
        end
    end
    local connection: RBXScriptConnection = RunService.RenderStepped:Connect(onRenderStepped)
    callback = connection
end
local startCommanderAnimation
startCommanderAnimation = function(Parent, index13, count)
    if index13 then
        if not count then
            return
        end
        local instance2: WorldModel = Instance.new("WorldModel")
        instance2.Parent = Parent
        index13.Parent = instance2
        setupCommanderAnimation(index13, count)
        if index13:FindFirstChild("Mount") then
            config17[index13] = index13:GetPivot()
            if callback then
                return
            end
            local function onRenderStepped()
                local Visible2 = IndexFrame.Visible
                if Visible2 then
                    Visible2 = BaseSkins
                    if Visible2 ~= "Commanders" then
                        return
                    end
                    local value45 = os.clock()
                    local value46: number = 0
                    local value47 = math.cos(value45 * 1.5) * 0.04
                    local value48 = CFrame.new(0, math.sin(value45 * 2) * 0.25, 0) * CFrame.Angles(math.sin(value45 * 1.2) * 0.04, value46, value47)
                    for _, _ in config17 do
                        if _.Parent then
                            _:PivotTo(_ * value48)
                            continue
                        end
                        config17[_] = nil
                    end
                end
            end

            callback = RunService.RenderStepped:Connect(onRenderStepped)
        end
    end
end
local function populateViewport(value49, index14, count2, options, arg4)
    local result15 = count2 or index14:FindFirstChild(count2)
    if not result15 then
        return
    end
    for _, _ in value49:GetChildren() do
        local result16: string = "BasePart"
        if _:IsA(result16) then
            continue
        end
        result16 = "Model"
        if _:IsA(result16) then
            continue
        end
        result16 = "WorldModel"
        if _:IsA(result16) then
            continue
        end
        result16 = "Camera"
        if _:IsA(result16) then
            _:Destroy()
        end
    end
end

module.PopulateViewport = populateViewport
module.SetupCommanderAnimation = setupCommanderAnimation
module.LoopAnimation = loopAnimation
local function refreshCommanderTooltip(value50)
    local value51 = config11.Commanders.entries[value50]
    if not value51 then
        return
    end
    local value52 = CommanderData[value50]
    if config11.Commanders.discovered[value50] and value52 then
        if value52.Specialty then
            TooltipController:AddTooltip(value51.frame, "Role: %*":format(value52.Specialty))
            return
        else
            TooltipController:RemoveTooltip(value51.frame)
        end
    end
end

local function refreshMutationTooltip(value53)
    local value54 = config11.Mutations.entries[value53]
    if not value54 then
        return
    end
    local value55 = MutationData[value53]
    if config11.Mutations.discovered[value53] then
        if value55 then
            TooltipController:AddTooltip(TooltipController:AddTooltip())
            return
        else
            TooltipController:RemoveTooltip(value54.frame)
        end
    end
end

local function applyEntryState(value56, index15)
    local value57 = config11[value56].entries[index15]
    if not value57 then
        return
    end
    local value58 = config11[value56].discovered[index15]
    local viewport = value57.viewport
    local Visible3 = value58 and value2 or ImageColor3
    viewport.ImageColor3 = Visible3
    if value56 == "Commanders" then
        Visible3 = index15
        refreshCommanderTooltip(Visible3)
    end
    if value56 == "Commanders" then
        if not value57.commanderData.ViewportDoNotFloatAnimation then
            local textLabel3 = value57.frame.TextLabel
            Visible3 = value58 == true
            textLabel3.Visible = Visible3
            if value58 then
                textLabel3 = value57.model
                if textLabel3 then
                    textLabel3 = value57.animated
                    if not textLabel3 then
                        Visible3 = value57.viewport
                        startCommanderAnimation(Visible3, value57.model, value57.commanderData)
                        value57.animated = true
                        return
                    end
                end
            end
        elseif value56 == "ExplosionVFXs" then
            if value57.label then
                local label = value57.label
                Visible3 = value58 == true
                label.Visible = Visible3
            end
            local label = value57.viewport
            Visible3 = 0
            label.ImageTransparency = Visible3
            return
        elseif value56 == "Mutations" then
            local label = value57.label
            if label then
                label = value57.label
                Visible3 = value58 == true
                label.Visible = Visible3
            end
            label = config11.Mutations.entries[index15]
            if not label then
                return
            end
            local value59 = MutationData[index15]
            if config11.Mutations.discovered[index15] then
                if value59 then
                    TooltipController:AddTooltip(TooltipController:AddTooltip())
                    return
                else
                    TooltipController:RemoveTooltip(label.frame)
                    return
                end
            end
        elseif value56 == "BaseSkins" then
            local label = value57.label
            if label then
                label = value57.label
                local Visible4 = value58 == true
                label.Visible = Visible4
            end
        end
    end
end

local onDiscoveredNuke
onDiscoveredNuke = function(value60, index16)
    if index16 == nil then
        return
    end
    local value61: number? = tonumber(value60)
    if value61 then
        if config11.Nukes.discovered[value61] then
            return
        end
        config11.Nukes.discovered[value61] = true
        local value62 = config11.Nukes.entries[value61]
        if not value62 then
        else
            local viewport2 = value62.viewport
            local ImageColor3 = config11.Nukes.discovered[value61] and value2 or ImageColor3
            viewport2.ImageColor3 = ImageColor3
        end
        local viewport2 = config11
        value62 = viewport2.Nukes.entries[value61]
        if not value62 then
        else
            local frame3 = value62.frame
            viewport2 = false
            local result21 = BaseSkins
            local Visible5
            if result21 == "Nukes" then
                result21 = config11.Nukes.discovered[value61]
                if result21 then
                    viewport2 = true
                else
                    result21 = "Nukes"
                    Visible5 = IndexVisibility.isVisible(result21, value61)
                end
            end
            frame3.Visible = Visible5
        end
        value62 = BaseSkins
        if value62 == "Nukes" then
            refreshCounter()
        end
    end
end
local onDiscoveredCommander
onDiscoveredCommander = function(value63, index17)
    if index17 == nil then
        return
    end
    local value64: string = tostring(value63)
    if value64 then
        if config11.Commanders.discovered[value64] then
            return
        end
        config11.Commanders.discovered[value64] = true
        local value65 = config11.Commanders.entries[value64]
        if not value65 then
        else
            local value66 = config11.Commanders.discovered[value64]
            local viewport3 = value65.viewport
            local Visible6 = value66 and value2 or ImageColor3
            viewport3.ImageColor3 = Visible6
            Visible6 = value64
            refreshCommanderTooltip(Visible6)
            if not value65.commanderData.ViewportDoNotFloatAnimation then
                local textLabel4 = value65.frame.TextLabel
                Visible6 = value66 == true
                textLabel4.Visible = Visible6
                if value66 then
                    textLabel4 = value65.model
                    if textLabel4 then
                        textLabel4 = value65.animated
                        if not textLabel4 then
                            Visible6 = value65.viewport
                            startCommanderAnimation(Visible6, value65.model, value65.commanderData)
                            value65.animated = true
                        end
                    end
                end
            end
        end
        value65 = config11.Commanders.entries[value64]
        if not value65 then
        else
            local frame4 = value65.frame
            local Visible7: boolean = false
            local result23 = BaseSkins
            if result23 == "Commanders" then
                result23 = config11.Commanders.discovered[value64]
                if result23 then
                    Visible7 = true
                else
                    result23 = "Commanders"
                    Visible7 = IndexVisibility.isVisible(result23, value64)
                end
            end
            frame4.Visible = Visible7
        end
        value65 = BaseSkins
        if value65 == "Commanders" then
            refreshCounter()
        end
    end
end
local onDiscoveredMutation
onDiscoveredMutation = function(value67, index18)
    if index18 == nil then
        return
    end
    local value68: string = tostring(value67)
    if config11.Mutations.discovered[value68] then
        return
    end
    config11.Mutations.discovered[value68] = true
    local value69 = config11.Mutations.entries[value68]
    if not value69 then
    else
        local value70 = config11.Mutations.discovered[value68]
        local viewport4 = value69.viewport
        local Visible8 = value70 and value2 or ImageColor3
        viewport4.ImageColor3 = Visible8
        local viewport4 = value69.label
        if viewport4 then
            viewport4 = value69.label
            Visible8 = value70 == true
            viewport4.Visible = Visible8
        end
        viewport4 = config11.Mutations.entries[value68]
        if not viewport4 then
        else
            local value71 = MutationData[value68]
            if config11.Mutations.discovered[value68] then
                if value71 then
                    TooltipController:AddTooltip(TooltipController:AddTooltip())
                else
                    TooltipController:RemoveTooltip(viewport4.frame)
                end
            end
        end
    end
    local viewport4 = config11
    value69 = viewport4.Mutations.entries[value68]
    if not value69 then
    else
        local frame5 = value69.frame
        viewport4 = false
        local value71 = BaseSkins
        local Visible9
        if value71 == "Mutations" then
            value71 = config11.Mutations.discovered[value68]
            if value71 then
                viewport4 = true
            else
                value71 = "Mutations"
                Visible9 = IndexVisibility.isVisible(value71, value68)
            end
        end
        frame5.Visible = Visible9
    end
    value69 = BaseSkins
    if value69 == "Mutations" then
        refreshCounter()
    end
end
local onDiscoveredExplosionVFX
onDiscoveredExplosionVFX = function(value72, index19)
    if index19 == nil then
        return
    end
    local value73: string = tostring(value72)
    if config11.ExplosionVFXs.discovered[value73] then
        return
    end
    config11.ExplosionVFXs.discovered[value73] = true
    local value74 = config11.ExplosionVFXs.entries[value73]
    if not value74 then
    else
        local value75 = config11.ExplosionVFXs.discovered[value73]
        local viewport5 = value74.viewport
        local ImageTransparency = value75 and value2 or ImageColor3
        viewport5.ImageColor3 = ImageTransparency
        local viewport5 = value74.label
        if viewport5 then
            viewport5 = value74.label
            ImageTransparency = value75 == true
            viewport5.Visible = ImageTransparency
        end
        viewport5 = value74.viewport
        ImageTransparency = 0
        viewport5.ImageTransparency = ImageTransparency
    end
    local viewport5 = config11
    value74 = viewport5.ExplosionVFXs.entries[value73]
    if not value74 then
    else
        local frame6 = value74.frame
        viewport5 = false
        local result26 = BaseSkins
        local Visible10
        if result26 == "ExplosionVFXs" then
            result26 = config11.ExplosionVFXs.discovered[value73]
            if result26 then
                viewport5 = true
            else
                result26 = "ExplosionVFXs"
                Visible10 = IndexVisibility.isVisible(result26, value73)
            end
        end
        frame6.Visible = Visible10
    end
    value74 = BaseSkins
    if value74 == "ExplosionVFXs" then
        refreshCounter()
    end
end
local onDiscoveredBaseSkin
onDiscoveredBaseSkin = function(value76, index20)
    if index20 == nil then
        return
    end
    local value77: string = tostring(value76)
    if config11.BaseSkins.discovered[value77] then
        return
    end
    config11.BaseSkins.discovered[value77] = true
    local value78 = config11.BaseSkins.entries[value77]
    if not value78 then
    else
        local value79 = config11.BaseSkins.discovered[value77]
        local viewport6 = value78.viewport
        local Visible11 = value79 and value2 or ImageColor3
        viewport6.ImageColor3 = Visible11
        local viewport6 = value78.label
        if viewport6 then
            viewport6 = value78.label
            Visible11 = value79 == true
            viewport6.Visible = Visible11
        end
    end
    local viewport6 = config11
    value78 = viewport6.BaseSkins.entries[value77]
    if not value78 then
    else
        local frame7 = value78.frame
        viewport6 = false
        local result28 = BaseSkins
        local Visible12
        if result28 == "BaseSkins" then
            result28 = config11.BaseSkins.discovered[value77]
            if result28 then
                viewport6 = true
            else
                result28 = "BaseSkins"
                Visible12 = IndexVisibility.isVisible(result28, value77)
            end
        end
        frame7.Visible = Visible12
    end
    value78 = BaseSkins
    if value78 == "BaseSkins" then
        refreshCounter()
    end
end
local switchTab
switchTab = function(value80)
    if BaseSkins == value80 then
        return
    end
    BaseSkins = value80
    for _, _ in config11[BaseSkins].entries do
        _.frame.Visible = false
    end
end
local refreshMutationLock
refreshMutationLock = function()
    if callback2 then
        callback2.Text = "Unlocks at rebirth %*!":format(3)
        callback2.Visible = not Visible
    end
    local result30 = callback3
    if result30 then
        result30 = callback3
        result30.Visible = Visible
    end
end
local buildCategory
buildCategory = function(value81, index21, count3, options2)
    local result30 = value81 == "Nukes" and getNukeIds() or getCommanderIds()
    config11[value81].total = #result30
    for LayoutOrder, value82 in result30 do
        local clone3: Instance = index21:Clone()
        clone3.Name = `{count3}_` .. tostring(value82)
        clone3.Visible = true
        clone3.LayoutOrder = LayoutOrder
        local commanderData = CommanderData[value82]
        local textLabel5: Instance = clone3:FindFirstChild("TextLabel")
        if textLabel5 then
            if options2 then
                textLabel5.Text = `Tier {BigNum.format(BigNum.new(2 ^ (value82 - 1)))}`
            else
                local Text = commanderData and commanderData.DisplayName or tostring(value82)
                textLabel5.Text = Text
            end
            if value81 == "Commanders" then
                local Visible13 = config11[value81].discovered[value82] == true
                textLabel5.Visible = Visible13
            end
        end
        local rarityLabel2: Instance = clone3:FindFirstChild("RarityLabel")
        if rarityLabel2 then
            local result32 = commanderData or commanderData.Rarity
            if result32 then
                rarityLabel2.Text = result32.DisplayName
                if typeof(result32.Color) == "Color3" then
                    rarityLabel2.TextColor3 = result32.Color
                elseif typeof(result32.Color) == "ColorSequence" then
                    local instance3 = rarityLabel2:FindFirstChildOfClass("UIGradient")
                    if not instance3 then
                        instance3 = Instance.new("UIGradient")
                        instance3.Parent = rarityLabel2
                    end
                    instance3.Color = result32.Color
                end
                local LayoutOrder2 = (result32.Order or 1) * 1000 + LayoutOrder
                clone3.LayoutOrder = LayoutOrder2
            end
        end
        local viewportFrame2: Instance = clone3:FindFirstChild("ViewportFrame")
        local ViewportTemplateInstance = nil
        if viewportFrame2 then
            if value81 == "Commanders" then
                ViewportTemplateInstance = commanderData.ViewportTemplateInstance
                if not ViewportTemplateInstance then
                    ViewportTemplateInstance = commanderData.ClaimableCommanderTemplateInstance or tostring(value82)
                end
            else
                ViewportTemplateInstance = tostring(value82)
            end
            local folder = config11[value81].folder
            local value84 = value81 == "Commanders"
            ViewportTemplateInstance = populateViewport(viewportFrame2, folder, ViewportTemplateInstance, value84, commanderData)
            viewportFrame2.ImageColor3 = ImageColor3
        end
        local locked: Instance = clone3:FindFirstChild("Locked")
        local Parent: boolean = false
        if BaseSkins == value81 then
            ViewportTemplateInstance = config11
            Parent = if value81 then true else IndexVisibility.isVisible(value81, value82)
        end
        clone3.Visible = Parent
        Parent = ScrollingFrame
        clone3.Parent = Parent
        Parent = config11[value81]
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
        Parent[value82] = config18
    end
    for key7 in config11[value81].discovered do
        value83 = value81
        textLabel5 = key7
        applyEntryState(value83, textLabel5)
    end
end
local buildExplosionCategory
buildExplosionCategory = function()
    local explosionVFXIds = getExplosionVFXIds()
    config11.ExplosionVFXs.total = #explosionVFXIds
    for key8, value86 in explosionVFXIds do
        local value87 = ExplosionVFXData.List[value86]
        local clone4: Instance = clone:Clone()
        clone4.Name = `ExplosionVFX_{value86}`
        clone4.LayoutOrder = (value87.Rarity.Order or 1) * 1000 + key8
        local icon: Instance = clone4:FindFirstChild("Icon")
        if icon then
            icon.Image = value87.PreviewImage
            icon.ImageColor3 = ImageColor3
        end
        local rarityOutline2: Instance = clone4:FindFirstChild("RarityOutline")
        if rarityOutline2 then
            rarityOutline2.ImageColor3 = value87.Rarity.Color
        end
        local textLabel6: Instance = clone4:FindFirstChild("TextLabel")
        if textLabel6 then
            textLabel6.Text = value87.DisplayName
            local Visible14 = config11.ExplosionVFXs.discovered[value86] == true
            textLabel6.Visible = Visible14
        end
        local rarityLabel3: Instance = clone4:FindFirstChild("RarityLabel")
        if rarityLabel3 then
            rarityLabel3.Text = value87.Rarity.DisplayName
            if typeof(value87.Rarity.Color) == "Color3" then
                rarityLabel3.TextColor3 = value87.Rarity.Color
                local child5 = rarityLabel3:FindFirstChildOfClass("UIGradient")
                if child5 then
                    child5.Enabled = false
                end
            end
        end
        local child5: boolean = false
        local ExplosionVFXs
        if BaseSkins == "ExplosionVFXs" then
            ExplosionVFXs = if "ExplosionVFXs" then true else IndexVisibility.isVisible("ExplosionVFXs", value86)
        end
        clone4.Visible = ExplosionVFXs
        ExplosionVFXs = ScrollingFrame
        clone4.Parent = ExplosionVFXs
        ExplosionVFXs = config11
        ExplosionVFXs = ExplosionVFXs.ExplosionVFXs
        ExplosionVFXs = ExplosionVFXs.entries
        local config19 = { animated = false, frame = clone4, viewport = icon, label = textLabel6 }
        ExplosionVFXs[value86] = config19
    end
    for key9 in config11.ExplosionVFXs.discovered do
        icon = config11
        value87 = icon.ExplosionVFXs.entries[key9]
        if not value87 then
            continue
        end
        local value89 = rarityOutline2.ExplosionVFXs.discovered[key9]
        local viewport7 = value87.viewport
        rarityOutline2 = value89 and value2 or ImageColor3
        viewport7.ImageColor3 = rarityOutline2
        local viewport7 = value87.label
        if viewport7 then
            viewport7 = value87.label
            rarityOutline2 = value89 == true
            viewport7.Visible = rarityOutline2
        end
        viewport7 = value87.viewport
        rarityOutline2 = 0
        viewport7.ImageTransparency = rarityOutline2
    end
end
local buildMutationCategory
buildMutationCategory = function()
    local mutationIds = getMutationIds()
    config11.Mutations.total = #mutationIds
    for key10, value91 in mutationIds do
        local value92 = MutationData[value91]
        local value93 = ExplosionVFXData.Rarities[value92.Rarity]
        local clone5: Instance = MutationTemplate:Clone()
        clone5.Name = `Mutation_{value91}`
        local result36 = value93 and value93.Order or 1
        clone5.LayoutOrder = result36 * 1000 + key10
        result36 = "Icon"
        local child6: Instance = clone5:FindFirstChild(result36)
        if child6 then
            child6.Image = value92.Icon
            child6.ImageColor3 = ImageColor3
        end
        local rarityOutline3: Instance = clone5:FindFirstChild("RarityOutline")
        if rarityOutline3 and (value93 and typeof(value93.Color) == "Color3") then
            rarityOutline3.ImageColor3 = value93.Color
        end
        local textLabel7: Instance = clone5:FindFirstChild("TextLabel")
        if textLabel7 then
            textLabel7.Text = value92.Name
            local Visible15 = config11.Mutations.discovered[value91] == true
            textLabel7.Visible = Visible15
        end
        local rarityLabel4: Instance = clone5:FindFirstChild("RarityLabel")
        if rarityLabel4 and value93 then
            rarityLabel4.Text = value93.DisplayName
            if typeof(value93.Color) == "Color3" then
                rarityLabel4.TextColor3 = value93.Color
            end
        end
        local Mutations2: boolean = false
        if BaseSkins == "Mutations" then
            Mutations2 = if "Mutations" then true else IndexVisibility.isVisible("Mutations", value91)
        end
        clone5.Visible = Mutations2
        Mutations2 = ScrollingFrame
        clone5.Parent = Mutations2
        Mutations2 = config11
        Mutations2 = Mutations2.Mutations
        Mutations2 = Mutations2.entries
        local config20 = { animated = false, frame = clone5, viewport = child6, label = textLabel7 }
        Mutations2[value91] = config20
        Mutations2 = config11.Mutations.entries[value91]
        if not Mutations2 then
            continue
        end
        local value95 = MutationData[value91]
        if not config11.Mutations.discovered[value91] then
            continue
        end
        if value95 then
            TooltipController:AddTooltip(TooltipController:AddTooltip())
        else
            TooltipController:RemoveTooltip(Mutations2.frame)
        end
    end
    for key11 in config11.Mutations.discovered do
        local clone5 = config11
        local value92 = clone5.Mutations.entries[key11]
        if not value92 then
            continue
        end
        local value96 = child6.Mutations.discovered[key11]
        local viewport8 = value92.viewport
        child6 = value96 and value2 or ImageColor3
        viewport8.ImageColor3 = child6
        local viewport8 = value92.label
        if viewport8 then
            viewport8 = value92.label
            child6 = value96 == true
            viewport8.Visible = child6
        end
        viewport8 = config11.Mutations.entries[key11]
        if not viewport8 then
        else
            local value97 = MutationData[key11]
            if config11.Mutations.discovered[key11] then
                if value97 then
                    rarityLabel4 = viewport8.frame
                    local value95 = value97
                    TooltipController:AddTooltip(TooltipController:AddTooltip())
                else
                    rarityLabel4 = viewport8.frame
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
    for key12, value99 in baseSkinIds do
        local value100 = BaseSkinData.Skins[value99]
        local rarity5 = value100.Rarity
        local clone6: Instance = clone2:Clone()
        clone6.Name = `BaseSkin_{value99}`
        clone6.LayoutOrder = rarity5.Order * 1000 + key12
        local textLabel8: Instance = clone6:FindFirstChild("TextLabel")
        if textLabel8 then
            textLabel8.Text = value100.DisplayName
            local Visible16 = config11.BaseSkins.discovered[value99] == true
            textLabel8.Visible = Visible16
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
                local instance4 = rarityLabel5:FindFirstChildOfClass("UIGradient")
                if not instance4 then
                    instance4 = Instance.new("UIGradient")
                    instance4.Parent = rarityLabel5
                end
                instance4.Enabled = true
                instance4.Color = rarity5.Color
            end
        end
        local viewportFrame3: Instance = clone6:FindFirstChild("ViewportFrame")
        local BaseSkins2 = viewportFrame3
        if viewportFrame3 then
            if value100.Icon then
                local instance5: ImageLabel = Instance.new("ImageLabel")
                instance5.Name = "Icon"
                instance5.BackgroundTransparency = 1
                instance5.Size = UDim2.fromScale(1, 1)
                instance5.ScaleType = Enum.ScaleType.Fit
                instance5.Image = value100.Icon
                instance5.ImageColor3 = ImageColor3
                instance5.Parent = viewportFrame3
                BaseSkins2 = instance5
            else
                populateViewport(viewportFrame3, nil, BaseSkinController.BuildPreviewIsland(value99), false, nil)
                viewportFrame3.ImageColor3 = ImageColor3
            end
        end
        BaseSkins2 = false
        if BaseSkins == "BaseSkins" then
            BaseSkins2 = if "BaseSkins" then true else IndexVisibility.isVisible("BaseSkins", value99)
        end
        clone6.Visible = BaseSkins2
        BaseSkins2 = ScrollingFrame
        clone6.Parent = BaseSkins2
        BaseSkins2 = config11
        BaseSkins2 = BaseSkins2.BaseSkins
        BaseSkins2 = BaseSkins2.entries
        local config21 = { animated = false, frame = clone6, viewport = BaseSkins2, label = textLabel8 }
        BaseSkins2[value99] = config21
    end
    for key13 in config11.BaseSkins.discovered do
        clone6 = config11
        value100 = clone6.BaseSkins.entries[key13]
        if not value100 then
            continue
        end
        local value103 = textLabel8.BaseSkins.discovered[key13]
        local viewport9 = value100.viewport
        textLabel8 = value103 and value2 or ImageColor3
        viewport9.ImageColor3 = textLabel8
        local viewport9 = value100.label
        if not viewport9 then
            continue
        end
        viewport9 = value100.label
        textLabel8 = value103 == true
        viewport9.Visible = textLabel8
    end
end
local function refreshCommanderRarities()
    local commanderIds = getCommanderIds()
    for key14, value105 in commanderIds do
        local value106 = config11.Commanders.entries[value105]
        if not value106 then
            continue
        end
        local value107 = CommanderData[value105]
        local Rarity = value107
        if Rarity then
            Rarity = value107.Rarity
        end
        if not Rarity then
            continue
        end
        local rarityLabel6: Instance = value106.frame:FindFirstChild("RarityLabel")
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
        local child8 = value106.frame
        child8.LayoutOrder = (Rarity.Order or 1) * 1000 + key14
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
    local BaseSkins: Instance = Tabs:WaitForChild("BaseSkins")
    local TextButton4: Instance = BaseSkins:WaitForChild("TextButton")
    local Mutations: Instance = Tabs:WaitForChild("Mutations")
    local TextButton5: Instance = Mutations:WaitForChild("TextButton")
    callback2 = Mutations:FindFirstChild("unlocks")
    callback3 = Mutations:FindFirstChild("TextLabel")
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
            local value108 = config11[BaseSkins].entries[key15]
            if not value108 then
                continue
            end
            local frame8 = value108.frame
            local Visible3: boolean = false
            if BaseSkins == BaseSkins then
                Visible3 = if BaseSkins then true else IndexVisibility.isVisible(BaseSkins, key15)
            end
            frame8.Visible = Visible3
        end
        refreshCounter()
    end
    Index.Activated:Connect(onActivated6)
    local value109 = DataController:Get()
    value109:ObserveKeys({ "discoveredTiers" }, onDiscoveredNuke)
    value109:ObserveKeys({ "DiscoveredCommanders" }, onDiscoveredCommander)
    value109:ObserveKeys({ "DiscoveredMutations" }, onDiscoveredMutation)
    value109:ObserveKeys({ "ExplosionVFXs", "Owned" }, onDiscoveredExplosionVFX)
    value109:ObserveKeys({ "BaseSkins", "Owned" }, onDiscoveredBaseSkin)
    local function observer(value110)
        local value111 = (tonumber(value110) or 0) >= 3
        Visible = value111
        value111 = callback2
        if value111 then
            callback2.Text = "Unlocks at rebirth %*!":format(3)
            callback2.Visible = not Visible
        end
        if callback3 then
            callback3.Visible = Visible
        end
    end

    local config27 = { "rebirthLevel" }
    value109:Observe(config27, observer)
    config27 = refreshVisibility
    IndexVisibility.Changed:Connect(config27)
    local spawned
    spawned = function()
        task.wait(30)
        while IndexFrame.Visible do
            if IndexVisibility.hasTimeWindows() then
                for key16 in config11[BaseSkins].entries do
                    local value112 = config11[BaseSkins].entries[key16]
                    if not value112 then
                        continue
                    end
                    local frame9 = value112.frame
                    local Visible4: boolean = false
                    if BaseSkins == BaseSkins then
                        Visible4 = if BaseSkins then true else IndexVisibility.isVisible(BaseSkins, key16)
                    end
                    frame9.Visible = Visible4
                end
            end
        end
    end
    task.spawn(spawned)
end

return module
