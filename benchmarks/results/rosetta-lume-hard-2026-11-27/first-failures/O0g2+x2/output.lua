-- [[ annonya.github.io ]] v0.2.0 | decompiled at 2026-11-27T19:23:20Z
-- Luau bytecode version: 14 | Luau type version: 3

local pairs2 = pairs
local ipairs2 = ipairs
local type2 = type
local assert2 = assert
local unpack2 = unpack
local module = { ["_version"] = "2.3.0" }
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
    return metatable and metatable.__call ~= nil
end

local function function_6(p)
    if not (if true then module.isarray else nil)(p) then
        if type2(p) == "table" then
            return pairs2
        end
        error("expected table", 3)
        return
    end
    return ipairs2
end

local function function_7(p)
    if p == nil then
        return function_2
    elseif (if true then function_5 else nil)(p) then
        return p
    elseif type2(p) == "table" then
        return function(list)
            for key, value in pairs2(p) do
                if list[key] ~= value then
                    return false
                end
            end
            return true
        end
    end
    return function(p2)
        return p2[p]
    end
end

function module.clamp(a, b, c)
    local result
    if a < b then
        result = b
        if result then
        else
            result = c < a and c or a
        end
    else
        result = c < a and c or a
    end
    return result
end

function module.round(p, p2)
    return if p2 then (if true then module.round else nil)(p / p2) * p2 else p >= 0 and floor(p + 0.5) or ceil(p - 0.5)
end

function module.sign(p)
    return if p < 0 then -1 else 1
end

function module.lerp(a, b, c)
    return a + (b - a) * (if true then module.clamp else nil)(c, 0, 1)
end

function module.smooth(a, b, c)
    local clamped = (if true then module.clamp else nil)(c, 0, 1)
    local value = clamped * clamped * (3 - 2 * clamped)
    local value2 = b - a
    return a + value2 * value
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
    return (if true then math.cos else nil)(p) * p2, (if true then math.sin else nil)(p) * p2
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
    return self[(if true then math.random else nil)(#self)]
end

function module.weightedchoice(p)
    local total: number = 0
    for _, value in pairs2(p) do
        assert2(value >= 0, "weight value less than zero")
        total += value
    end
    assert2(total ~= 0, "all weights are zero")
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
            break
        end;
        (if true then table.remove else nil)(self, key)
        break
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
        local value = (if true then math.random else nil)(i)
        if value ~= i then
            list[i] = list[value]
        end
        list[value] = self[i]
    end
    return list
end

function module.sort(p, p2)
    local clone = (if true then module.clone else nil)(p)
    if not p2 then
        (if true then table.sort else nil)(clone)
    elseif type2(p2) == "string" then
        (if true then table.sort else nil)(clone, function(p, p3)
            return p[p2] < p3[p2]
        end)
    else
        (if true then table.sort else nil)(clone, p2)
    end
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
    else
        for _2, value2 in callback3(p) do
            callback2(value2, ...)
        end
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
    else
        for _, value2 in callback3(a) do
            if callback2(value2) then
                list[#list + 1] = value2
            end
        end
    end
    return list
end

function module.reject(a, b, c)
    local callback2 = (if true then function_7 else nil)(b)
    local callback3 = (if true then function_6 else nil)(a)
    local list = {}
    if c then
        for key, value in callback3(a) do
            if callback2(value) then
                continue
            end
            list[key] = value
        end
    else
        for _, value2 in callback3(a) do
            if callback2(value2) then
                continue
            end
            list[#list + 1] = value2
        end
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
    for _, _2 in callback3(p) do
        if callback2(_2) then
            return _2, _2
        end
    end
    return nil
end

function module.count(list, p)
    local calls: number = 0
    local callback2 = (if true then function_6 else nil)(list)
    if p then
        local callback3 = (if true then function_7 else nil)(p)
        for _, value in callback2(list) do
            if callback3(value) then
                calls += 1
            end
        end
        return calls
    elseif not (if true then module.isarray else nil)(list) then
        for _2 in callback2(list) do
            calls += 1
        end
        return calls
    end
    return #list
end

function module:slice(p, p2)
    local count = p and (if true then function_4 else nil)(#self, p) or 1
    local snapshot = count
    if p2 then
        count = (if true then function_4 else nil)(#self, p2)
        if count then
        else
            count = #self
        end
    else
        count = #self
    end
    local list = {}
    local snapshot2 = if snapshot < 1 then 1 else snapshot
    local count2
    if #self < count then
        count2 = #self
        if count2 then
        else
            count2 = count
        end
    else
        count2 = count
    end
    for i = snapshot2, count2 do
        list[#list + 1] = self[i]
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
            local result3 = select(i, ...) or tbl
            result2 = result[result3] or {}
            result[result3] = result2
            result = result[result3]
        end
        local result4 = result[tbl2]
        if result4 then
        else
            result4 = { callback2(...) }
        end
        result[tbl2] = result4
        return unpack4(result[tbl2])
    end
end

function module.combine(...)
    local count = select("#", ...)
    if count == 0 then
        return function_
    elseif count == 1 then
        local count2 = select(1, ...)
        if count2 then
            assert2((if true then function_5 else nil)(count2), "expected a function or nil")
            return count2
        end
        return function_
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
    local now = (if true then os.clock else nil)()
    local list = { callback2(...) }
    return (if true then os.clock else nil)() - now, unpack5(list)
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

local function function_14(p)
    return (if true then string.format else nil)("%q", p)
end

local data = { ["boolean"] = tostring2, ["nil"] = tostring2 }
data["string"] = function_14
data["number"] = function(p)
    if p ~= p then
        return "0/0"
    end
    if p == 1 / 0 then
        return "1/0"
    end
    if p == -1 / 0 then
        return "-1/0"
    end
    return tostring2(p)
end

data["table"] = function(p, p2)
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

local setmetatable2 = setmetatable

local function __index(p, p2)
    error("unsupported serialize type: " .. p2)
end

local tbl3 = {}
tbl3["__index"] = __index
setmetatable2(data, tbl3)

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
    local callback2 = p or 72
    local result
    result = callback2
    callback2 = if type2(result) == "number" then function(list)
        return result <= #list
    end else result
    local result2: string = ""
    local list = {}
    for key, text in self:gmatch("(%S+)(%s*)") do
        local value = result2 .. key
        if callback2(value) then
            (if true then table.insert else nil)(list, result2 .. "\n")
            result2 = key
        else
            result2 = value
        end
        for key2 in text:gmatch(".") do
            if key2 == "\n" then
                (if true then table.insert else nil)(list, result2 .. "\n")
                result2 = ""
                continue
            end
            result2 ..= key2
        end
    end;
    (if true then table.insert else nil)(list, result2)
    return (if true then table.concat else nil)(list)
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
    return assert2((loadstring or load)(p))()
end

function module.uuid()
    return (("xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx"):gsub("[xy]", function(p)
        local value = (if true then math.random else nil)(16) - 1
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
    local result2
    if success then
        result2 = result
        if result2 then
        else
            result2 = nil
        end
    else
        result2 = nil
    end
    local result3
    result3 = result2
    xpcall(function()
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
    end, onerror)
    package.loaded[moduleScript] = result3
    if not trimmed then
        return result3
    end
    return nil, trimmed
end

local function function_19(p, p2)
    local value = p2 - 1
    local value2 = p[value]
    if value2 ~= nil then
        return value, value2
    end
end

function module.ripairs(list)
    return function_19, list, #list + 1
end

function module:color(p)
    local result = p or 1
    local result2 = nil
    local match, value, value2 = self:match("#(%x%x)(%x%x)(%x%x)")
    local match2 = match
    local result3 = value
    local result4 = value2
    if not match2 then
        if self:match("rgba?%s*%([%d%s%.,]+%)") then
            local gmatch = self:gmatch("[%d.]+")
            local result5 = gmatch()
            if result5 then
            else
                result5 = 0
            end
            match2 = result5 / 255
            result3 = (gmatch() or 0) / 255
            local result6 = gmatch()
            if result6 then
            else
                result6 = 0
            end
            result4 = result6 / 255
            result2 = gmatch() or 1
        else
            error(("bad color string '%s'"):format(self))
        end
    else
        match2 = tonumber2(match2, 16) / 255
        result3 = tonumber2(result3, 16) / 255
        result4 = tonumber2(result4, 16) / 255
        result2 = 1
    end
    return match2 * result, result3 * result, result4 * result, result2 * result
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
    return setmetatable({ ["_value"] = p }, data2)
end

local setmetatable3 = setmetatable

local function __call(p, ...)
    return (if true then module.chain else nil)(...)
end

setmetatable3(module, { ["__call"] = __call })
return module
