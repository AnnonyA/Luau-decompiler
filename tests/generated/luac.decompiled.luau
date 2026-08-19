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
    local metadata = Counter
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
    local config12 = {}
    function config12:__call(...)
        self.calls += 1
        return self.callback(...)
    end

    function config12:__tostring()
        return "Callable(calls=%*)":format(self.calls)
    end

    return setmetatable({ calls = 0, callback = callback }, config12)
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

local function loopStress(limit)
    local total: number = 0
    for i = 1, limit do
        if i % 2 == 0 then
            continue
        end
        for j = 1, 5 do
            if j == 4 and i > 6 then
                break
            end
            total += i * j
        end
    end
    local descending = limit
    while descending > 0 do
        descending -= 1
        if descending == 3 then
            continue
        end
        total += descending
        if total > 10000 then
            break
        end
    end
    local repeatCount: number = 0
    repeat
        repeatCount += 1
        total += repeatCount
    until repeatCount >= 3
    return total
end

local function genericLoopStress(value42, index13)
    local total: number = 0
    for key, value44 in ipairs(value42) do
        total += key * value44
    end
    for key2, value45 in pairs(index13) do
        if #key2 > 0 then
            total += value45
        end
    end
    for _, value46 in value42 do
        total += value46
    end
    for key3, value47 in reverseIterator, value42 do
        total += key3 + value47
    end
    return total
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

local function callValuedTable(seed)
    local config16 = { position = CFrame.new(seed, 0, 0) }
    local config17 = {
        id = seed,
        label = "fixture-%*":format(seed),
        color = rgb(seed % 255, seed * 2 % 255, seed * 3 % 255),
        vector = Vector3.new(seed, seed + 1, seed + 2),
    }
    local colors = seed
    local config21 = {
        id = seed,
        label = "fixture-%*":format(seed),
        color = rgb(seed % 255, seed * 2 % 255, seed * 3 % 255),
        vector = Vector3.new(seed, seed + 1, seed + 2),
        ["dynamic_%*":format(seed)] = math.abs(colors),
        nested = {
            position = CFrame.new(seed, 0, 0),
            values = { math.max(seed, 1), math.floor(seed / 2), math.clamp(seed, 0, 100) },
            colors = colors,
        },
    }
    colors = if seed % 2 ~= 0 then false else true
    local chooseValue2 = chooseValue(colors, "even", "odd")
    config21[seed] = chooseValue2
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
    local result8, value = pcall(HttpService.JSONDecode, HttpService, value59)
    if result8 then
        return { ok = true, value = value }
    else
        return { ok = false, error = tostring(value) }
    end
end

local function xpcallStress(value61)
    local function onError(value62)
        return "handled:%*":format(tostring(value62))
    end

    local result9, value = xpcall(value61, onError)
    if result9 then
        return { ok = true, value = value }
    else
        return { ok = false, error = tostring(value) }
    end
end

local function coroutineStress(value64)
    local function routine(value65)
        coroutine.yield(value65 + 1, value65 + 2)
        return value65 + 3
    end

    local value66 = coroutine.create(routine)
    local result10, value67, value68 = coroutine.resume(value66, value64)
    local result11, value69 = coroutine.resume(value66)
    return result10, value67, value68, result11, value69
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
    local result12 = if part and part:IsA("BasePart") then part.Color else nil
    if part then
        if result12 then
            return part, result12
        end
        return nil, nil
    end
end

local function chainedFindStress(value73)
    local result13: Instance = value73:FindFirstChild("A")
    if result13 then
        result13 = result13:FindFirstChild("B")
    end
    result13 = result13 or result13:FindFirstChild("C")
    return result13
end

local function tableEscapeNegative(value74, value)
    local config30 = {}
    value74(config30)
    config30.value = value
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
    local result13: string = "start"
    local total: number = 0
    local result15: number = 0
    while result13 ~= "done" do
        result15 += 1
        if result15 > 20 then
            result13 = "done"
            continue
        end
        if result13 == "start" then
            total += value78
            if value78 % 2 == 0 then
                result13 = "even"
            else
                result13 = "odd"
            end
        elseif result13 == "even" then
            total *= 2
            result13 = "finalize"
        elseif result13 == "odd" then
            total = total * 3 + 1
            result13 = "finalize"
        elseif result13 == "finalize" then
            total = math.floor(total / 2)
            result13 = "done"
        else
            result13 = "done"
        end
    end
    return total
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
        local result16 = callback3
        if result16 >= 5 then
            result16 = callback4
            if result16 then
                callback4:Disconnect()
                result16 = nil
                callback4 = result16
            end
        end
    end
    callback4 = value85:Connect(callback)
    return callback4
end
local function collectionStress(value86)
    local tags = CollectionService:GetTags(value86)
    local map = {}
    for _, value88 in tags do
        map[value88] = true
    end
    local hasAny = #tags > 0
    return { tags = tags, map = map, hasAny = hasAny }
end

local function optionalDependencyStress(value90)
    if OptionalDependency and type(OptionalDependency) == "table" then
        local transform = OptionalDependency.transform
        return if type(transform) == "function" then transform(value90) else value90
    end
end

local shadowingStress
shadowingStress = function(value91)
    local result16 = (value91 + 1) * 2 or result16 - 3
    sharedCounter += result16
    return value91
end
local function complexCondition(value92, index18, count8, options)
    local result17
    if value92 ~= nil and index18 ~= nil then
        result17 = true
        if value92 == index18 and count8 then
            result17 = options()
            if not result17 then
                result17 = not value92
                if result17 then
                    result17 = not index18 or not count8
                end
            end
        end
    end
    return result17
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
    local result17, value100, value101 = returnsThree(value99 + 10)
    return result17, value100, value101
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
        local result18
        if value103 == 0 then
            table.insert(config38, "zero")
        else
            table.insert(config38, classify(value103))
        end
    end
    return config38
end

local makePayload
makePayload = function(id)
    local enabled = id % 2 == 0
    local value106: string = "stress"
    local value107 = classify(id)
    local result19 = if isEven(math.abs(id)) then "even" else "odd"
    local tags = { value106, value107, result19 }
    result19 = id + 1
    local config40 = {
        id = id,
        name = "Payload-%*":format(id),
        enabled = enabled,
        tags = tags,
        metadata = {
            factorial = factorial(math.clamp(result19, 0, 8)),
            bit = bitStress(id),
            expression = expressionStress(id, result19, id + 2),
            fixedOne = fixedOneFromMulti(id),
            callTail = callWithOpenTail(id),
            stateMachine = stateMachineStress(id),
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
function module.BuildMegaTable(seed)
    local accumulator, stats = makeAccumulator(seed)
    local recursiveClosure = makeRecursiveClosure(2)
    local value111 = nestedCallbacks(seed)
    local first = accumulator(5)
    local second = accumulator(-2)
    local total, calls = stats()
    local result22, value115, value116 = returnsThree(seed)
    local config47 = { name = "A", value = math.max(seed, 1), color = rgb(255, 0, 0) }
    local config50 = { name = "B", value = math.min(seed, 100), color = rgb(0, 255, 0) }
    local value117 = math.abs(seed)
    local booleans = { even = isEven(value117), odd = isOdd(value117) }
    local config53 = {
        payload = makePayload(seed),
        calculations = {
            factorial = factorial(math.clamp(seed, 0, 8)),
            branchPhi = loopStress(value117, seed),
            loops = loopStress(value117),
            expression = expressionStress(value117, seed + 2, seed + 3),
            bits = bitStress(value117),
            recursiveClosure = recursiveClosure(value117),
        },
        accumulator = { first = first, second = second, total = total, calls = calls },
        multi = {
            fixedOne = fixedOneFromMulti(value117),
            fixedTwo = table.pack(value117),
            forwarded = table.pack(value117),
            openTable = trueOpenMultretTable(value117),
            fixedTable = fixedCallTable(value117),
            direct = { value117, value115, value116 },
        },
        constructors = {
            callValued = callValuedTable(value117),
            dynamic = dynamicRmwStress(value117),
            colors = { value117 },
            nestedCalls = { value117, rgb(255, 0, 0), rgb(0, 255, 0) },
        },
        callbacks = {
            first = value111.first(value117),
            second = value111.second(value117),
            snapshot = table.pack(value117),
        },
        strings = {
            formatted = stringStress(value117, seed),
            class = classify(value117),
            unicode = CONFIG.Strings.unicode,
        },
    }
    value117 = if seed <= 0 then false else true
    local config49 = seed % 2
    local value118 = config49 == 0
    config49 = seed < 10
    local booleanShortCircuit2 = booleanShortCircuit(value117, value118, config49)
    booleans.complex = booleanShortCircuit2
    value117 = 0
    if value117 < seed then
        value117 = "positive"
        booleanShortCircuit2 = sideEffect(value117)
        if not booleanShortCircuit2 then
            value117 = "fallback"
            booleanShortCircuit2 = sideEffect(value117)
        end
    end
    booleans.sideEffectValue = booleanShortCircuit2
    config53.booleans = booleans
    return config53
end

function module.ControlFlow(alpha, index20)
    if #index20 == 0 then
        return { empty = true, total = 0 }
    else
        local total = genericLoopStress(index20, { alpha = alpha, beta = alpha + 1, gamma = alpha + 2 })
        local filtered = earlyBreakContinueStress(index20)
        local category = if total > 100 then "large" elseif 100 < total then "medium" else "small"
        return {
            empty = false,
            total = total,
            category = category,
            filtered = filtered,
            guarded = guarded(alpha),
        }
    end
end

function module.Varargs(value122, ...)
    local count, first, last, packed = varargStats(...)
    return {
        count = count,
        first = first,
        last = last,
        packed = packed,
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

function module.SafeOperations(value130, seed)
    local function callback()
        if seed < 0 then
            error("negative seed")
        end
        return makePayload(seed)
    end

    return {
        decoded = safeJsonDecode(value130),
        protected = xpcallStress(callback),
        coroutineResult = table.pack(coroutineStress(seed)),
        bufferValue = bufferStress(seed),
    }
end

function module.InstancePatterns(value131, index23)
    local part, color = instancePhiStress(value131)
    local deep = chainedFindStress(value131)
    local collection = collectionStress(value131)
    local tween = if index23 then tweenStress(index23, 0.25) else nil
    return { part = part, color = color, deep = deep, collection = collection, tween = tween }
end

function module.Connect(value135)
    return connectionStress(value135)
end

function module.NegativeCases(value136, index24, count9)
    local result27, value137 = repeatedCallNegative(index24)
    local result28, value138 = mutableSnapshotNegative(count9)
    return {
        escaped = tableEscapeNegative(value136, 123),
        repeated = { result27, value137 },
        mutable = { result28, value138 },
    }
end

function module.Misc(value139, index25)
    local result29, value140, value141, value142 = localAliasStress(index25)
    local result30, value143, value144 = multiAssignmentStress(value139)
    local function callback()
        local result31: boolean = false
        if #value140 > 0 then
            result31 = value141 ~= nil
        end
        return result31
    end

    return {
        identity = genericIdentity(value139),
        directReturn = directReturnCall(value139),
        shadowing = shadowingStress(value139),
        complexCondition = complexCondition(index25, result29, value142, callback),
        sorted = sortingCallbackStress(config63),
        multi = { result30, value143, value144 },
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
