local ReplicatedStorage: ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService: RunService = game:GetService("RunService")
local Players: Players = game:GetService("Players")
local TweenService: TweenService = game:GetService("TweenService")
local HttpService: HttpService = game:GetService("HttpService")
local CollectionService: CollectionService = game:GetService("CollectionService")
local LocalPlayer: Player = Players.LocalPlayer
local tweenInfo = TweenInfo.new(0.5, Enum.EasingStyle.Quad, Enum.EasingDirection.Out)
local optionalModule: Instance = script:FindFirstChild("OptionalModule")
local OptionalDependency = if optionalModule and optionalModule:IsA("ModuleScript") then require(optionalModule) else nil
local sharedCounter: number = 0
local sharedFlag: boolean = false
local function rgb(r, g, b)
    return Color3.fromRGB(r, g, b)
end

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
    sharedCounter += 1
    sharedFlag = not sharedFlag
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
    end
    if not index7 then
        return nil
    end
    if not count6 then
        return nil
    end
    return value25, index7, count6
end

local Counter = {}
Counter.__index = Counter
function Counter.new(value)
    local metadata = { createdAt = os.clock(), color = rgb(100, 150, 200) }
    metadata = Counter
    return setmetatable({ value = value, history = { value }, metadata = metadata }, metadata)
end

function Counter:add(index8)
    self.value += index8
    table.insert(self.history, self.value)
    return self.value
end

function Counter:multiply(index9)
    self.value *= index9
    table.insert(self.history, self.value)
    return self.value
end

function Counter:reset()
    self.value = 0
    table.clear(self.history)
    table.insert(self.history, 0)
end

function Counter:getLast()
    return self.history[#self.history]
end

local makeAccumulator
makeAccumulator = function(value31)
    local total: number = 0
    local accumulate
    accumulate = function(value33)
        total += 1
        value31 += value33
        sharedCounter += 1
        return value31
    end
    local stats
    stats = function()
        return value31, total
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

local function makeCallable(callback)
    function config12:__call(...)
        self.calls += 1
        return self.callback(...)
    end

    function config12:__tostring()
        return "Callable(calls=%*)":format(self.calls)
    end

    return setmetatable({ calls = 0, callback = callback }, {})
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
    for i = 1, value41 do
        if i % 2 == 0 then
            continue
        end
        local result6
        for j = 1, 5 do
            if j == 4 and i > 6 then
                break
            end
            result6 += i * j
        end
    end
    local descending = value41
    local result8
    while descending > 0 do
        descending -= 1
        if descending == 3 then
            continue
        end
        result8 += descending
        if result8 > 10000 then
            break
        end
    end
    local repeatCount: number = 0
    local total2
    repeat
        repeatCount += 1
        total2 += repeatCount
    until repeatCount >= 3
    return total2
end

local function genericLoopStress(value42, index13)
    local total3: number = 0
    for key, value44 in ipairs(value42) do
        total3 += key * value44
    end
    for key2, value45 in pairs(index13) do
        if #key2 > 0 then
            total3 += value45
        end
    end
    for _, value46 in value42 do
        total3 += value46
    end
    for key3, value47 in reverseIterator, value42 do
        total3 += key3 + value47
    end
    return total3
end

local function dynamicRmwStress(value48)
    local value49 = value48 % 3 + 1
    local value50 = "key_%*":format(value48 % 4)
    local config15 = {
        array = { 10, 20, 30 },
        map = { key_0 = 1, key_1 = 2, key_2 = 3, key_3 = 4 },
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

local function callValuedTable(id)
    local config16 = { position = CFrame.new(id, 0, 0) }
    local config17 = {
        id = id,
        label = "fixture-%*":format(id),
        color = rgb(id % 255, id * 2 % 255, id * 3 % 255),
        vector = Vector3.new(id, id + 1, id + 2),
    }
    local colors = { rgb(255, 0, 0), rgb(0, 255, 0), rgb(0, 0, 255) }
    colors = id
    local config21 = {
        id = id,
        label = "fixture-%*":format(id),
        color = rgb(id % 255, id * 2 % 255, id * 3 % 255),
        vector = Vector3.new(id, id + 1, id + 2),
        ["dynamic_%*":format(id)] = math.abs(colors),
        nested = {
            position = CFrame.new(id, 0, 0),
            values = { math.max(id, 1), math.floor(id / 2), math.clamp(id, 0, 100) },
            colors = colors,
        },
    }
    colors = if id % 2 ~= 0 then false else true
    local chooseValue = chooseValue(colors, "even", "odd")
    config21[id] = chooseValue
    return config21
end

local function trueOpenMultretTable(value52)
    return { "prefix", returnsThree(value52) }
end

local function fixedCallTable(value53)
    return {
        fixedOne = returnsThree(value53),
        packed = table.pack(returnsThree(value53 + 20)),
        nested = { returnsThree(value53 + 10) },
    }
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
    return (`{string.gsub("user=%*; id=%*; class=%*":format(value58, index15, classify(index15)), "user=", "name=")}::` .. table.concat({ "alpha", "beta", tostring(index15) }, "|")) .. "::🇦🇷"
end

local function safeJsonDecode(value59)
    local result12, value = pcall(HttpService.JSONDecode, HttpService, value59)
    if result12 then
        return { ok = true, value = value }
    else
        return { ok = false, error = tostring(value) }
    end
end

local function xpcallStress(value61)
    local function onError(value62)
        return "handled:%*":format(tostring(value62))
    end

    local result13, value2 = xpcall(value61, onError)
    if result13 then
        return { ok = true, value = value2 }
    else
        return { ok = false, error = tostring(value2) }
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
        end
        return nil, nil
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

local function tableEscapeNegative(value74, value2)
    local config30 = {}
    value74(config30)
    config30.value = value2
    return config30
end

local function repeatedCallNegative(value75)
    local value76 = value75()
    return value76, value76
end

local function mutableSnapshotNegative(value77)
    local Config = value77.Config
    sideEffect("mutation-barrier")
    return Config.Value, Config.Value
end

local function stateMachineStress(value78)
    local result17: string = "start"
    local total4: number = 0
    local result19: number = 0
    while result17 ~= "done" do
        result19 += 1
        if result19 > 20 then
            result17 = "done"
            continue
        end
        if result17 == "start" then
            total4 += value78
            if value78 % 2 == 0 then
                result17 = "even"
            else
                result17 = "odd"
            end
        elseif result17 == "even" then
            total4 *= 2
            result17 = "finalize"
        elseif result17 == "odd" then
            total4 = total4 * 3 + 1
            result17 = "finalize"
        elseif result17 == "finalize" then
            total4 = math.floor(total4 / 2)
            result17 = "done"
        else
            result17 = "done"
        end
    end
    return total4
end

local function nestedCallbacks(captured)
    local history = {}
    local outer
    outer = function(value80)
        local function_2
        function_2 = function(value81)
            captured += value81
            callback *= 2
            local config33 = {}
            config33.captured = captured
            config33.localState = callback
            config33.color = rgb(captured % 255, callback % 255, 128)
            table.insert(history, config33)
            config33 = callback
            return captured + config33
        end
        return function_2
    end
    local snapshot
    snapshot = function()
        return captured, #history
    end
    return { first = outer(2), second = outer(3), history = history, snapshot = snapshot }
end

local tweenStress
tweenStress = function(value82, BackgroundTransparency)
    if not value82:IsA("GuiObject") then
        return nil
    end
    local config35 = {
        BackgroundTransparency = BackgroundTransparency,
        Position = UDim2.fromScale(0.5, 0.5),
    }
    local value83 = TweenService:Create(value82, tweenInfo, config35)
    local function onCompleted(playbackState: Enum.PlaybackState)
        callback2 = nil
        if playbackState == Enum.PlaybackState.Completed then
            sharedCounter += 1
        end
    end

    value83.Completed:Once(onCompleted)
    callback2 = value83
    value83:Play()
    return value83
end
local connectionStress
connectionStress = function(value85)
    local callback
    callback = function(...)
        callback3 += select("#", ...)
        sharedCounter += 1
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
    local tags2 = CollectionService:GetTags(value86)
    local map2 = {}
    for _, value88 in tags2 do
        map2[value88] = true
    end
    local hasAny = #tags2 > 0
    return { tags = tags2, map = map2, hasAny = hasAny }
end

local function optionalDependencyStress(value90)
    if OptionalDependency and type(OptionalDependency) == "table" then
        local transform = OptionalDependency.transform
        return if type(transform) == "function" then transform(value90) else value90
    end
end

local shadowingStress
shadowingStress = function(value91)
    local result20 = (value91 + 1) * 2 or result20 - 3
    sharedCounter += result20
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
        end
        local value96 = index19 < value95
        return value96
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
        if value103 < 0 then
            continue
        end
        if value103 > 100 then
            break
        end
        local result22
        if value103 == 0 then
            table.insert(config38, "zero")
        else
            table.insert(config38, classify(value103))
        end
    end
    return config38
end

local makePayload
makePayload = function(id2)
    local enabled = id2 % 2 == 0
    local value106: string = "stress"
    local value107 = classify(id2)
    local result23 = if isEven(math.abs(id2)) then "even" else "odd"
    local tags3 = { value106, value107, result23 }
    result23 = math.abs
    result23 = result23(id2)
    result23 = id2 + 1
    local config40 = {
        id = id2,
        name = "Payload-%*":format(id2),
        enabled = enabled,
        tags = tags3,
        metadata = {
            factorial = factorial(math.clamp(result23, 0, 8)),
            bit = bitStress(id2),
            expression = expressionStress(id2, result23, id2 + 2),
            fixedOne = fixedOneFromMulti(id2),
            callTail = callWithOpenTail(id2),
            stateMachine = stateMachineStress(id2),
        },
    }
    return config40
end
local CONFIG = {
    Name = "MegaStress",
    Version = 7,
    Enabled = true,
    Services = {
        ReplicatedStorage = ReplicatedStorage,
        RunService = RunService,
        TweenService = TweenService,
    },
    Numbers = {
        zero = 0,
        one = 1,
        negative = -42,
        fraction = 0.3333333333333333,
        pi = math.pi,
        huge = math.huge,
    },
    Strings = {
        plain = "hello",
        escaped = "line1\nline2\t\"quoted\"\\slash",
        unicode = "🇦🇷 — café — 日本語 — 🚀",
        asset = "rbxassetid://123456789",
    },
    Colors = {
        Primary = rgb(255, 64, 110),
        Secondary = rgb(20, 255, 80),
        Gradient = { rgb(255, 0, 0), rgb(0, 255, 0), rgb(0, 0, 255) },
    },
    Nested = {
        A = {
            B = {
                C = {
                    value = math.floor(10.75),
                    vector = Vector3.new(1, 2, 3),
                    cframe = CFrame.new(1, 2, 3) * CFrame.Angles(0, math.pi / 2, 0),
                },
            },
        },
    },
    DynamicLike = { hello world = true, [100] = "numeric-key", [false] = "boolean-key" },
}
local module = { Counter = Counter, Config = CONFIG }
function module.BuildMegaTable(value108)
    local accumulator, stats4 = makeAccumulator(value108)
    local recursiveClosure = makeRecursiveClosure(2)
    local value111 = nestedCallbacks(value108)
    local first = accumulator(5)
    local second = accumulator(-2)
    local total5, calls = stats4()
    local result26, value115, value116 = returnsThree(value108)
    local value117 = value108 % 2 == 0
    result27 = math.clamp
    result27 = result27(value108, 0, 20)
    result27 = value108
    result27 = value108
    result27 = 4
    result27 = value108
    result27 = fixedTwoFromMulti
    result27 = result27(value108)
    result27 = forwardMulti
    result27 = result27(value108)
    result27 = value108
    result27 = value108
    result27 = result26
    result27 = value108
    result27 = value108
    result27 = rgb
    result27 = result27(255, 64, 110)
    local config47 = { name = "A", value = math.max(value108, 1), color = rgb(255, 0, 0) }
    result27 = 1
    result27 = 2
    result27 = value111.snapshot
    result27 = result27()
    result27 = "seed-%*"
    local config49 = { name = "C", value = math.abs(value108), color = rgb(0, 0, 255) }
    config49 = value108
    local config50 = { name = "B", value = math.min(value108, 100), color = rgb(0, 255, 0) }
    result27 = result27:format(config49)
    result27 = value108
    result27 = math.abs
    result27 = result27(value108)
    result27 = math.abs
    result27 = result27(value108)
    local booleans = { even = isEven(result27), odd = isOdd(result27) }
    local config53 = {
        payload = makePayload(value108),
        calculations = {
            factorial = factorial(math.clamp(value108, 0, 8)),
            branchPhi = loopStress(result27, value108),
            loops = loopStress(result27),
            expression = expressionStress(result27, value108 + 2, value108 + 3),
            bits = bitStress(result27),
            recursiveClosure = recursiveClosure(result27),
        },
        accumulator = { first = first, second = second, total = total5, calls = calls },
        multi = {
            fixedOne = fixedOneFromMulti(result27),
            fixedTwo = table.pack(result27),
            forwarded = table.pack(result27),
            openTable = trueOpenMultretTable(result27),
            fixedTable = fixedCallTable(result27),
            direct = { result27, value115, value116 },
        },
        constructors = {
            callValued = callValuedTable(result27),
            dynamic = dynamicRmwStress(result27),
            colors = { result27 },
            nestedCalls = { result27, rgb(255, 0, 0), rgb(0, 255, 0) },
        },
        callbacks = {
            first = value111.first(result27),
            second = value111.second(result27),
            snapshot = table.pack(result27),
        },
        strings = {
            formatted = stringStress(result27, value108),
            class = classify(result27),
            unicode = CONFIG.Strings.unicode,
        },
    }
    result27 = if value108 <= 0 then false else true
    config49 = value108 % 2
    local value118 = config49 == 0
    config49 = value108 < 10
    local booleanShortCircuit = booleanShortCircuit(result27, value118, config49)
    booleans.complex = booleanShortCircuit
    result27 = 0
    local sideEffectValue
    if result27 < value108 then
        result27 = "positive"
        sideEffectValue = sideEffect(result27)
        if not sideEffectValue then
            result27 = "fallback"
            sideEffectValue = sideEffect(result27)
        end
    end
    booleans.sideEffectValue = sideEffectValue
    config53.booleans = booleans
    return config53
end

function module.ControlFlow(alpha, index20)
    if #index20 == 0 then
        return { empty = true, total = 0 }
    else
        local total6 = genericLoopStress(index20, { alpha = alpha, beta = alpha + 1, gamma = alpha + 2 })
        local filtered = earlyBreakContinueStress(index20)
        local category = if total6 > 100 then "large" elseif 100 < total6 then "medium" else "small"
        return {
            empty = false,
            total = total6,
            category = category,
            filtered = filtered,
            guarded = guarded(alpha),
        }
    end
end

function module.Varargs(value122, ...)
    local count, first2, last, packed2 = varargStats(...)
    return {
        count = count,
        first = first2,
        last = last,
        packed = packed2,
        forwarded = table.pack(forwardVarargs(returnsThree, value122)),
    }
end

function module.Objects(value126)
    local config7 = Counter.new(value126)
    config7:add(5)
    config7:multiply(2)
    local function callback(value128, index21)
        return value128 + index21 + config7.value
    end

    local callable = makeCallable(callback)
    return {
        counter = config7,
        last = config7:getLast(),
        callable = callable,
        callableResult = callable(value126, value126 + 1),
        callableText = tostring(callable),
    }
end

function module.SafeOperations(value130, index22)
    local function callback()
        if index22 < 0 then
            error("negative seed")
        end
        return makePayload(index22)
    end

    return {
        decoded = safeJsonDecode(value130),
        protected = xpcallStress(callback),
        coroutineResult = table.pack(coroutineStress(index22)),
        bufferValue = bufferStress(index22),
    }
end

function module.InstancePatterns(value131, index23)
    local part2, color = instancePhiStress(value131)
    local deep = chainedFindStress(value131)
    local collection = collectionStress(value131)
    local tween = if index23 then tweenStress(index23, 0.25) else nil
    return { part = part2, color = color, deep = deep, collection = collection, tween = tween }
end

function module.Connect(value135)
    return connectionStress(value135)
end

function module.NegativeCases(value136, index24, count9)
    local result34, value137 = repeatedCallNegative(index24)
    local result35, value138 = mutableSnapshotNegative(count9)
    return {
        escaped = tableEscapeNegative(value136, 123),
        repeated = { result34, value137 },
        mutable = { result35, value138 },
    }
end

function module.Misc(value139, index25)
    local result36, value140, value141, value142 = localAliasStress(index25)
    local result37, value143, value144 = multiAssignmentStress(value139)
    local function callback()
        local result38: boolean = false
        if #value140 > 0 then
            result38 = value141 ~= nil
        end
        return result38
    end

    return {
        identity = genericIdentity(value139),
        directReturn = directReturnCall(value139),
        shadowing = shadowingStress(value139),
        complexCondition = complexCondition(index25, result36, value142, callback),
        sorted = sortingCallbackStress(config63),
        multi = { result37, value143, value144 },
    }
end

function module.RunEverything(seed, index26, count10)
    seed = math.floor(seed)
    local payload = makePayload(seed)
    local mega = module.BuildMegaTable(seed)
    local flow = module.ControlFlow(seed, { 1, 2, 3, -1, 5, 150 })
    local objects = module.Objects(seed)
    local misc = module.Misc(seed, payload)
    local instances = if index26 then module.InstancePatterns(index26, count10) else nil
    callback5 = { seed = seed, payload = payload, mega = mega }
    local config67 = {
        seed = seed,
        mega = mega,
        flow = flow,
        objects = objects,
        misc = misc,
        instances = instances,
    }
    config67.sharedCounter = sharedCounter
    config67.sharedFlag = sharedFlag
    config67.sharedObject = callback5
    config67.localPlayer = LocalPlayer
    return config67
end

return module
