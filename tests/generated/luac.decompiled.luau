local ReplicatedStorage: ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService: RunService = game:GetService("RunService")
local Players: Players = game:GetService("Players")
local TweenService: TweenService = game:GetService("TweenService")
local HttpService: HttpService = game:GetService("HttpService")
local CollectionService: CollectionService = game:GetService("CollectionService")
local player: Player = Players.LocalPlayer
local value = TweenInfo.new(0.5, Enum.EasingStyle.Quad, Enum.EasingDirection.Out)
local optionalModule: Instance = script:FindFirstChild("OptionalModule")
local result = if optionalModule and optionalModule:IsA("ModuleScript") then require(optionalModule) else nil
local value2: number = 0
local value3: boolean = false
local function rgb(value4, index, count)
    return Color3.fromRGB(value4, index, count)
end

local config = {
    ReplicatedStorage = ReplicatedStorage,
    RunService = RunService,
    TweenService = TweenService,
}
local config2 = {
    zero = 0,
    one = 1,
    negative = -42,
    fraction = 0.3333333333333333,
    pi = math.pi,
    huge = math.huge,
}
local config3 = {
    plain = "hello",
    escaped = "line1\nline2\t\"quoted\"\\slash",
    unicode = "🇦🇷 — café — 日本語 — 🚀",
    asset = "rbxassetid://123456789",
}
local config4 = {
    Primary = rgb(255, 64, 110),
    Secondary = rgb(20, 255, 80),
    Gradient = { rgb(255, 0, 0), rgb(0, 255, 0), rgb(0, 0, 255) },
}
local config5 = {
    A = {
        B = {
            C = {
                value = math.floor(10.75),
                vector = Vector3.new(1, 2, 3),
                cframe = CFrame.new(1, 2, 3) * CFrame.Angles(0, math.pi / 2, 0),
            },
        },
    },
}
local config6 = { hello world = true, [100] = "numeric-key", [false] = "boolean-key" }
local function returnsThree(value5)
    return value5, value5 + 1, value5 + 2
end

local function sum3(value6, index2, count2)
    return value6 + index2 + count2
end

local function fixedOneFromMulti(value7)
    return returnsThree(value7)
end

local function fixedTwoFromMulti(value8)
    local result2, value9 = returnsThree(value8)
    return result2, value9
end

local function forwardMulti(value10)
    return returnsThree(value10)
end

local function callWithOpenTail(value11)
    return sum3(returnsThree(value11))
end

local function varargStats(...)
    local count3 = select("#", ...)
    local packed = table.pack(...)
    return count3, packed[1], packed[count3], packed
end

local function forwardVarargs(value12, ...)
    return value12(...)
end

local factorial
factorial = function(value13)
    return if value13 <= 1 then 1 else value13 * factorial(value13 - 1)
end
local isEven
isEven = function(value14)
    return if value14 == 0 then true else isOdd(value14 - 1)
end
local isOdd
isOdd = function(value15)
    return if value15 == 0 then false else isEven(value15 - 1)
end
local function genericIdentity(value16)
    return value16
end

local function chooseValue(value17, index3, count4)
    return if value17 then index3 else count4
end

local sideEffect
sideEffect = function(value18)
    value2 += 1
    value3 = not value3
    local value19 = #value18 > 2
    return value19
end
local function valueShortCircuit(value20, index4)
    return value20 or index4
end

local function booleanShortCircuit(value21, index5, count5)
    local result3 = value21 and index5 or not value21 and count5
    return result3
end

local function guarded(value22)
    return if value22 == nil then -1 elseif value22 < 0 then 0 else value22
end

local function classify(value23)
    return if value23 >= 100 then "legendary" elseif value23 >= 75 then "epic" elseif value23 >= 50 then "rare" elseif value23 >= 25 then "uncommon" else "common"
end

local function branchPhi(value24, index6)
    return if value24 then math.max(index6, 10) else math.min(index6, -10)
end

local function nestedGuard(value25, index7, count6)
    if not value25 then
        return nil
    elseif not index7 then
        return nil
    elseif not count6 then
        return nil
    else
        return value25, index7, count6
    end
end

local config7 = {}
config7.__index = config7
function config7.new(value26)
    local config8 = { value26 }
    local config9 = { createdAt = os.clock(), color = rgb(100, 150, 200) }
    config9 = config7
    local config10 = { value = value26, history = config8, metadata = config9 }
    return setmetatable(config10, config9)
end

function config7:add(index8)
    self.value += index8
    table.insert(self.history, self.value)
    return self.value
end

function config7:multiply(index9)
    self.value *= index9
    table.insert(self.history, self.value)
    return self.value
end

function config7:reset()
    self.value = 0
    table.clear(self.history)
    table.insert(self.history, 0)
end

function config7:getLast()
    return self.history[#self.history]
end

local makeAccumulator
makeAccumulator = function(value31)
    local value32: number = 0
    local accumulate
    accumulate = function(value33)
        value32 += 1
        value31 += value33
        value2 += 1
        return value31
    end
    local stats
    stats = function()
        return value31, value32
    end
    return accumulate, stats
end
local function makeRecursiveClosure(value34)
    local function_
    function_ = function(value35)
        return if value35 <= 0 then 0 else value34 + function_(value35 - 1)
    end
    return function_
end

local function makeCallable(value36)
    local config11 = { calls = 0, callback = value36 }
    local config12 = {}
    function config12:__call(...)
        self.calls += 1
        return self.callback(...)
    end

    function config12:__tostring()
        return "Callable(calls=%*)":format(self.calls)
    end

    return setmetatable(config11, config12)
end

local function reverseIterator(value39, index10)
    local result4 = index10 or #value39 + 1
    local value40 = result4 - 1
    result4 = 1
    if value40 < result4 then
        result4 = nil
        return result4
    else
        result4 = value40
        return result4, value39[value40]
    end
end

local function loopStress(value41)
    local result5: number = 0
    for index11 = 1, value41 do
        if index11 % 2 ~= 0 then
            local result6
            for index12 = 1, 5 do
                if index12 == 4 and index11 > 6 then
                    break
                end
                result6 += index11 * index12
            end
        end
    end
    local result7 = value41
    local result8
    while result7 > 0 do
        result7 -= 1
        if result7 ~= 3 then
            result8 += result7
            if result8 > 10000 then
                break
            end
        end
    end
    local result9: number = 0
    local result10
    repeat
        result9 += 1
        result10 += result9
    until result9 >= 3
    return result10
end

local function genericLoopStress(value42, index13)
    local value43: number = 0
    for key, value44 in ipairs(value42) do
        value43 += key * value44
    end
    for key2, value45 in pairs(index13) do
        if #key2 > 0 then
            value43 += value45
        end
    end
    for _, value46 in value42 do
        value43 += value46
    end
    for key3, value47 in reverseIterator, value42 do
        value43 += key3 + value47
    end
    return value43
end

local function dynamicRmwStress(value48)
    local value49 = value48 % 3 + 1
    local value50 = "key_%*":format(value48 % 4)
    local config13 = { 10, 20, 30 }
    local config14 = { key_0 = 1, key_1 = 2, key_2 = 3, key_3 = 4 }
    local config15 = {
        array = config13,
        map = config14,
        nested = { stats = { score = 5, multiplier = 2 } },
    }
    local array = config15.array
    array[value49] = array[value49] + value48
    local map = config15.map
    map[value50] = map[value50] + 1
    local stats2 = config15.nested.stats
    stats2.score += config15.array[value49]
    local stats3 = config15.nested.stats
    stats3.multiplier *= 2
    config15.array[1] = config15.array[2]
    config15.array[2] = config15.array[1]
    return config15
end

local function callValuedTable(value51)
    local config16 = { position = CFrame.new(value51, 0, 0) }
    local config17 = {
        id = value51,
        label = "fixture-%*":format(value51),
        color = rgb(value51 % 255, value51 * 2 % 255, value51 * 3 % 255),
        vector = Vector3.new(value51, value51 + 1, value51 + 2),
    }
    local config18 = { math.max(value51, 1), math.floor(value51 / 2), math.clamp(value51, 0, 100) }
    local config19 = { rgb(255, 0, 0), rgb(0, 255, 0), rgb(0, 0, 255) }
    config19 = value51
    local config20 = { position = CFrame.new(value51, 0, 0), values = config18, colors = config19 }
    local config21 = {
        id = value51,
        label = "fixture-%*":format(value51),
        color = rgb(value51 % 255, value51 * 2 % 255, value51 * 3 % 255),
        vector = Vector3.new(value51, value51 + 1, value51 + 2),
        ["dynamic_%*":format(value51)] = math.abs(config19),
        nested = config20,
    }
    config19 = if value51 % 2 ~= 0 then false else true
    local chooseValue = chooseValue(config19, "even", "odd")
    config21[value51] = chooseValue
    return config21
end

local function trueOpenMultretTable(value52)
    local config22 = { "prefix", returnsThree(value52) }
    return config22
end

local function fixedCallTable(value53)
    local config23 = { returnsThree(value53 + 10) }
    local config24 = {
        fixedOne = returnsThree(value53),
        packed = table.pack(returnsThree(value53 + 20)),
        nested = config23,
    }
    return config24
end

local function expressionStress(value54, index14, count7)
    return math.floor(((value54 + index14) * count7 + (value54 + index14 * count7) + (value54 ^ 2 + index14 ^ 2) % math.max(count7, 1)) / 3)
end

local function bitStress(value55)
    local value56 = bit32.band(value55, 255)
    local value57 = bit32.lshift(value56, 2)
    return bit32.bxor(value57, 90)
end

local function stringStress(value58, index15)
    local config25 = { "alpha", "beta", tostring(index15) }
    return (`{string.gsub("user=%*; id=%*; class=%*":format(value58, index15, classify(index15)), "user=", "name=")}::` .. table.concat(config25, "|")) .. "::🇦🇷"
end

local function safeJsonDecode(value59)
    local result12, value60 = pcall(HttpService.JSONDecode, HttpService, value59)
    if result12 then
        local config26 = { ok = true, value = value60 }
        return config26
    else
        local config27 = { ok = false, error = tostring(value60) }
        return config27
    end
end

local function xpcallStress(value61)
    local function onError(value62)
        return "handled:%*":format(tostring(value62))
    end

    local result13, value63 = xpcall(value61, onError)
    if result13 then
        local config28 = { ok = true, value = value63 }
        return config28
    else
        local config29 = { ok = false, error = tostring(value63) }
        return config29
    end
end

local function coroutineStress(value64)
    local function routine(value65)
        coroutine.yield(value65 + 1, value65 + 2)
        return value65 + 3
    end

    local value66 = coroutine.create(routine)
    local result14, value67, value68 = coroutine.resume(value66, value64)
    local result15, value69 = coroutine.resume(value66)
    return result14, value67, value68, result15, value69
end

local function bufferStress(value70)
    local value71 = buffer.create(8)
    buffer.writeu8(value71, 0, value70 % 256)
    buffer.writei16(value71, 1, value70)
    buffer.writef32(value71, 3, value70 / 3)
    return buffer.readu8(value71, 0) + buffer.readi16(value71, 1)
end

local function instancePhiStress(value72)
    local part: Instance = value72:FindFirstChild("Part")
    local result16 = if part and part:IsA("BasePart") then part.Color else nil
    if part then
        if result16 then
            return part, result16
        else
            return nil, nil
        end
    end
end

local function chainedFindStress(value73)
    local result17: Instance = value73:FindFirstChild("A")
    if result17 then
        result17 = result17:FindFirstChild("B")
    end
    result17 = result17 or result17:FindFirstChild("C")
    return result17
end

local function tableEscapeNegative(value74, index16)
    local config30 = {}
    value74(config30)
    config30.value = index16
    return config30
end

local function repeatedCallNegative(value75)
    local value76 = value75()
    return value76, value76
end

local function mutableSnapshotNegative(value77)
    local config31 = value77.Config
    sideEffect("mutation-barrier")
    return config31.Value, config31.Value
end

local function stateMachineStress(value78)
    local result17: string = "start"
    local result18: number = 0
    local result19: number = 0
    while result17 ~= "done" do
        result19 += 1
        if result19 > 20 then
            result17 = "done"
            continue
        elseif result17 == "start" then
            result18 += value78
            if value78 % 2 == 0 then
                result17 = "even"
                continue
            else
                result17 = "odd"
                continue
            end
        elseif result17 == "even" then
            result18 *= 2
            result17 = "finalize"
            continue
        elseif result17 == "odd" then
            result18 = result18 * 3 + 1
            result17 = "finalize"
            continue
        elseif result17 == "finalize" then
            result18 = math.floor(result18 / 2)
            result17 = "done"
            continue
        else
            result17 = "done"
        end
    end
    return result18
end

local function nestedCallbacks(value79)
    local config32 = {}
    local outer
    outer = function(value80)
        local function_2
        function_2 = function(value81)
            value79 += value81
            callback *= 2
            local config33 = {}
            config33.captured = value79
            config33.localState = callback
            config33.color = rgb(value79 % 255, callback % 255, 128)
            table.insert(config32, config33)
            config33 = callback
            return value79 + config33
        end
        return function_2
    end
    local snapshot
    snapshot = function()
        return value79, #config32
    end
    local config34 = { first = outer(2), second = outer(3), history = config32, snapshot = snapshot }
    return config34
end

local tweenStress
tweenStress = function(value82, index17)
    if not value82:IsA("GuiObject") then
        return nil
    else
        local config35 = { BackgroundTransparency = index17, Position = UDim2.fromScale(0.5, 0.5) }
        local value83 = TweenService:Create(value82, value, config35)
        local function onCompleted(playbackState)
            callback2 = nil
            if playbackState == Enum.PlaybackState.Completed then
                value2 += 1
            end
        end

        value83.Completed:Once(onCompleted)
        callback2 = value83
        value83:Play()
        return value83
    end
end
local connectionStress
connectionStress = function(value85)
    local callback
    callback = function(...)
        callback3 += select("#", ...)
        value2 += 1
        local result20 = callback3
        if result20 >= 5 then
            result20 = callback4
            if result20 then
                callback4:Disconnect()
                result20 = nil
                callback4 = result20
            end
        end
    end
    callback4 = value85:Connect(callback)
    return callback4
end
local function collectionStress(value86)
    local value87 = CollectionService:GetTags(value86)
    local config36 = {}
    for _, value88 in value87 do
        config36[value88] = true
    end
    local value89 = #value87 > 0
    local config37 = { tags = value87, map = config36, hasAny = value89 }
    return config37
end

local function optionalDependencyStress(value90)
    if result and type(result) == "table" then
        local transform = result.transform
        return if type(transform) == "function" then transform(value90) else value90
    end
end

local shadowingStress
shadowingStress = function(value91)
    local result20 = (value91 + 1) * 2 or result20 - 3
    value2 += result20
    return value91
end
local function complexCondition(value92, index18, count8, options)
    local result21
    if value92 ~= nil and index18 ~= nil then
        result21 = true
        if value92 == index18 and count8 then
            result21 = options()
            if not result21 then
                result21 = not value92
                if result21 then
                    result21 = not index18 or not count8
                end
            end
        end
    end
    return result21
end

local function sortingCallbackStress(value93)
    local value94 = table.clone(value93)
    local function compare(value95, index19)
        if value95 == index19 then
            return false
        else
            local value96 = index19 < value95
            return value96
        end
    end

    table.sort(value94, compare)
    return value94
end

local function directReturnCall(value97)
    return optionalDependencyStress(value97)
end

local function localAliasStress(value98)
    local tags = value98.tags
    return value98.metadata, tags, tags[1], value98.enabled
end

local function multiAssignmentStress(value99)
    local result21, value100, value101 = returnsThree(value99 + 10)
    return result21, value100, value101
end

local function earlyBreakContinueStress(value102)
    local config38 = {}
    for _, value103 in value102 do
        if value103 >= 0 then
            if value103 <= 100 then
                if value103 == 0 then
                    table.insert(config38, "zero")
                    continue
                else
                    table.insert(config38, classify(value103))
                end
            end
        end
    end
    return config38
end

local makePayload
makePayload = function(value104)
    local value105 = value104 % 2 == 0
    local value106: string = "stress"
    local value107 = classify(value104)
    local result23 = if isEven(math.abs(value104)) then "even" else "odd"
    local config39 = { value106, value107, result23 }
    result23 = math.abs
    result23 = result23(value104)
    result23 = value104 + 1
    local config40 = {
        id = value104,
        name = "Payload-%*":format(value104),
        enabled = value105,
        tags = config39,
        metadata = {
            factorial = factorial(math.clamp(result23, 0, 8)),
            bit = bitStress(value104),
            expression = expressionStress(value104, result23, value104 + 2),
            fixedOne = fixedOneFromMulti(value104),
            callTail = callWithOpenTail(value104),
            stateMachine = stateMachineStress(value104),
        },
    }
    return config40
end
local config41 = {
    Name = "MegaStress",
    Version = 7,
    Enabled = true,
    Services = config,
    Numbers = config2,
    Strings = config3,
    Colors = config4,
    Nested = config5,
    DynamicLike = config6,
}
local module = { Counter = config7, Config = config41 }
function module.BuildMegaTable(value108)
    local result24, value109 = makeAccumulator(value108)
    local value110 = makeRecursiveClosure(2)
    local value111 = nestedCallbacks(value108)
    local value112 = result24(5)
    local value113 = result24(-2)
    local result25, value114 = value109()
    local result26, value115, value116 = returnsThree(value108)
    local value117 = value108 % 2 == 0
    result27 = math.clamp
    result27 = result27(value108, 0, 20)
    result27 = value108
    result27 = value108
    result27 = 4
    local config42 = {
        factorial = factorial(math.clamp(value108, 0, 8)),
        branchPhi = loopStress(result27, value108),
        loops = loopStress(result27),
        expression = expressionStress(result27, value108 + 2, value108 + 3),
        bits = bitStress(result27),
        recursiveClosure = value110(result27),
    }
    local config43 = { first = value112, second = value113, total = result25, calls = value114 }
    result27 = value108
    result27 = fixedTwoFromMulti
    result27 = result27(value108)
    result27 = forwardMulti
    result27 = result27(value108)
    result27 = value108
    result27 = value108
    result27 = result26
    local config44 = {
        fixedOne = fixedOneFromMulti(result27),
        fixedTwo = table.pack(result27),
        forwarded = table.pack(result27),
        openTable = trueOpenMultretTable(result27),
        fixedTable = fixedCallTable(result27),
        direct = { result27, value115, value116 },
    }
    result27 = value108
    result27 = value108
    result27 = rgb
    result27 = result27(255, 64, 110)
    local config45 = { result27 }
    local config46 = {
        callValued = callValuedTable(result27),
        dynamic = dynamicRmwStress(result27),
        colors = config45,
        nestedCalls = { result27, rgb(255, 0, 0), rgb(0, 255, 0) },
    }
    local config47 = { name = "A", value = math.max(value108, 1), color = rgb(255, 0, 0) }
    result27 = 1
    result27 = 2
    result27 = value111.snapshot
    result27 = result27()
    local config48 = {
        first = value111.first(result27),
        second = value111.second(result27),
        snapshot = table.pack(result27),
    }
    result27 = "seed-%*"
    local config49 = { name = "C", value = math.abs(value108), color = rgb(0, 0, 255) }
    config49 = value108
    local config50 = { name = "B", value = math.min(value108, 100), color = rgb(0, 255, 0) }
    result27 = result27:format(config49)
    result27 = value108
    local config51 = {
        formatted = stringStress(result27, value108),
        class = classify(result27),
        unicode = config41.Strings.unicode,
    }
    result27 = math.abs
    result27 = result27(value108)
    result27 = math.abs
    result27 = result27(value108)
    local config52 = { even = isEven(result27), odd = isOdd(result27) }
    local config53 = {
        payload = makePayload(value108),
        calculations = config42,
        accumulator = config43,
        multi = config44,
        constructors = config46,
        callbacks = config48,
        strings = config51,
    }
    result27 = if value108 <= 0 then false else true
    config49 = value108 % 2
    local value118 = config49 == 0
    config49 = value108 < 10
    local booleanShortCircuit = booleanShortCircuit(result27, value118, config49)
    config52.complex = booleanShortCircuit
    result27 = 0
    local result29
    if result27 < value108 then
        result27 = "positive"
        result29 = sideEffect(result27)
        if not result29 then
            result27 = "fallback"
            result29 = sideEffect(result27)
        end
    end
    config52.sideEffectValue = result29
    config53.booleans = config52
    return config53
end

function module.ControlFlow(value119, index20)
    if #index20 == 0 then
        local config54 = { empty = true, total = 0 }
        return config54
    else
        local config55 = { alpha = value119, beta = value119 + 1, gamma = value119 + 2 }
        local value120 = genericLoopStress(index20, config55)
        local value121 = earlyBreakContinueStress(index20)
        local result30 = if value120 > 100 then "large" elseif 100 < value120 then "medium" else "small"
        local config56 = {
            empty = false,
            total = value120,
            category = result30,
            filtered = value121,
            guarded = guarded(value119),
        }
        return config56
    end
end

function module.Varargs(value122, ...)
    local result31, value123, value124, value125 = varargStats(...)
    local config57 = {
        count = result31,
        first = value123,
        last = value124,
        packed = value125,
        forwarded = table.pack(forwardVarargs(returnsThree, value122)),
    }
    return config57
end

function module.Objects(value126)
    local value127 = config7.new(value126)
    value127:add(5)
    value127:multiply(2)
    local function callback(value128, index21)
        return value128 + index21 + value127.value
    end

    local value129 = makeCallable(callback)
    local config58 = {
        counter = value127,
        last = value127:getLast(),
        callable = value129,
        callableResult = value129(value126, value126 + 1),
        callableText = tostring(value129),
    }
    return config58
end

function module.SafeOperations(value130, index22)
    local function callback()
        if index22 < 0 then
            error("negative seed")
        end
        return makePayload(index22)
    end

    local config59 = {
        decoded = safeJsonDecode(value130),
        protected = xpcallStress(callback),
        coroutineResult = table.pack(coroutineStress(index22)),
        bufferValue = bufferStress(index22),
    }
    return config59
end

function module.InstancePatterns(value131, index23)
    local result32, value132 = instancePhiStress(value131)
    local value133 = chainedFindStress(value131)
    local value134 = collectionStress(value131)
    local result33 = if index23 then tweenStress(index23, 0.25) else nil
    local config60 = {
        part = result32,
        color = value132,
        deep = value133,
        collection = value134,
        tween = result33,
    }
    return config60
end

function module.Connect(value135)
    return connectionStress(value135)
end

function module.NegativeCases(value136, index24, count9)
    local result34, value137 = repeatedCallNegative(index24)
    local result35, value138 = mutableSnapshotNegative(count9)
    local config61 = { result34, value137 }
    local config62 = {
        escaped = tableEscapeNegative(value136, 123),
        repeated = config61,
        mutable = { result35, value138 },
    }
    return config62
end

function module.Misc(value139, index25)
    local result36, value140, value141, value142 = localAliasStress(index25)
    local result37, value143, value144 = multiAssignmentStress(value139)
    local config63 = { value139, value139 + 1, value139 + 2, value139 - 1, 0, 101 }
    local function callback()
        local result38: boolean = false
        if #value140 > 0 then
            result38 = value141 ~= nil
        end
        return result38
    end

    local config64 = {
        identity = genericIdentity(value139),
        directReturn = directReturnCall(value139),
        shadowing = shadowingStress(value139),
        complexCondition = complexCondition(index25, result36, value142, callback),
        sorted = sortingCallbackStress(config63),
        multi = { result37, value143, value144 },
    }
    return config64
end

function module.RunEverything(value145, index26, count10)
    value145 = math.floor(value145)
    local value146 = makePayload(value145)
    local value147 = module.BuildMegaTable(value145)
    local config65 = { 1, 2, 3, -1, 5, 150 }
    local value148 = module.ControlFlow(value145, config65)
    local value149 = module.Objects(value145)
    local value150 = module.Misc(value145, value146)
    local result38 = if index26 then module.InstancePatterns(index26, count10) else nil
    local config66 = { seed = value145, payload = value146, mega = value147 }
    callback5 = config66
    local config67 = {
        seed = value145,
        mega = value147,
        flow = value148,
        objects = value149,
        misc = value150,
        instances = result38,
    }
    config67.sharedCounter = value2
    config67.sharedFlag = value3
    config67.sharedObject = callback5
    config67.localPlayer = player
    return config67
end

return module
