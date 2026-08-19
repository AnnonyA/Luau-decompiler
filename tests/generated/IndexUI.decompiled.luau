local Players: Players = game:GetService("Players")
local ReplicatedStorage: ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService: RunService = game:GetService("RunService")
local Nukes: Instance = ReplicatedStorage:WaitForChild("Nukes")
local Commanders: Instance = ReplicatedStorage.Assets:WaitForChild("Commanders")
local value: Color3 = Color3.fromRGB(0, 0, 0)
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
local config = {}
local config2 = {
    Nukes = nil,
    Commanders = nil,
    ExplosionVFXs = nil,
    Mutations = nil,
    BaseSkins = nil,
}
local config3 = {}
local config4 = {}
config3.entries = config4
local config5 = {}
config3.discovered = config5
config3.folder = Nukes
config2.Nukes = config3
local config6 = {}
local config7 = {}
config6.entries = config7
local config8 = {}
config6.discovered = config8
config6.folder = Commanders
config2.Commanders = config6
local config9 = {}
local config10 = {}
config9.entries = config10
local config11 = {}
config9.discovered = config11
config2.ExplosionVFXs = config9
local config12 = {}
local config13 = {}
config12.entries = config13
local config14 = {}
config12.discovered = config14
config2.Mutations = config12
local config15 = {}
local config16 = {}
config15.entries = config16
local config17 = {}
config15.discovered = config17
config2.BaseSkins = config15
local value3: string = "Nukes"
local value4: boolean = false
local value5: boolean = false
local value6: nil = nil
local value7: nil = nil
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
local value8: ImageLabel = Instance.new("ImageLabel")
value8.Name = "Icon"
value8.BackgroundTransparency = 1
value8.AnchorPoint = Vector2.new(0.5, 0.5)
value8.Position = UDim2.fromScale(0.5, 0.5)
value8.Size = UDim2.fromScale(1, 1)
value8.ScaleType = Enum.ScaleType.Fit
value8.ZIndex = 1
value8.Parent = clone
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
if rarityLabel then
    if not clone:FindFirstChild("RarityLabel") then
        rarityLabel:Clone().Parent = clone
    end
end
local clone2: Instance = Template:Clone()
clone2.Name = "BaseSkinTemplate"
local textLabel3: Instance = clone2:FindFirstChild("TextLabel")
if textLabel3 then
    textLabel3:Destroy()
end
local textLabel4: Instance = CommanderTemplate:FindFirstChild("TextLabel")
if textLabel4 then
    textLabel4:Clone().Parent = clone2
end
local rarityLabel2: Instance = CommanderTemplate:FindFirstChild("RarityLabel")
if rarityLabel2 then
    rarityLabel2:Clone().Parent = clone2
end
local Header: Instance = IndexFrame:WaitForChild("Header")
local Discovered: Instance = Header:WaitForChild("Discovered")
local value9 = function()
    local config = {}
    local result, value, value2 = pairs(up0.Nukes.folder:GetChildren())
end
local value10 = function()
    local config = {}
    local value: nil = nil
    result = nil
end
local value11 = function()
    local config = {}
    local list = up0.List
    local value: nil = nil
    result = nil
end
local value12 = function()
    local config = {}
    local value: nil = nil
    result = nil
end
local value13 = function()
    local config = {}
    local skins = up0.Skins
    local value: nil = nil
    result = nil
end
local value14 = function(value)
    return 2 ^ (value - 1)
end
local value15 = function(value)
    return up0.format(up0.new(value))
end
local value16 = function(self, index)
    if up0[self].discovered[index] then
        return true
    else
        return up1.isVisible(self, index)
    end
end
local applyEntryVisibility
applyEntryVisibility = function(self, index)
    local value = up0[self].entries[index]
    if not value then
        return
    else
        local frame = value.frame
        local result
        if up1 == self then
            if up0[self].discovered[index] then
            else
                result = up2.isVisible(self, index)
            end
        end
        frame.Visible = result
    end
end
local refreshCounter
refreshCounter = function()
    if not up0 then
        return
    else
        local value = up1[up2]
        result = 0
        local entries = value.entries
        local value2: nil = nil
        result2 = nil
    end
end
local refreshVisibility
refreshVisibility = function()
    local entries = up0[up1].entries
    local value: nil = nil
    result = nil
end
local value17 = function(value)
    result = vector.create(1000000000, 1000000000, 1000000000)
    result2 = vector.create(-1000000000, -1000000000, -1000000000)
    result3 = vector.create(0, 0, 0)
    result4 = 0
    local result5: {Instance}, value2, value3 = value:GetDescendants()
end
local value18 = function(self, index)
    if self then
        if not index then
        else
            local value: Animation = Instance.new("Animation")
            if typeof(index) == "string" then
                value.AnimationId = index
            else
                local value2 = function()
                    up0.AnimationContent = up1
                end
                pcall(value2)
            end
            local value3 = function()
                return up0:LoadAnimation(up1)
            end
            local result, value4 = pcall(value3)
            if result then
                if not value4 then
                else
                    value4.Looped = true
                    value4.Priority = Enum.AnimationPriority.Action
                    value4:Play(0)
                    return true
                end
            end
            return false
        end
    end
    return false
end
local value19 = function(self, index)
    if not index then
        return
    else
        local mount: Instance = self:FindFirstChild("Mount")
        local result
        if result then
            result = mount:FindFirstChildWhichIsA("Animator", true)
        end
        up0(result, index.ClaimableMountIdleAnimation)
        local child = (self:FindFirstChild("Commander") or self):FindFirstChildWhichIsA("Animator", true)
        local result2
        if not result2 then
            result2 = index.HelicopterIdleAnimation
        end
        up0(child, result2)
    end
end
local config18 = {}
local value20: nil = nil
local ensureBobbingLoop
ensureBobbingLoop = function()
    if up0 then
        return
    else
        local value = function()
            local result
            if result then
                if not (up1 == "Commanders") then
                else
                    local value = os.clock()
                    result2 = value * 2
                    result2 = value * 1.2
                    result3 = 0
                    local value2 = value * 1.5
                    result2 = math.cos(value2) * 0.04
                    local value3 = CFrame.new(0, math.sin(result2) * 0.25, 0) * CFrame.Angles(math.sin(result2) * 0.04, result3, result2)
                    local value4: nil = nil
                    result4 = nil
                end
            end
            return
        end
        local connection: RBXScriptConnection = up1.RenderStepped:Connect(value)
        up0 = connection
    end
end
local startCommanderAnimation
startCommanderAnimation = function(self, index, count)
    if index then
        if not count then
        else
            local value: WorldModel = Instance.new("WorldModel")
            value.Parent = self
            index.Parent = value
            up0(index, count)
            if index:FindFirstChild("Mount") then
                up1[index] = index:GetPivot()
                if up2 then
                    return
                else
                    local value2 = function()
                        local result
                        if result then
                            if not (up1 == "Commanders") then
                            else
                                local value = os.clock()
                                result2 = value * 2
                                result2 = value * 1.2
                                result3 = 0
                                local value2 = value * 1.5
                                result2 = math.cos(value2) * 0.04
                                local value3 = CFrame.new(0, math.sin(result2) * 0.25, 0) * CFrame.Angles(math.sin(result2) * 0.04, result3, result2)
                                local value4: nil = nil
                                result4 = nil
                            end
                        end
                        return
                    end
                    up2 = up3.RenderStepped:Connect(value2)
                end
            end
        end
    end
    return
end
local value21 = function(self, index, count, options, arg4)
    local result
    if typeof(count) == "string" then
        result = index:FindFirstChild(count)
    end
    if not result then
        return
    else
        local result2: {Instance}, value, value2 = self:GetChildren()
    end
end
config.PopulateViewport = value21
config.SetupCommanderAnimation = value19
config.LoopAnimation = value18
local value22 = function(value)
    local value2 = up0.Commanders.entries[value]
    if not value2 then
        return
    else
        local value3 = up1[value]
        if up0.Commanders.discovered[value] then
            if value3 then
                if value3.Specialty then
                    up2:AddTooltip(value2.frame, "Role: %*":format(value3.Specialty))
                    return
                end
            end
        end
        up2:RemoveTooltip(value2.frame)
    end
end
local value23 = function(value)
    local value2 = up0.Mutations.entries[value]
    if not value2 then
        return
    else
        local value3 = up1[value]
        if up0.Mutations.discovered[value] then
            if value3 then
                local value4 = up3.FullDescriptionText(value3)
                up2:AddTooltip(value2.frame)
                return
            end
        end
        up2:RemoveTooltip(value2.frame)
    end
end
local value24 = function(self, index)
    local value = up0[self].entries[index]
    if not value then
        return
    else
        local value2 = up0[self].discovered[index]
        local viewport = value.viewport
        if value2 then
            local result
            if not result then
            end
            viewport.ImageColor3 = up2
            if self == "Commanders" then
                up3(index)
            end
            if self == "Commanders" then
                if not value.commanderData.ViewportDoNotFloatAnimation then
                    local textLabel = value.frame.TextLabel
                    if not (value2 == true) then
                    end
                    result2 = true
                    textLabel.Visible = result2
                    if value2 then
                        if value.model then
                            if not value.animated then
                                up4(value.viewport, value.model, value.commanderData)
                                value.animated = true
                                return
                            end
                        end
                    end
                end
            end
            if self == "ExplosionVFXs" then
                if value.label then
                    local label = value.label
                    if not (value2 == true) then
                    end
                    result3 = true
                    label.Visible = result3
                end
                value.viewport.ImageTransparency = 0
                return
            elseif self == "Mutations" then
                if value.label then
                    local label2 = value.label
                    if not (value2 == true) then
                    end
                    result4 = true
                    label2.Visible = result4
                end
                local value3 = up0.Mutations.entries[index]
                if not value3 then
                    return
                else
                    local value4 = up5[index]
                    if up0.Mutations.discovered[index] then
                        if value4 then
                            local value5 = up7.FullDescriptionText(value4)
                            up6:AddTooltip(value3.frame)
                            return
                        end
                    end
                    up6:RemoveTooltip(value3.frame)
                    return
                end
            else
                if self == "BaseSkins" then
                    if value.label then
                        local label3 = value.label
                        if not (value2 == true) then
                        end
                        result5 = true
                        label3.Visible = result5
                    end
                end
            end
        end
    end
end
local onDiscoveredNuke
onDiscoveredNuke = function(self, index)
    if index == nil then
        return
    else
        local value: number? = tonumber(self)
        if value then
            if up0.Nukes.discovered[value] then
            else
                up0.Nukes.discovered[value] = true
                local value2 = up0.Nukes.entries[value]
                if not value2 then
                else
                    local viewport = value2.viewport
                    if up0.Nukes.discovered[value] then
                        local result
                        if not result then
                        end
                        viewport.ImageColor3 = up2
                        local value3 = up0.Nukes.entries[value]
                        if not value3 then
                        else
                            local frame = value3.frame
                            local result2
                            if up3 == "Nukes" then
                                if up0.Nukes.discovered[value] then
                                else
                                    result2 = up4.isVisible("Nukes", value)
                                end
                            end
                            frame.Visible = result2
                        end
                        if up3 == "Nukes" then
                            up5()
                        end
                    end
                end
            end
        end
        return
    end
end
local onDiscoveredCommander
onDiscoveredCommander = function(self, index)
    if index == nil then
        return
    else
        local value: string = tostring(self)
        if value then
            if up0.Commanders.discovered[value] then
            else
                up0.Commanders.discovered[value] = true
                local value2 = up0.Commanders.entries[value]
                if not value2 then
                else
                    local value3 = up0.Commanders.discovered[value]
                    local viewport = value2.viewport
                    if value3 then
                        local result
                        if not result then
                        end
                        viewport.ImageColor3 = up2
                        up3(value)
                        if not value2.commanderData.ViewportDoNotFloatAnimation then
                            local textLabel = value2.frame.TextLabel
                            if not (value3 == true) then
                            end
                            result2 = true
                            textLabel.Visible = result2
                            if value3 then
                                if value2.model then
                                    if not value2.animated then
                                        up4(value2.viewport, value2.model, value2.commanderData)
                                        value2.animated = true
                                    end
                                end
                            end
                        end
                        local value4 = up0.Commanders.entries[value]
                        if not value4 then
                        else
                            local frame = value4.frame
                            local result3
                            if up5 == "Commanders" then
                                if up0.Commanders.discovered[value] then
                                else
                                    result3 = up6.isVisible("Commanders", value)
                                end
                            end
                            frame.Visible = result3
                        end
                        if up5 == "Commanders" then
                            up7()
                        end
                    end
                end
            end
        end
        return
    end
end
local onDiscoveredMutation
onDiscoveredMutation = function(self, index)
    if index == nil then
        return
    else
        local value: string = tostring(self)
        if up0.Mutations.discovered[value] then
            return
        else
            up0.Mutations.discovered[value] = true
            local value2 = up0.Mutations.entries[value]
            if not value2 then
            else
                local value3 = up0.Mutations.discovered[value]
                local viewport = value2.viewport
                if value3 then
                    local result
                    if not result then
                    end
                    viewport.ImageColor3 = up2
                    if value2.label then
                        local label = value2.label
                        if not (value3 == true) then
                        end
                        result2 = true
                        label.Visible = result2
                    end
                    local value4 = up0.Mutations.entries[value]
                    if not value4 then
                    else
                        local value5 = up3[value]
                        if up0.Mutations.discovered[value] then
                            if value5 then
                                local value6 = up5.FullDescriptionText(value5)
                                up4:AddTooltip(value4.frame)
                                local value7 = up0.Mutations.entries[value]
                                if not value7 then
                                else
                                    local frame = value7.frame
                                    local result3
                                    if up6 == "Mutations" then
                                        if up0.Mutations.discovered[value] then
                                        else
                                            result3 = up7.isVisible("Mutations", value)
                                        end
                                    end
                                    frame.Visible = result3
                                end
                                if up6 == "Mutations" then
                                    up8()
                                end
                            end
                        end
                        up4:RemoveTooltip(result3.frame)
                    end
                end
            end
        end
    end
end
local onDiscoveredExplosionVFX
onDiscoveredExplosionVFX = function(self, index)
    if index == nil then
        return
    else
        local value: string = tostring(self)
        if up0.ExplosionVFXs.discovered[value] then
            return
        else
            up0.ExplosionVFXs.discovered[value] = true
            local value2 = up0.ExplosionVFXs.entries[value]
            if not value2 then
            else
                local value3 = up0.ExplosionVFXs.discovered[value]
                local viewport = value2.viewport
                if value3 then
                    local result
                    if not result then
                    end
                    viewport.ImageColor3 = up2
                    if value2.label then
                        local label = value2.label
                        if not (value3 == true) then
                        end
                        result2 = true
                        label.Visible = result2
                    end
                    value2.viewport.ImageTransparency = 0
                    local value4 = up0.ExplosionVFXs.entries[value]
                    if not value4 then
                    else
                        local frame = value4.frame
                        local result3
                        if up3 == "ExplosionVFXs" then
                            if up0.ExplosionVFXs.discovered[value] then
                            else
                                result3 = up4.isVisible("ExplosionVFXs", value)
                            end
                        end
                        frame.Visible = result3
                    end
                    if up3 == "ExplosionVFXs" then
                        up5()
                    end
                end
            end
        end
    end
end
local onDiscoveredBaseSkin
onDiscoveredBaseSkin = function(self, index)
    if index == nil then
        return
    else
        local value: string = tostring(self)
        if up0.BaseSkins.discovered[value] then
            return
        else
            up0.BaseSkins.discovered[value] = true
            local value2 = up0.BaseSkins.entries[value]
            if not value2 then
            else
                local value3 = up0.BaseSkins.discovered[value]
                local viewport = value2.viewport
                if value3 then
                    local result
                    if not result then
                    end
                    viewport.ImageColor3 = up2
                    if value2.label then
                        local label = value2.label
                        if not (value3 == true) then
                        end
                        result2 = true
                        label.Visible = result2
                    end
                    local value4 = up0.BaseSkins.entries[value]
                    if not value4 then
                    else
                        local frame = value4.frame
                        local result3
                        if up3 == "BaseSkins" then
                            if up0.BaseSkins.discovered[value] then
                            else
                                result3 = up4.isVisible("BaseSkins", value)
                            end
                        end
                        frame.Visible = result3
                    end
                    if up3 == "BaseSkins" then
                        up5()
                    end
                end
            end
        end
    end
end
local switchTab
switchTab = function(value)
    if up0 == value then
        return
    else
        up0 = value
        local entries = up1[up0].entries
        local value2: nil = nil
        result = nil
    end
end
local refreshMutationLock
refreshMutationLock = function()
    if up0 then
        up0.Text = "Unlocks at rebirth %*!":format(3)
        up0.Visible = not up1
    end
    local result
    if result then
        up2.Visible = up1
    end
end
local buildCategory
buildCategory = function(self, index, count, options)
    if self == "Nukes" then
        local result
        if not result then
            result = up1()
        end
        up2[self].total = #result
        local value: nil = nil
        result2 = nil
    end
end
local buildExplosionCategory
buildExplosionCategory = function()
    local value = up0()
    up1.ExplosionVFXs.total = #value
    local value2: nil = nil
    result = nil
end
local buildMutationCategory
buildMutationCategory = function()
    local value = up0()
    up1.Mutations.total = #value
    local value2: nil = nil
    result = nil
end
local buildBaseSkinCategory
buildBaseSkinCategory = function()
    up0.BaseSkins.discovered[up1.DefaultKey] = true
    local value = up2()
    up0.BaseSkins.total = #value
    local value2: nil = nil
    result = nil
end
local value25 = function()
    local value = up0()
    local value2: nil = nil
    result = nil
end
local buildAll
buildAll = function()
    if up0 then
        return
    else
        up0 = true
        local child = up1:FindFirstChildOfClass("UIGridLayout")
        if child then
            child.SortOrder = Enum.SortOrder.LayoutOrder
        end
        up2("Nukes", up3, "Tier", true)
        up2("Commanders", up4, "Commander", false)
        up5()
        up6()
        up7()
        up8()
    end
end
local Start
Start = function()
    up0()
    up1.onChanged(up2)
    local Nukes: Instance = up3:WaitForChild("Nukes")
    local TextButton: Instance = Nukes:WaitForChild("TextButton")
    local Commanders: Instance = up3:WaitForChild("Commanders")
    local TextButton2: Instance = Commanders:WaitForChild("TextButton")
    local Explosions: Instance = up3:WaitForChild("Explosions")
    local TextButton3: Instance = Explosions:WaitForChild("TextButton")
    local BaseSkins: Instance = up3:WaitForChild("BaseSkins")
    local TextButton4: Instance = BaseSkins:WaitForChild("TextButton")
    local Mutations: Instance = up3:WaitForChild("Mutations")
    local TextButton5: Instance = Mutations:WaitForChild("TextButton")
    up4 = Mutations:FindFirstChild("unlocks")
    up5 = Mutations:FindFirstChild("TextLabel")
    local value = function()
        up0("Nukes")
    end
    TextButton.Activated:Connect(value)
    local value2 = function()
        up0("Commanders")
    end
    TextButton2.Activated:Connect(value2)
    local value3 = function()
        up0("ExplosionVFXs")
    end
    TextButton3.Activated:Connect(value3)
    local value4 = function()
        up0("Mutations")
    end
    TextButton5.Activated:Connect(value4)
    local value5 = function()
        up0("BaseSkins")
    end
    TextButton4.Activated:Connect(value5)
    local Left: Instance = up7:WaitForChild("Left")
    local SquareBtns: Instance = Left:WaitForChild("SquareBtns")
    local Index: Instance = SquareBtns:WaitForChild("Index")
    local value6 = function()
        up0.Toggle("IndexFrame")
        local entries = up1[up2].entries
        local value: nil = nil
        result = nil
    end
    Index.Activated:Connect(value6)
    local value7 = up13:Get()
    local config = {}
    local value8 = { "discoveredTiers" }
    value7:ObserveKeys(value8, up14)
    local config2 = {}
    local value9 = { "DiscoveredCommanders" }
    value7:ObserveKeys(value9, up15)
    local config3 = {}
    local value10 = { "DiscoveredMutations" }
    value7:ObserveKeys(value10, up16)
    local config4 = {}
    local value11 = { "ExplosionVFXs", "Owned" }
    value7:ObserveKeys(value11, up17)
    local config5 = {}
    local value12 = { "BaseSkins", "Owned" }
    value7:ObserveKeys(value12, up18)
    local config6 = {}
    local value13 = { "rebirthLevel" }
    local value14 = function(value)
        if not (3 <= (tonumber(value) or 0)) then
        end
        result = true
        up0 = result
        if up1 then
            up1.Text = "Unlocks at rebirth %*!":format(3)
            up1.Visible = not up0
        end
        if up2 then
            up2.Visible = up0
        end
    end
    value7:Observe(value13, value14)
    up11.Changed:Connect(up20)
    local value15 = function()
        while not r0 do
            if not up1.hasTimeWindows() then
                continue
            end
            local entries = up2[up3].entries
            local value: nil = nil
            result = nil
        end
    end
    task.spawn(value15)
end
config.Start = Start
return config
