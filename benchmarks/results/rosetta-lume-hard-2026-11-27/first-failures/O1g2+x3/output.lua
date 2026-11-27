-- [[ annonya.github.io ]] v0.2.0 | decompiled at 2026-11-27T19:23:20Z
-- Luau bytecode version: 14 | Luau type version: 3

local pairs2 = pairs
local ipairs2 = ipairs
local type2 = type
local assert2 = assert
local unpack2 = unpack
local module = { _version = "2.3.0" }
if unpack2 then
else
    unpack2 = table.unpack
end
local tostring2 = tostring
local tonumber2 = tonumber
local floor = math.floor
local ceil = math.ceil
local callback2 = math.atan2 or math.atan
local sqrt = math.sqrt
local abs = math.abs

local function function_()
end

local function function_2(p)
    return p
end

local function function_3(text)
    return text:gsub("[%(%)%.%%%+%-%*%?%[%]%^%$]", "%%%1")
end

local function function_4(p, p2)
    local result
    if p2 < 0 then
        local value = p + p2
        result = value + 1 or p2
    else
        result = p2
    end
    return result
end

local function function_5(p)
    if type2(p) == "function" then
        return true
    end
    local metatable = getmetatable(p)
    local metatable2 = metatable
    if not metatable2 then
    else
        metatable2 = metatable.__call ~= nil
    end
    return metatable2
end

local function function_6(p)
    if (if true then module.isarray else nil)(p) then
        return ipairs2
    end
    if type2(p) == "table" then
        return pairs2
    end
    error("expected table", 3)
end

local function function_7(p)
    if p == nil then
        return function_2
    end
    if not (if true then function_5 else nil)(p) then
        return if type2(p) == "table" then function(list)
            for _, _2 in pairs2(p) do
                if list[_2] ~= _2 then
                    return false
                end
            end
            return true
        end else function(p2)
            return p2[p]
        end
    end
    return p
end

function module.clamp(a, b, c)
    return a < b and b or c < a and c or a
end

function module.round(p, p2)
    if p2 then
        return (if true then module.round else nil)(p / p2) * p2
    end
    local result
    if p >= 0 then
        result = floor(p + 0.5)
        if result then
        else
            result = ceil(p - 0.5)
        end
    else
        result = ceil(p - 0.5)
    end
    return result
end

function module.sign(p)
    return if p < 0 then -1 else 1
end

function module.lerp(a, b, c)
    local value = b - a
    return a + value * (if true then module.clamp else nil)(c, 0, 1)
end

function module.smooth(a, b, c)
    local clamped = (if true then module.clamp else nil)(c, 0, 1)
    local value = clamped * clamped * (3 - 2 * clamped)
    return a + (b - a) * value
end

function module.pingpong(p)
    return 1 - abs(1 - p % 2)
end

function module.distance(p, p2, p3, p4, p5)
    local value = p - p3
    local value2 = p2 - p4
    local value3 = value * value
    local value4 = value3 + value2 * value2
    value3 = if p5 then value4 or sqrt(value4) else sqrt(value4)
    return value3
end

function module.angle(p, p2, p3, p4)
    return callback2(p4 - p2, p3 - p)
end

function module.vector(p, p2)
    return math.cos(p) * p2, math.sin(p) * p2
end

function module.random(p, p2)
    if not p then
        p = 0
        p2 = 1
    end
    if p2 then
    else
        p2 = 0
    end
    return p + (if true then math.random else nil)() * (p2 - p)
end

function module:randomchoice()
    return self[math.random(#self)]
end

function module.weightedchoice(p)
    local total: number = 0
    for _, value in pairs2(p) do
        assert2(value >= 0, "weight value less than zero")
        total += value
    end
    assert2(not (total == 0), "all weights are zero")
    local random = (if true then module.random else nil)(total)
    for key, value2 in pairs2(p) do
        if random < value2 then
            return key
        end
        random -= value2
    end
end

function module:isarray()
    local flag: boolean = false
    if type2(self) == "table" then
        flag = self[1] ~= nil
    end
    return flag
end

function module:push(...)
    local count = select("#", ...)
    for i = 1, count do
        self[#self + 1] = select(i, ...)
    end
    return ...
end

function module:remove(p)
    local callback2 = (if true then function_6 else nil)(self)
    for key, value in callback2(self) do
        if value ~= p then
            continue
        end
        if not (if true then module.isarray else nil)(self) then
            self[key] = nil
            return p
        end;
        (if true then table.remove else nil)(self, key)
        return p
    end
    return p
end

function module:clear()
    local callback2 = (if true then function_6 else nil)(self)
    for key in callback2(self) do
        self[key] = nil
    end
    return self
end

function module:extend(...)
    for i = 1, select("#", ...) do
        local count = select(i, ...)
        if not count then
            continue
        end
        for key, value in pairs2(count) do
            self[key] = value
        end
    end
    return self
end

function module:shuffle()
    local list = {}
    for i = 1, #self do
        local value = math.random(i)
        if value ~= i then
            list[i] = list[value]
        end
        list[value] = self[i]
    end
    return list
end

function module.sort(p, p2)
    local clone = (if true then module.clone else nil)(p)
    if p2 then
        if type2(p2) == "string" then
            table.sort(clone, function(p, p3)
                return p[p2] < p3[p2]
            end)
            return clone
        end;
        (if true then table.sort else nil)(clone, p2)
        return clone
    end
    table.sort(clone)
    return clone
end

function module.array(...)
    local first, value, value2 = ...
    local list = {}
    for _ in first, value, value2 do
        list[#list + 1] = _
    end
    return list
end

function module.each(p, callback2, ...)
    local callback3 = (if true then function_6 else nil)(p)
    if type2(callback2) == "string" then
        for _, value in callback3(p) do
            (if true then value[callback2] else nil)(value, ...)
        end
        return p
    end
    for _2, value2 in callback3(p) do
        callback2(value2, ...)
    end
    return p
end

function module.map(p, p2)
    local callback2 = (if true then function_7 else nil)(p2)
    local callback3 = (if true then function_6 else nil)(p)
    local list = {}
    for key, value in callback3(p) do
        list[key] = callback2(value)
    end
    return list
end

function module.all(p, p2)
    local callback2 = (if true then function_7 else nil)(p2)
    local callback3 = (if true then function_6 else nil)(p)
    for _, value in callback3(p) do
        if callback2(value) then
            continue
        end
        return false
    end
    return true
end

function module.any(p, p2)
    local callback2 = (if true then function_7 else nil)(p2)
    local callback3 = (if true then function_6 else nil)(p)
    for _, value in callback3(p) do
        if callback2(value) then
            return true
        end
    end
    return false
end

function module.reduce(a, callback2, c)
    local result = c ~= nil
    local result2 = c
    local callback3 = (if true then function_6 else nil)(a)
    for _, value in callback3(a) do
        if not result then
            result2 = value
            result = true
            continue
        end
        result2 = callback2(result2, value)
    end
    assert2(result, "reduce of an empty table with no first value")
    return result2
end

function module.unique(p)
    local list = {}
    for key in pairs2((if true then module.invert else nil)(p)) do
        list[#list + 1] = key
    end
    return list
end

function module.filter(a, b, c)
    local callback2 = (if true then function_7 else nil)(b)
    local callback3 = (if true then function_6 else nil)(a)
    local list = {}
    if c then
        for key, value in callback3(a) do
            if callback2(value) then
                list[key] = value
            end
        end
        return list
    end
    for _, value2 in callback3(a) do
        if callback2(value2) then
            list[#list + 1] = value2
        end
    end
    return list
end

function module.reject(a, b, c)
    local callback2 = (if true then function_7 else nil)(b)
    local callback3 = (if true then function_6 else nil)(a)
    local list = {}
    if not c then
        for _, value in callback3(a) do
            if callback2(value) then
                continue
            end
            list[#list + 1] = value
        end
        return list
    end
    for key, value2 in callback3(a) do
        if callback2(value2) then
            continue
        end
        list[key] = value2
    end
    return list
end

function module.merge(...)
    local list = {}
    for i = 1, select("#", ...) do
        local count = select(i, ...)
        local callback2 = (if true then function_6 else nil)(count)
        for key, value in callback2(count) do
            list[key] = value
        end
    end
    return list
end

function module.concat(...)
    local list = {}
    for i = 1, select("#", ...) do
        local count = select(i, ...)
        if count == nil then
            continue
        end
        local callback2 = (if true then function_6 else nil)(count)
        for _, value in callback2(count) do
            list[#list + 1] = value
        end
    end
    return list
end

function module.find(p, p2)
    local callback2 = (if true then function_6 else nil)(p)
    for key, value in callback2(p) do
        if value == p2 then
            return key
        end
    end
    return nil
end

function module.match(p, p2)
    local callback2 = (if true then function_7 else nil)(p2)
    local callback3 = (if true then function_6 else nil)(p)
    for key, value in callback3(p) do
        if callback2(value) then
            return value, key
        end
    end
    return nil
end

function module.count(list, p)
    local calls: number = 0
    local callback2 = (if true then function_6 else nil)(list)
    if not p then
        if not (if true then module.isarray else nil)(list) then
            for _ in callback2(list) do
                calls += 1
            end
            return calls
        end
        return #list
    end
    local callback3 = (if true then function_7 else nil)(p)
    for _2, value in callback2(list) do
        if callback3(value) then
            calls += 1
        end
    end
    return calls
end

function module:slice(p, p2)
    local result
    if p then
        result = (if true then function_4 else nil)(#self, p)
        if result then
        else
            result = 1
        end
    else
        result = 1
    end
    local result2 = p2 and (if true then function_4 else nil)(#self, p2) or #self
    local list = {}
    for i = if result < 1 then 1 else result, #self < result2 and #self or result2 do
        local count = #list
        list[count + 1] = self[i]
    end
    return list
end

function module:first(p)
    if not p then
        return self[1]
    end
    return (if true then module.slice else nil)(self, 1, p)
end

function module:last(p)
    if not p then
        return self[#self]
    end
    return (if true then module.slice else nil)(self, -p, -1)
end

function module.invert(p)
    local list = {}
    for key, value in pairs2(p) do
        list[value] = key
    end
    return list
end

function module:pick(...)
    local map = {}
    for i = 1, select("#", ...) do
        local count = select(i, ...)
        map[count] = self[count]
    end
    return map
end

function module.keys(p)
    local callback2 = (if true then function_6 else nil)(p)
    local list = {}
    for key in callback2(p) do
        list[#list + 1] = key
    end
    return list
end

function module.clone(p)
    local list = {}
    for key, value in pairs2(p) do
        list[key] = value
    end
    return list
end

local unpack3 = unpack2

function module.fn(callback2, ...)
    assert2((if true then function_5 else nil)(callback2), "expected a function as the first argument")
    local list = { ... }
    return function(...)
        local joined = (if true then module.concat else nil)(list, { ... })
        return callback2(unpack3(joined))
    end
end

function module.once(p, ...)
    local flag: boolean = false
    local function_11
    do
        local captured
        captured = (if true then module.fn else nil)(p, ...)
        function_11 = function(...)
            if flag then
                return
            end
            flag = true
            return captured(...)
        end

    end
    return function_11
end

local tbl = {}
local tbl2 = {}
local unpack4 = unpack2

function module.memoize(callback2)
    local tbl3 = {}
    return function(...)
        local result = tbl3
        local result2
        for i = 1, select("#", ...) do
            local result3 = select(i, ...)
            if result3 then
            else
                result3 = tbl
            end
            result2 = result[result3]
            if result2 then
            else
                result2 = {}
            end
            result[result3] = result2
            result = result[result3]
        end
        result[tbl2] = result[tbl2] or { callback2(...) }
        return unpack4(result[tbl2])
    end
end

function module.combine(...)
    local count = select("#", ...)
    if count == 0 then
        return function_
    elseif count == 1 then
        local count2 = select(1, ...)
        if not count2 then
            return function_
        end
        assert2((if true then function_5 else nil)(count2), "expected a function or nil")
        return count2
    end
    local list = {}
    for i = 1, count do
        local count3 = select(i, ...)
        if count3 == nil then
            continue
        end
        assert2((if true then function_5 else nil)(count3), "expected a function or nil")
        list[#list + 1] = count3
    end
    return function(...)
        for _, callback2 in ipairs2(list) do
            callback2(...)
        end
    end
end

function module.call(callback2, ...)
    if callback2 then
        return callback2(...)
    end
end

local unpack5 = unpack2

function module.time(callback2, ...)
    local now = os.clock()
    local list = { callback2(...) }
    return os.clock() - now, unpack5(list)
end

local map = {}

function module:lambda()
    if not map[self] then
        local match, value = self:match("^([%w,_ ]-)%->(.-)$")
        assert2(match and value, "bad string lambda")
        local value2 = "return function(" .. match .. ")\nreturn " .. value .. "\nend"
        map[self] = (if true then module.dostring else nil)(value2)
    end
    return map[self]
end

local callback = nil

local function table2(p, p2)
    local result = p2
    if result then
    else
        result = {}
    end
    if not result[p] then
    else
        error("circular reference")
    end
    result[p] = true
    local list = {}
    for key, value in pairs2(p) do
        list[#list + 1] = "[" .. callback(key, result) .. "]=" .. callback(value, result)
    end
    result[p] = nil
    return "{" .. (if true then table.concat else nil)(list, ",") .. "}"
end

local data = { boolean = tostring2, ["nil"] = tostring2 }

function data.string(p)
    return string.format("%q", p)
end

function data.number(p)
    if p ~= p then
        return "0/0"
    end
    if p == (1/0) then
        return "1/0"
    end
    if p == (-1/0) then
        return "-1/0"
    end
    return tostring2(p)
end

data.table = table2
setmetatable(data, {
    __index = function(p, p2)
    error("unsupported serialize type: " .. p2)
end,
})

callback = function(p, p2)
    return (if true then data[type2(p)] else nil)(p, p2)
end

function module.serialize(p)
    return callback(p)
end

function module.deserialize(p)
    return (if true then module.dostring else nil)("return " .. p)
end

function module:split(p)
    if not p then
        return (if true then module.array else nil)(self:gmatch("([%S]+)"))
    end
    assert2(p ~= "", "empty separator")
    local value = (if true then function_3 else nil)(p)
    return (if true then module.array else nil)((self .. p):gmatch("(.-)(" .. value .. ")"))
end

function module:trim(p)
    if not p then
        return self:match("^[%s]*(.-)[%s]*$")
    end
    local value = (if true then function_3 else nil)(p)
    return self:match("^[" .. value .. "]*(.-)[" .. value .. "]*$")
end

function module:wordwrap(p)
    local value
    value = p or 72
    local callback2 = if type2(value) == "number" then function(list)
        return value <= #list
    end else value
    local result: string = ""
    local list = {}
    for key, text in self:gmatch("(%S+)(%s*)") do
        local value2 = result .. key
        if callback2(value2) then
            table.insert(list, result .. "\n")
            result = key
        else
            result = value2
        end
        for key2 in text:gmatch(".") do
            if key2 == "\n" then
                table.insert(list, result .. "\n")
                result = ""
                continue
            end
            result ..= key2
        end
    end
    table.insert(list, result)
    local _ = 35 * 35
    return table.concat(list)
end

function module:format(p)
    return if not p then self else (self:gsub("{(.-)}", function(p2)
        return tostring2(p[p2] or p[tonumber2(p2)] or "{" .. p2 .. "}")
    end))
end

function module.trace(...)
    local value = (if true then debug.getinfo else nil)(2, "Sl")
    local list = { value.short_src .. ":" .. value.currentline .. ":" }
    local result
    for i = 1, select("#", ...) do
        result = select(i, ...)
        if type2(result) == "number" then
            result = (if true then string.format else nil)("%g", (if true then module.round else nil)(result, 0.01))
        end
        list[#list + 1] = tostring2(result)
    end
    print((if true then table.concat else nil)(list, " "))
end

function module.dostring(p)
    local callback2 = loadstring
    if callback2 then
    else
        callback2 = load
    end
    return assert2(callback2(p))()
end

function module.uuid()
    return (("xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx"):gsub("[xy]", function(p)
        local value = math.random(16) - 1
        local result = if p == "x" then value + 1 or value % 4 + 9 else value % 4 + 9
        return ("0123456789abcdef"):sub(result, result)
    end))
end

function module.hotswap(moduleScript)
    local clone = (if true then module.clone else nil)(_G)
    local map = {}
    local function update(list, p)
        if map[list] then
            return
        end
        map[list] = true
        local metatable = getmetatable(list)
        local metatable2 = getmetatable(p)
        if metatable and metatable2 then
            update(metatable, metatable2)
        end
        for key, value in pairs2(p) do
            if type2(value) == "table" then
                update(list[key], value)
                continue
            end
            list[key] = value
        end
    end

    local trimmed = nil
    local function onerror(p)
        for key in pairs2(_G) do
            _G[key] = clone[key]
        end
        trimmed = (if true then module.trim else nil)(p)
    end

    local success, result = pcall(require, moduleScript)
    local result2 = if not success then nil else result or nil
    local result3
    result3 = result2
    local function function_16()
        package.loaded[moduleScript] = nil
        local value = require(moduleScript)
        if type2(result3) == "table" then
            (if true then update else nil)(result3, value)
        end
        for key, value2 in pairs2(clone) do
            if value2 == _G[key] then
                continue
            end
            if type2(value2) ~= "table" then
                continue
            end;
            (if true then update else nil)(value2, _G[key])
            _G[key] = value2
        end
    end

    xpcall(function_16, onerror)
    package.loaded[moduleScript] = result3
    if not trimmed then
        return result3
    end
    return nil, trimmed
end

local function function_17(p, p2)
    local value = p2 - 1
    local value2 = p[value]
    if value2 ~= nil then
        return value, value2
    end
end

function module.ripairs(list)
    local count = #list
    return function_17, list, count + 1
end

function module:color(p)
    local value = p or 1
    local result = nil
    local match, value2, value3 = self:match("#(%x%x)(%x%x)(%x%x)")
    local match2 = match
    local result2 = value2
    local result3 = value3
    if not match2 then
        if self:match("rgba?%s*%([%d%s%.,]+%)") then
            local gmatch = self:gmatch("[%d.]+")
            match2 = (gmatch() or 0) / 255
            result2 = (gmatch() or 0) / 255
            result3 = (gmatch() or 0) / 255
            result = gmatch() or 1
        else
            error(("bad color string '%s'"):format(self))
        end
    else
        match2 = tonumber2(match2, 16) / 255
        result2 = tonumber2(result2, 16) / 255
        result3 = tonumber2(result3, 16) / 255
        result = 1
    end
    return match2 * value, result2 * value, result3 * value, result * value
end

local data2 = {
    __index = ((if true then module.map else nil)((if true then module.filter else nil)(module, function_5, true), function(callback2)
    return function(p, ...)
        p._value = callback2(p._value, ...)
        return p
    end
end)),
}

function data2.__index:result()
    return self._value
end

function module.chain(p)
    local data = { _value = p }
    return setmetatable(data, data2)
end

setmetatable(module, {
    __call = function(p, ...)
    return (if true then module.chain else nil)(...)
end,
})
return module
