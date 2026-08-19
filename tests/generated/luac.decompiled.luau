local ReplicatedStorage: ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService: RunService = game:GetService("RunService")
local Players: Players = game:GetService("Players")
local TweenService: TweenService = game:GetService("TweenService")
local HttpService: HttpService = game:GetService("HttpService")
local CollectionService: CollectionService = game:GetService("CollectionService")
local player: Player = Players.LocalPlayer
local value = TweenInfo.new(0.5, Enum.EasingStyle.Quad, Enum.EasingDirection.Out)
local config = {}
local optionalModule: Instance = script:FindFirstChild("OptionalModule")
if optionalModule then
    if optionalModule:IsA("ModuleScript") then
        result = require(optionalModule)
        local value2: number = 0
        local value3: boolean = false
        local value4 = function(self, index, count)
            return Color3.fromRGB(self, index, count)
        end
        local config2 = {}
        local config3 = {
            ReplicatedStorage = nil,
            RunService = nil,
            TweenService = nil,
            ReplicatedStorage = ReplicatedStorage,
            RunService = RunService,
            TweenService = TweenService,
        }
        config2.Services = config3
        local config4 = {}
        config4.pi = math.pi
        config4.huge = math.huge
        config2.Numbers = config4
        local config5 = {}
        config2.Strings = config5
        local config6 = { Primary = nil, Secondary = nil, Gradient = nil }
        config6.Primary = value4(255, 64, 110)
        config6.Secondary = value4(20, 255, 80)
        local config7 = {}
        local value5 = value4(0, 0, 255)
        local value6 = {}
        config6.Gradient = value6
        config2.Colors = config6
        local config8 = { A = nil }
        local config9 = { B = nil }
        local config10 = { C = nil }
        local config11 = { value = nil, vector = nil, cframe = nil }
        local value7: number = 10.75
        config11.value = math.floor(value7)
        config11.vector = Vector3.new(1, 2, 3)
        config11.cframe = CFrame.new(1, 2, 3) * CFrame.Angles(0, math.pi / 2, 0)
        config10.C = config11
        config9.B = config10
        config8.A = config9
        config2.Nested = config8
        local config12 = {}
        config12["hello world"] = true
        config12[100] = "numeric-key"
        config12[false] = "boolean-key"
        config2.DynamicLike = config12
        config.Config = config2
        local value8 = function(value)
            return value, value + 1, value + 2
        end
        local value9 = function(self, index, count)
            return self + index + count
        end
        local value10 = function(value)
            return up0(value)
        end
        local value11 = function(value)
            local result, value2 = up0(value)
            return result, value2
        end
        local value12 = function(value)
            return up0(value)
        end
        local value13 = function(value)
            return up0(up1(value))
        end
        local value14 = function(...)
            local value: string = "#"
            local value2 = ...
            local value3 = select(value)
            local value4 = table.pack(...)
            return value3, value4[1], value4[value3], value4
        end
        local value15 = function(value, ...)
            return value(...)
        end
        local value16 = function(value)
            if value <= 1 then
                return 1
            else
                return value * up0(value - 1)
            end
        end
        local value17 = function(value)
            if value == 0 then
                return true
            else
                return up0(value - 1)
            end
        end
        local value18 = function(value)
            if value == 0 then
                return false
            else
                return up0(value - 1)
            end
        end
        local value19 = function(value)
            return value
        end
        local value20 = function(self, index, count)
            if self then
                return index
            else
                return count
            end
        end
        local sideEffect
        sideEffect = function(value)
            up0 = up0 + 1
            up1 = not up1
            if not (2 < #value) then
            end
            result = true
            return result
        end
        local value21 = function(self, index)
            return self or index
        end
        local value22 = function(self, index, count)
            if self then
                local result
                if not result then
                    result = not self and count
                end
                return result
            end
        end
        local value23 = function(value)
            if value == nil then
                return -1
            elseif value < 0 then
                return 0
            else
                return value
            end
        end
        local value24 = function(value)
            if 100 <= value then
                return "legendary"
            elseif 75 <= value then
                return "epic"
            else
                if 50 <= value then
                    return "rare"
                elseif 25 <= value then
                    return "uncommon"
                else
                    return "common"
                end
            end
        end
        local value25 = function(self, index)
            if self then
                return math.max(index, 10)
            else
                return math.min(index, -10)
            end
        end
        local value26 = function(self, index, count)
            if not self then
                return nil
            elseif not index then
                return nil
            else
                if not count then
                    return nil
                else
                    return self, index, count
                end
            end
        end
        local config13 = { __index = r39 }
        local value27 = function(value)
            local config = { value = nil, history = nil, metadata = nil, value = value }
            local config2 = {}
            local value2 = { value }
            config.history = value2
            local config3 = { createdAt = nil, color = nil }
            config3.createdAt = os.clock()
            config3.color = up0(100, 150, 200)
            config.metadata = config3
            return setmetatable(config, up1)
        end
        config13.new = value27
        local value28 = function(self, index)
            self.value = self.value + index
            local history = self.history
            local value = self.value
            table.insert(history, value)
            return self.value
        end
        config13.add = value28
        local value29 = function(self, index)
            self.value = self.value * index
            local history = self.history
            local value = self.value
            table.insert(history, value)
            return self.value
        end
        config13.multiply = value29
        local value30 = function(value)
            value.value = 0
            table.clear(value.history)
            local history = value.history
            table.insert(history, 0)
        end
        config13.reset = value30
        local value31 = function(value)
            return value.history[#value.history]
        end
        config13.getLast = value31
        config.Counter = config13
        local makeAccumulator
        makeAccumulator = function(value)
            local value2: number = 0
            local accumulate
            accumulate = function(value2)
                up0 = up0 + 1
                up1 = up1 + value2
                up2 = up2 + 1
                return up1
            end
            local stats
            stats = function()
                return up0, up1
            end
            return accumulate, stats
        end
        local value32 = function(value)
            local value2 = function(value2)
                if value2 <= 0 then
                    return 0
                else
                    return up0 + up1(value2 - 1)
                end
            end
            return value2
        end
        local value33 = function(value)
            local config = { callback = value }
            local config2 = { __call = nil, __tostring = nil }
            local value2 = function(value2, ...)
                value2.calls = value2.calls + 1
                return value2.callback(...)
            end
            config2.__call = value2
            local value3 = function(value2)
                return "Callable(calls=%*)":format(value2.calls)
            end
            config2.__tostring = value3
            return setmetatable(config, config2)
        end
        local value34 = function(self, index)
            local result
            if not result then
                result = #self + 1
            end
            local value = result - 1
            if value < 1 then
                return nil
            else
                return value, self[value]
            end
        end
        local value35 = function(value)
            result = 0
            local value2: number = 1
            for index = 1, value, value2 do
                if index % 2 == 0 then
                    continue
                end
                local value3: number = 5
                local value4: number = 1
                for index2 = 1, value3, value4 do
                    if index2 == 4 then
                        if 6 < index then
                            break
                        end
                    end
                    result = result + index * index2
                end
            end
            while not (value2 < value) do
                local value5 = value - 1
                if value5 == 3 then
                    continue
                end
                result = result + value5
                if not (10000 < result) then
                    continue
                end
            end
            result2 = 0
            while index <= result2 do
            end
            return result
        end
        local value36 = function(self, index)
            result = 0
            local result2, value, value2 = ipairs(self)
        end
        local value37 = function(value)
            local value2 = value % 3 + 1
            local value3 = "key_%*":format(value % 4)
            local config = { array = nil, map = nil, nested = nil }
            local config2 = {}
            local value4 = { 10, 20, 30 }
            config.array = value4
            local config3 = {}
            config.map = config3
            local config4 = { stats = nil }
            local config5 = {}
            config4.stats = config5
            config.nested = config4
            local array = config.array
            array[value2] = array[value2] + value
            local map = config.map
            map[value3] = map[value3] + 1
            local stats = config.nested.stats
            stats.score = stats.score + config.array[value2]
            local stats2 = config.nested.stats
            stats2.multiplier = stats2.multiplier * 2
            config.array[1] = config.array[2]
            config.array[2] = config.array[1]
            return config
        end
        local value38 = function(value)
            local config = { id = value }
            config.label = "fixture-%*":format(value)
            config.color = up0(value % 255, value * 2 % 255, value * 3 % 255)
            config.vector = Vector3.new(value, value + 1, value + 2)
            local config2 = { position = nil, values = nil, colors = nil }
            config2.position = CFrame.new(value, 0, 0)
            local config3 = {}
            local value2 = value / 2
            local value3: number = 0
            local value4: number = 100
            local value5 = math.clamp(value, value3, value4)
            local value6 = {}
            config2.values = value6
            local config4 = {}
            local value7 = up0(0, 0, 255)
            local value8 = {}
            config2.colors = value8
            config.nested = config2
            config["dynamic_%*":format(value)] = math.abs(value)
            if not (value % 2 == 0) then
            end
            result = true
            config[value] = up1(result, "even", "odd")
            return config
        end
        local value39 = function(value)
            local config = {}
            local value2 = up0(value)
            local value3 = {}
            return value3
        end
        local value40 = function(value)
            local config = { fixedOne = nil, nested = nil, packed = nil }
            config.fixedOne = up0(value)
            local config2 = {}
            local value2 = {}
            config.nested = value2
            config.packed = table.pack(up0(value + 20))
            return config
        end
        local value41 = function(self, index, count)
            local value = ((self + index) * count + (self + index * count) + (self ^ 2 + index ^ 2) % math.max(count, 1)) / 3
            return math.floor(value)
        end
        local value42 = function(value)
            local value2 = bit32.band(value, 255)
            local value3 = bit32.lshift(value2, 2)
            return bit32.bxor(value3, 90)
        end
        local value43 = function(self, index)
            local config = {}
            local value: string = tostring(index)
            local value2 = {}
            return (`{string.gsub("user=%*; id=%*; class=%*":format(self, index, up0(index)), "user=", "name=")}::` .. table.concat(value2, "|")) .. "::🇦🇷"
        end
        local value44 = function(value)
            local result, value2 = pcall(up0.JSONDecode, up0, value)
            if result then
                local config = { value = value2 }
                return config
            else
                local config2 = {}
                config2.error = tostring(value2)
                return config2
            end
        end
        local value45 = function(value)
            local value2 = function(value2)
                return "handled:%*":format(tostring(value2))
            end
            local result, value3 = xpcall(value, value2)
            if result then
                local config = { value = value3 }
                return config
            else
                local config2 = {}
                config2.error = tostring(value3)
                return config2
            end
        end
        local value46 = function(value)
            local value2 = function(value2)
                coroutine.yield(value2 + 1, value2 + 2)
                return value2 + 3
            end
            local value3 = coroutine.create(value2)
            local result, value4, value5 = coroutine.resume(value3, value)
            local result2, value6 = coroutine.resume(value3)
            return result, value4, value5, result2, value6
        end
        local value47 = function(value)
            local value2 = buffer.create(8)
            local value3: number = 0
            local value4 = value % 256
            buffer.writeu8(value2, value3, value4)
            local value5: number = 1
            buffer.writei16(value2, value5, value)
            local value6: number = 3
            local value7 = value / 3
            buffer.writef32(value2, value6, value7)
            return buffer.readu8(value2, 0) + buffer.readi16(value2, 1)
        end
        local value48 = function(value)
            local part: Instance = value:FindFirstChild("Part")
            if part then
                if part:IsA("BasePart") then
                    if part then
                        if part.Color then
                            return part, part.Color
                        end
                    end
                    return nil, nil
                end
            end
            result = nil
        end
        local value49 = function(value)
            result = value:FindFirstChild("A")
            local result
            if result then
                result = result:FindFirstChild("B")
            end
            local result2
            if result2 then
                result2 = result2:FindFirstChild("C")
            end
            return result2
        end
        local value50 = function(self, index)
            local config = {}
            self(config)
            config.value = index
            return config
        end
        local value51 = function(value)
            local value2 = value()
            return value2, value2
        end
        local value52 = function(value)
            local config = value.Config
            up0("mutation-barrier")
            return config.Value, config.Value
        end
        local value53 = function(value)
            result = "start"
            result2 = 0
            result3 = 0
            while result == "done" do
                local result4
                local result5
                if 20 < result3 + 1 then
                    result4 = "done"
                elseif result4 == "start" then
                    local value2 = result5 + value
                    if value % 2 == 0 then
                    else
                        result4 = "odd"
                    end
                else
                    if result4 == "even" then
                        value2 = value2 * 2
                        result4 = "finalize"
                    elseif result4 == "odd" then
                        value2 = value2 * 3 + 1
                        result4 = "finalize"
                    else
                        if result4 == "finalize" then
                            local value3 = value2 / 2
                            value2 = math.floor(value3)
                        end
                    end
                end
            end
            return value2
        end
        local value54 = function(value)
            local config = {}
            local outer
            outer = function(value2)
                local value3 = function(value)
                    up0 = up0 + value
                    up1 = up1 * 2
                    local config = { captured = nil, localState = nil, color = nil }
                    config.captured = up0
                    config.localState = up1
                    config.color = up3(up0 % 255, up1 % 255, 128)
                    table.insert(up2, config)
                    return up0 + up1
                end
                return value3
            end
            local config2 = {
                first = nil,
                second = nil,
                history = nil,
                snapshot = nil,
                first = outer(2),
                second = outer(3),
                history = config,
            }
            local snapshot
            snapshot = function()
                return up0, #up1
            end
            config2.snapshot = snapshot
            return config2
        end
        local tweenStress
        tweenStress = function(self, index)
            if not self:IsA("GuiObject") then
                return nil
            else
                local config = { BackgroundTransparency = nil, Position = nil, BackgroundTransparency = index }
                config.Position = UDim2.fromScale(0.5, 0.5)
                local value = up0:Create(self, up1, config)
                local value2 = function(value)
                    up0 = nil
                    if value == Enum.PlaybackState.Completed then
                        up1 = up1 + 1
                    end
                end
                value.Completed:Once(value2)
                up2 = value
                value:Play()
                return value
            end
        end
        local connectionStress
        connectionStress = function(value)
            local value2 = function(...)
                local value2: string = "#"
                local value3 = ...
                up0 = up0 + select(value2)
                up1 = up1 + 1
                local result
                if 5 <= result then
                    if up2 then
                        up2:Disconnect()
                        result = nil
                        up2 = result
                    end
                end
            end
            return value:Connect(value2)
        end
        local value55 = function(value)
            local value2 = up0:GetTags(value)
            local config = {}
            local value3: nil = nil
            result = nil
        end
        local value56 = function(value)
            if up0 then
                if type(up0) == "table" then
                    local transform = up0.transform
                    if type(transform) == "function" then
                        return transform(value)
                    end
                end
            end
            return value
        end
        local shadowingStress
        shadowingStress = function(value)
            result = (value + 1) * 2
            local result
            if 10 < result then
                result = result - 3
            end
            up0 = up0 + result
            return value
        end
        local value57 = function(self, index, count, options)
            if not (self == nil) then
                if not (index == nil) then
                    local result
                    if self == index then
                        if count then
                            if not options() then
                                if not self then
                                    if not index then
                                        result = not count
                                    end
                                end
                            end
                            return result
                        end
                    end
                end
            end
        end
        local value58 = function(value)
            local value2 = table.clone(value)
            local value3 = function(self, index)
                if self == index then
                    return false
                else
                    if not (index < self) then
                    end
                    result = true
                    return result
                end
            end
            table.sort(value2, value3)
            return value2
        end
        local value59 = function(value)
            return up0(value)
        end
        local value60 = function(value)
            local tags = value.tags
            return value.metadata, tags, tags[1], value.enabled
        end
        local value61 = function(value)
            local result, value2, value3 = up0(value + 10)
            return result, value2, value3
        end
        local value62 = function(value)
            local config = {}
            local value2: nil = nil
            result = nil
        end
        local makePayload
        makePayload = function(value)
            local config = { id = nil, name = nil, enabled = nil, tags = nil, metadata = nil, id = value }
            config.name = "Payload-%*":format(value)
            if not (value % 2 == 0) then
            end
            result = true
            config.enabled = result
            local config2 = {}
            local value2: string = "stress"
            local value3 = up0(value)
            local result2
            if up1(math.abs(value)) then
            else
                result2 = "odd"
            end
            local value4 = { value2, value3, result2 }
            config.tags = value4
            local config3 = {
                factorial = nil,
                bit = nil,
                expression = nil,
                fixedOne = nil,
                callTail = nil,
                stateMachine = nil,
            }
            config3.factorial = up2(math.clamp(math.abs(value), 0, 8))
            config3.bit = up3(value)
            config3.expression = up4(value, value + 1, value + 2)
            config3.fixedOne = up5(value)
            config3.callTail = up6(value)
            config3.stateMachine = up7(value)
            config.metadata = config3
            return config
        end
        local BuildMegaTable
        BuildMegaTable = function(value)
            local result, value2 = up1(value)
            local value3 = up2(2)
            local value4 = up3(value)
            local value5 = result(5)
            local value6 = result(-2)
            local result2, value7 = value2()
            local result3, value8, value9 = up4(value)
            local config = {
                payload = nil,
                calculations = nil,
                accumulator = nil,
                multi = nil,
                constructors = nil,
                callbacks = nil,
                strings = nil,
                booleans = nil,
                payload = up0(value),
            }
            local config2 = {
                factorial = nil,
                branchPhi = nil,
                loops = nil,
                expression = nil,
                bits = nil,
                recursiveClosure = nil,
            }
            local value10: number = 0
            local value11: number = 8
            config2.factorial = up5(math.clamp(value, value10, value11))
            if not (value % 2 == 0) then
            end
            result4 = true
            config2.branchPhi = up6(result4, value)
            local value12: number = 0
            local value13: number = 20
            config2.loops = up7(math.clamp(value, value12, value13))
            config2.expression = up8(value, value + 2, value + 3)
            config2.bits = up9(value)
            config2.recursiveClosure = value3(4)
            config.calculations = config2
            local config3 = {
                first = nil,
                second = nil,
                total = nil,
                calls = nil,
                first = value5,
                second = value6,
                total = result2,
                calls = value7,
            }
            config.accumulator = config3
            local config4 = {
                fixedOne = nil,
                fixedTwo = nil,
                forwarded = nil,
                openTable = nil,
                fixedTable = nil,
                direct = nil,
            }
            config4.fixedOne = up10(value)
            config4.fixedTwo = table.pack(up11(value))
            config4.forwarded = table.pack(up12(value))
            config4.openTable = up13(value)
            config4.fixedTable = up14(value)
            local config5 = {}
            local value14 = { result3, value8, value9 }
            config4.direct = value14
            config.multi = config4
            local config6 = { callValued = nil, dynamic = nil, colors = nil, nestedCalls = nil }
            config6.callValued = up15(value)
            config6.dynamic = up16(value)
            local config7 = {}
            local value15 = up17(0, 0, 0)
            local value16 = {}
            config6.colors = value16
            local config8 = {}
            local config9 = {}
            config9.value = math.max(value, 1)
            config9.color = up17(255, 0, 0)
            local config10 = {}
            config10.value = math.min(value, 100)
            config10.color = up17(0, 255, 0)
            local config11 = {}
            config11.value = math.abs(value)
            config11.color = up17(0, 0, 255)
            local value17 = { config9, config10, config11 }
            config6.nestedCalls = value17
            config.constructors = config6
            local config12 = { first = nil, second = nil, snapshot = nil }
            config12.first = value4.first(1)
            config12.second = value4.second(2)
            config12.snapshot = table.pack(value4.snapshot())
            config.callbacks = config12
            local config13 = { formatted = nil, class = nil, unicode = nil }
            config13.formatted = up18("seed-%*":format(value), value)
            config13.class = up19(value)
            config13.unicode = up20.Strings.unicode
            config.strings = config13
            local config14 = { even = nil, odd = nil, complex = nil, sideEffectValue = nil }
            config14.even = up21(math.abs(value))
            config14.odd = up22(math.abs(value))
            if not (0 < value) then
            end
            result5 = true
            if not (value % 2 == 0) then
            end
            result6 = true
            if not (value < 10) then
            end
            result7 = true
            config14.complex = up23(result5, result6, result7)
            if 0 < value then
                local result8
                if not result8 then
                    result8 = up24("fallback")
                end
                config14.sideEffectValue = result8
                config.booleans = config14
                return config
            end
        end
        config.BuildMegaTable = BuildMegaTable
        local value63 = function(self, index)
            if #index == 0 then
                local config = {}
                return config
            else
                local config2 = { alpha = nil, beta = nil, gamma = nil, alpha = self }
                config2.beta = self + 1
                config2.gamma = self + 2
                local value = up0(index, config2)
                local value2 = up1(index)
                local result
                if 100 < value then
                elseif 50 < value then
                else
                    result = "small"
                end
                local config3 = { total = value, category = result, filtered = value2 }
                config3.guarded = up2(self)
                return config3
            end
        end
        config.ControlFlow = value63
        local value64 = function(value, ...)
            local result, value2, value3, value4 = up0(...)
            local config = {
                count = nil,
                first = nil,
                last = nil,
                packed = nil,
                forwarded = nil,
                count = result,
                first = value2,
                last = value3,
                packed = value4,
                forwarded = table.pack(up1(up2, value)),
            }
            return config
        end
        config.Varargs = value64
        local value65 = function(value)
            local value2 = up0.new(value)
            value2:add(5)
            value2:multiply(2)
            local value3 = function(self, index)
                return self + index + up0.value
            end
            local value4 = up1(value3)
            local config = {
                counter = nil,
                last = nil,
                callable = nil,
                callableResult = nil,
                callableText = nil,
                counter = value2,
            }
            config.last = value2:getLast()
            config.callable = value4
            config.callableResult = value4(value, value + 1)
            config.callableText = tostring(value4)
            return config
        end
        config.Objects = value65
        local value66 = function(self, index)
            local value = function()
                if up0 < 0 then
                    error("negative seed")
                end
                return up1(up0)
            end
            local config = {
                decoded = nil,
                protected = nil,
                coroutineResult = nil,
                bufferValue = nil,
                decoded = up0(self),
                protected = up1(value),
                coroutineResult = table.pack(up3(index)),
            }
            config.bufferValue = up4(index)
            return config
        end
        config.SafeOperations = value66
        local value67 = function(self, index)
            local result, value = up0(self)
            local value2 = up1(self)
            local value3 = up2(self)
            local result2
            if index then
            else
                result2 = nil
            end
            local config = {
                part = nil,
                color = nil,
                deep = nil,
                collection = nil,
                tween = nil,
                part = result,
                color = value,
                deep = value2,
                collection = value3,
                tween = result2,
            }
            return config
        end
        config.InstancePatterns = value67
        local value68 = function(value)
            return up0(value)
        end
        config.Connect = value68
        local value69 = function(self, index, count)
            local result, value = up1(index)
            local result2, value2 = up2(count)
            local config = { escaped = nil, repeated = nil, mutable = nil, escaped = up0(self, 123) }
            local config2 = {}
            local value3 = { result, value }
            config.repeated = value3
            local config3 = {}
            local value4 = { result2, value2 }
            config.mutable = value4
            return config
        end
        config.NegativeCases = value69
        local value70 = function(self, index)
            local result, value, value2, value3 = up0(index)
            local result2, value4, value5 = up1(self)
            local config = {}
            local value6 = { self, self + 1, self + 2, self - 1, 0, 101 }
            local config2 = {
                identity = nil,
                directReturn = nil,
                shadowing = nil,
                complexCondition = nil,
                multi = nil,
                sorted = nil,
            }
            config2.identity = up3(self)
            config2.directReturn = up4(self)
            config2.shadowing = up5(self)
            local value7 = function()
                local result
                if 0 < #up0 then
                    if up1 == nil then
                    end
                    result = true
                end
                return result
            end
            config2.complexCondition = up6(index, result, value3, value7)
            local config3 = {}
            local value8 = { result2, value4, value5 }
            config2.multi = value8
            config2.sorted = up2(value6)
            return config2
        end
        config.Misc = value70
        local RunEverything
        RunEverything = function(self, index, count)
            local value = math.floor(self)
            local value2 = up0(value)
            local value3 = up1.BuildMegaTable(value)
            local config = {}
            local value4 = { 1, 2, 3, -1, 5, 150 }
            local value5 = up1.ControlFlow(value, value4)
            local value6 = up1.Objects(value)
            local value7 = up1.Misc(value, value2)
            local result
            if index then
            else
                result = nil
            end
            local config2 = {
                seed = nil,
                payload = nil,
                mega = nil,
                seed = value,
                payload = value2,
                mega = value3,
            }
            up2 = config2
            local config3 = {
                seed = nil,
                mega = nil,
                flow = nil,
                objects = nil,
                misc = nil,
                instances = nil,
                sharedCounter = nil,
                sharedFlag = nil,
                sharedObject = nil,
                localPlayer = nil,
                seed = value,
                mega = value3,
                flow = value5,
                objects = value6,
                misc = value7,
                instances = result,
            }
            config3.sharedCounter = up3
            config3.sharedFlag = up4
            config3.sharedObject = up2
            config3.localPlayer = up5
            return config3
        end
        config.RunEverything = RunEverything
        return config
    end
end
result = nil
