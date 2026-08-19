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
local sharedObject = nil
local value5 = nil
local function rgb(r, g, b)
    return Color3.fromRGB(r, g, b)
end

local function returnsThree(seed)
    return seed, seed + 1, seed + 2
end

local function sum3(a, b, c)
    return a + b + c
end

local function fixedOneFromMulti(seed)
    return returnsThree(seed)
end

local function fixedTwoFromMulti(seed)
    local result2, value11 = returnsThree(seed)
    return result2, value11
end

local function forwardMulti(seed)
    return returnsThree(seed)
end

local function callWithOpenTail(seed)
    return sum3(returnsThree(seed))
end

local function varargStats(...)
    local count3 = select("#", ...)
    local packed = table.pack(...)
    return count3, packed[1], packed[count3], packed
end

local function forwardVarargs(seed, ...)
    return seed(...)
end

local factorial
factorial = function(seed)
    return if seed <= 1 then 1 else seed * factorial(seed - 1)
end
local value16 = nil
local isEven
isEven = function(seed)
    return if seed == 0 then true else value16(seed - 1)
end
local isOdd
isOdd = function(seed)
    return if seed == 0 then false else isEven(seed - 1)
end
local function genericIdentity(seed)
    return seed
end

local function chooseValue(a, b, c)
    return if a then b else c
end

local sideEffect
sideEffect = function(seed)
    sharedCounter += 1
    sharedFlag = not sharedFlag
    local value22 = #seed > 2
    return value22
end
local function valueShortCircuit(value23, index4)
    return value23 or index4
end

local function booleanShortCircuit(a, b, c)
    local result3 = a and b or not a and c
    return result3
end

local function guarded(seed)
    return if seed == nil then -1 elseif seed < 0 then 0 else seed
end

local function classify(score)
    return if score >= 100 then "legendary" elseif score >= 75 then "epic" elseif score >= 50 then "rare" elseif score >= 25 then "uncommon" else "common"
end

local function branchPhi(value27, index6)
    return if value27 then math.max(index6, 10) else math.min(index6, -10)
end

local function nestedGuard(a, b, c)
    if not a then
        return nil
    end
    if not b then
        return nil
    end
    if not c then
        return nil
    end
    return a, b, c
end

local Counter = {}
Counter.__index = Counter
function Counter.new(initial)
    local metadata = { createdAt = os.clock(), color = rgb(100, 150, 200) }
    metadata = Counter
    return setmetatable({ value = initial, history = { initial }, metadata = metadata }, metadata)
end

function Counter:add(amount)
    self.value += amount
    table.insert(self.history, self.value)
    return self.value
end

function Counter:multiply(amount)
    self.value *= amount
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
makeAccumulator = function(seed)
    local total = seed
    local calls: number = 0
    local accumulate
    accumulate = function(seed2)
        calls += 1
        total += seed2
        sharedCounter += 1
        return total
    end
    local stats
    stats = function()
        return total, calls
    end
    return accumulate, stats
end
local function makeRecursiveClosure(seed)
    local function_
    function_ = function(seed2)
        return if seed2 <= 0 then 0 else seed + function_(seed2 - 1)
    end
    return function_
end

local function makeCallable(callback)
    return setmetatable({ calls = 0, callback = callback }, {
        __call = function(self, ...)
        self.calls += 1
        return self.callback(...)
    end,
        __tostring = function(self)
        return "Callable(calls=%*)":format(self.calls)
    end,
    })
end

local function reverseIterator(value42, index10)
    local result4 = index10 or #value42 + 1
    local value43 = result4 - 1
    result4 = 1
    if value43 < result4 then
        result4 = nil
        return result4
    else
        result4 = value43
        return result4, value42[value43]
    end
end

local function loopStress(seed)
    local total: number = 0
    for i = 1, seed do
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
    local descending = seed
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

local function genericLoopStress(value45, index13)
    local total: number = 0
    for key, value47 in ipairs(value45) do
        total += key * value47
    end
    for key2, value48 in pairs(index13) do
        if #key2 > 0 then
            total += value48
        end
    end
    for _, value49 in value45 do
        total += value49
    end
    for key3, value50 in reverseIterator, value45 do
        total += key3 + value50
    end
    return total
end

local function dynamicRmwStress(seed)
    local value52 = seed % 3 + 1
    local value53 = "key_%*":format(seed % 4)
    local config15 = {
        array = { 10, 20, 30 },
        map = { key_0 = 1, key_1 = 2, key_2 = 3, key_3 = 4 },
        nested = { stats = { score = 5, multiplier = 2 } },
    }
    local array = config15.array
    array[value52] = array[value52] + seed
    local map = config15.map
    map[value53] = map[value53] + 1
    local stats2 = config15.nested.stats
    stats2.score += config15.array[value52]
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
    local colors = { rgb(255, 0, 0), rgb(0, 255, 0), rgb(0, 0, 255) }
    colors = seed
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

local function trueOpenMultretTable(seed)
    return { "prefix", returnsThree(seed) }
end

local function fixedCallTable(seed)
    return {
        fixedOne = returnsThree(seed),
        packed = table.pack(returnsThree(seed + 20)),
        nested = { returnsThree(seed + 10) },
    }
end

local function expressionStress(a, b, c)
    return math.floor(((a + b) * c + (a + b * c) + (a ^ 2 + b ^ 2) % math.max(c, 1)) / 3)
end

local function bitStress(seed)
    local value59 = bit32.band(seed, 255)
    local value60 = bit32.lshift(value59, 2)
    return bit32.bxor(value60, 90)
end

local function stringStress(name, id)
    return (`{string.gsub("user=%*; id=%*; class=%*":format(name, id, classify(id)), "user=", "name=")}::` .. table.concat({ "alpha", "beta", tostring(id) }, "|")) .. "::🇦🇷"
end

local function safeJsonDecode(seed)
    local result8, value = pcall(HttpService.JSONDecode, HttpService, seed)
    if result8 then
        return { ok = true, value = value }
    else
        return { ok = false, error = tostring(value) }
    end
end

local function xpcallStress(seed)
    local function onError(seed2)
        return "handled:%*":format(tostring(seed2))
    end

    local result9, value = xpcall(seed, onError)
    if result9 then
        return { ok = true, value = value }
    else
        return { ok = false, error = tostring(value) }
    end
end

local function coroutineStress(seed)
    local function routine(seed2)
        coroutine.yield(seed2 + 1, seed2 + 2)
        return seed2 + 3
    end

    local value69 = coroutine.create(routine)
    local result10, value70, value71 = coroutine.resume(value69, seed)
    local result11, value72 = coroutine.resume(value69)
    return result10, value70, value71, result11, value72
end

local function bufferStress(seed)
    local value74 = buffer.create(8)
    buffer.writeu8(value74, 0, seed % 256)
    buffer.writei16(value74, 1, seed)
    buffer.writef32(value74, 3, seed / 3)
    return buffer.readu8(value74, 0) + buffer.readi16(value74, 1)
end

local function instancePhiStress(seed)
    local part: Instance = seed:FindFirstChild("Part")
    local result12 = if part and part:IsA("BasePart") then part.Color else nil
    if part then
        if result12 then
            return part, result12
        end
        return nil, nil
    end
end

local function chainedFindStress(seed)
    local result13: Instance = seed:FindFirstChild("A")
    if result13 then
        result13 = result13:FindFirstChild("B")
    end
    result13 = result13 or result13:FindFirstChild("C")
    return result13
end

local function tableEscapeNegative(value77, value)
    local config30 = {}
    value77(config30)
    config30.value = value
    return config30
end

local function repeatedCallNegative(seed)
    local value79 = seed()
    return value79, value79
end

local function mutableSnapshotNegative(seed)
    local Config = seed.Config
    sideEffect("mutation-barrier")
    return Config.Value, Config.Value
end

local function stateMachineStress(seed)
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
            total += seed
            if seed % 2 == 0 then
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

local function nestedCallbacks(seed)
    local captured = seed
    local history = {}
    local outer
    outer = function(seed2)
        local localState = seed2
        local function_2
        function_2 = function(seed3)
            captured += seed3
            localState *= 2
            local config33 = {}
            config33.captured = captured
            config33.localState = localState
            config33.color = rgb(captured % 255, localState % 255, 128)
            table.insert(history, config33)
            config33 = localState
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
tweenStress = function(value85, BackgroundTransparency)
    if not value85:IsA("GuiObject") then
        return nil
    end
    local config35 = {
        BackgroundTransparency = BackgroundTransparency,
        Position = UDim2.fromScale(0.5, 0.5),
    }
    local tween = TweenService:Create(value85, tweenInfo, config35)
    local function onCompleted(playbackState: Enum.PlaybackState)
        value5 = nil
        if playbackState == Enum.PlaybackState.Completed then
            sharedCounter += 1
        end
    end

    tween.Completed:Once(onCompleted)
    value5 = tween
    tween:Play()
    return tween
end
local connectionStress
connectionStress = function(seed)
    local value89 = function(...)
        value89 += select("#", ...)
        sharedCounter += 1
        local result16 = value89
        if result16 >= 5 then
            result16 = value90
            if result16 then
                value90:Disconnect()
                result16 = nil
                value90 = result16
            end
        end
    end
    local connection = seed:Connect(value89)
    return connection
end
local function collectionStress(seed)
    local tags = CollectionService:GetTags(seed)
    local map = {}
    for _, value93 in tags do
        map[value93] = true
    end
    local hasAny = #tags > 0
    return { tags = tags, map = map, hasAny = hasAny }
end

local function optionalDependencyStress(seed)
    if OptionalDependency and type(OptionalDependency) == "table" then
        local transform = OptionalDependency.transform
        return if type(transform) == "function" then transform(seed) else seed
    end
end

local shadowingStress
shadowingStress = function(seed)
    local result16 = (seed + 1) * 2 or result16 - 3
    sharedCounter += result16
    return seed
end
local function complexCondition(value97, index18, count8, options)
    local result17
    if value97 ~= nil and index18 ~= nil then
        result17 = true
        if value97 == index18 and count8 then
            result17 = options()
            if not result17 then
                result17 = not value97
                if result17 then
                    result17 = not index18 or not count8
                end
            end
        end
    end
    return result17
end

local function sortingCallbackStress(seed)
    local value99 = table.clone(seed)
    local function compare(value100, index19)
        if value100 == index19 then
            return false
        end
        local value101 = index19 < value100
        return value101
    end

    table.sort(value99, compare)
    return value99
end

local function directReturnCall(seed)
    return optionalDependencyStress(seed)
end

local function localAliasStress(seed)
    local tags = seed.tags
    return seed.metadata, tags, tags[1], seed.enabled
end

local function multiAssignmentStress(seed)
    local result17, value105, value106 = returnsThree(seed + 10)
    return result17, value105, value106
end

local function earlyBreakContinueStress(seed)
    local config38 = {}
    for _, value108 in seed do
        if value108 < 0 then
            continue
        end
        if value108 > 100 then
            break
        end
        local result18
        if value108 == 0 then
            table.insert(config38, "zero")
        else
            table.insert(config38, classify(value108))
        end
    end
    return config38
end

local makePayload
makePayload = function(seed)
    local enabled = seed % 2 == 0
    local value111: string = "stress"
    local value112 = classify(seed)
    local result19 = if isEven(math.abs(seed)) then "even" else "odd"
    local tags = { value111, value112, result19 }
    result19 = seed + 1
    local config40 = {
        id = seed,
        name = "Payload-%*":format(seed),
        enabled = enabled,
        tags = tags,
        metadata = {
            factorial = factorial(math.clamp(result19, 0, 8)),
            bit = bitStress(seed),
            expression = expressionStress(seed, result19, seed + 2),
            fixedOne = fixedOneFromMulti(seed),
            callTail = callWithOpenTail(seed),
            stateMachine = stateMachineStress(seed),
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
    local value116 = nestedCallbacks(seed)
    local first = accumulator(5)
    local second = accumulator(-2)
    local total, calls = stats()
    local result22, value120, value121 = returnsThree(seed)
    local config47 = { name = "A", value = math.max(seed, 1), color = rgb(255, 0, 0) }
    local config49 = { name = "C", value = math.abs(seed), color = rgb(0, 0, 255) }
    local config50 = { name = "B", value = math.min(seed, 100), color = rgb(0, 255, 0) }
    local value122 = math.abs(seed)
    local booleans = { even = isEven(value122), odd = isOdd(value122) }
    local config53 = {
        payload = makePayload(seed),
        calculations = {
            factorial = factorial(math.clamp(seed, 0, 8)),
            branchPhi = loopStress(value122, seed),
            loops = loopStress(value122),
            expression = expressionStress(value122, seed + 2, seed + 3),
            bits = bitStress(value122),
            recursiveClosure = recursiveClosure(value122),
        },
        accumulator = { first = first, second = second, total = total, calls = calls },
        multi = {
            fixedOne = fixedOneFromMulti(value122),
            fixedTwo = table.pack(value122),
            forwarded = table.pack(value122),
            openTable = trueOpenMultretTable(value122),
            fixedTable = fixedCallTable(value122),
            direct = { value122, value120, value121 },
        },
        constructors = {
            callValued = callValuedTable(value122),
            dynamic = dynamicRmwStress(value122),
            colors = { value122 },
            nestedCalls = { value122, rgb(255, 0, 0), rgb(0, 255, 0) },
        },
        callbacks = {
            first = value116.first(value122),
            second = value116.second(value122),
            snapshot = table.pack(value122),
        },
        strings = {
            formatted = stringStress(value122, seed),
            class = classify(value122),
            unicode = CONFIG.Strings.unicode,
        },
    }
    value122 = if seed <= 0 then false else true
    config49 = seed % 2
    local value123 = config49 == 0
    config49 = seed < 10
    local booleanShortCircuit2 = booleanShortCircuit(value122, value123, config49)
    booleans.complex = booleanShortCircuit2
    value122 = 0
    if value122 < seed then
        value122 = "positive"
        booleanShortCircuit2 = sideEffect(value122)
        if not booleanShortCircuit2 then
            value122 = "fallback"
            booleanShortCircuit2 = sideEffect(value122)
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

function module.Varargs(seed, ...)
    local count, first, last, packed = varargStats(...)
    return {
        count = count,
        first = first,
        last = last,
        packed = packed,
        forwarded = table.pack(forwardVarargs(returnsThree, seed)),
    }
end

function module.Objects(seed)
    local config7 = Counter.new(seed)
    config7:add(5)
    config7:multiply(2)
    local function callback(value133, index21)
        return value133 + index21 + config7.value
    end

    local callable = makeCallable(callback)
    return {
        counter = config7,
        last = config7:getLast(),
        callable = callable,
        callableResult = callable(seed, seed + 1),
        callableText = tostring(callable),
    }
end

function module.SafeOperations(value135, seed)
    local function callback()
        if seed < 0 then
            error("negative seed")
        end
        return makePayload(seed)
    end

    return {
        decoded = safeJsonDecode(value135),
        protected = xpcallStress(callback),
        coroutineResult = table.pack(coroutineStress(seed)),
        bufferValue = bufferStress(seed),
    }
end

function module.InstancePatterns(value136, index23)
    local part, color = instancePhiStress(value136)
    local deep = chainedFindStress(value136)
    local collection = collectionStress(value136)
    local tween = if index23 then tweenStress(index23, 0.25) else nil
    return { part = part, color = color, deep = deep, collection = collection, tween = tween }
end

function module.Connect(seed)
    return connectionStress(seed)
end

function module.NegativeCases(a, b, c)
    local result27, value142 = repeatedCallNegative(b)
    local result28, value143 = mutableSnapshotNegative(c)
    return {
        escaped = tableEscapeNegative(a, 123),
        repeated = { result27, value142 },
        mutable = { result28, value143 },
    }
end

function module.Misc(value144, index25)
    local result29, value145, value146, value147 = localAliasStress(index25)
    local result30, value148, value149 = multiAssignmentStress(value144)
    local function callback()
        local result31: boolean = false
        if #value145 > 0 then
            result31 = value146 ~= nil
        end
        return result31
    end

    return {
        identity = genericIdentity(value144),
        directReturn = directReturnCall(value144),
        shadowing = shadowingStress(value144),
        complexCondition = complexCondition(index25, result29, value147, callback),
        sorted = sortingCallbackStress(config63),
        multi = { result30, value148, value149 },
    }
end

function module.RunEverything(a, b, c)
    a = math.floor(a)
    local payload = makePayload(a)
    local mega = module.BuildMegaTable(a)
    local flow = module.ControlFlow(a, { 1, 2, 3, -1, 5, 150 })
    local objects = module.Objects(a)
    local misc = module.Misc(a, payload)
    local instances = if b then module.InstancePatterns(b, c) else nil
    sharedObject = { seed = a, payload = payload, mega = mega }
    local config67 = {
        seed = a,
        mega = mega,
        flow = flow,
        objects = objects,
        misc = misc,
        instances = instances,
    }
    config67.sharedCounter = sharedCounter
    config67.sharedFlag = sharedFlag
    config67.sharedObject = sharedObject
    config67.localPlayer = LocalPlayer
    return config67
end

return module
