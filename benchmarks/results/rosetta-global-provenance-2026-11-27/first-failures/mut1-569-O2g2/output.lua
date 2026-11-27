-- [[ annonya.github.io ]] v0.2.0 | decompiled at 2026-11-27T18:52:39Z
-- Luau bytecode version: 14 | Luau type version: 3

local function seen(id)
    local e = ({ [2] = { seen = true } })[id]
    local flag: boolean = false
    if e ~= nil then
        flag = e.seen ~= nil
    end
    return flag
end

local function pick(tips)
    local function __m737573()
    end

    for key, tip in tips do
        if not tip.show then
            continue
        end
        local id = tip.id
        local e = ({ [2] = { seen = true } })[id]
        local flag: boolean = false
        if e ~= nil then
            flag = e.seen ~= nil
        end
        if flag then
            continue
        end
        local index = key
        break
    end
    if index == nil then
        return false
    end
    local function protected()
        return tips[index].id * 100
    end

    local ok, v = pcall(protected)
    return ok, v
end

print((if true then pick else nil)({
    { show = false, id = 1 },
    { show = true, id = 2 },
    { show = true, id = 3 },
    { show = true, id = 4 },
}))
print((if true then pick else nil)({ { show = true, id = 2 } }))
local tbl = {}

function tbl.get()
    return { [2] = { seen = true } }
end

local function nextShown(tips, from)
    local i2 = nil
    for index2 = from + 1, #tips do
        if not tips[index2].toShow then
            continue
        end
        i2 = index2
        break
    end
    return if i2 ~= nil then "show " + i2 .. " " .. tips[i2].id else "none"
end

local data = { toShow = false, id = "b" }
local print2 = print
local i2 = nil

local list2 = { { toShow = true, id = "a" }, data, { toShow = true, id = "c" } }

for index2 = 1, #list2 do
    if not list2[index2].toShow then
        continue
    end
    i2 = index2
    break
end
data = if i2 ~= nil then "show " + i2 .. " " .. list2[i2].id else "none"
local i3 = nil
for index3 = 2, #list2 do
    if not list2[index3].toShow then
        continue
    end
    i3 = index3
    break
end
i2 = if i3 ~= nil then "show " + i3 .. " " .. list2[i3].id else "none"
local i4 = nil
for index4 = 4, #list2 do
    if not list2[index4].toShow then
        continue
    end
    i4 = index4
    break
end
i3 = if i4 ~= nil then "show " + i4 .. " " .. list2[i4].id else "none"
print2(data, i2, i3)

local function findKey(t, want)
    local result = nil
    for key2, value in t do
        if value ~= want then
            continue
        end
        result = key2
        break
    end
    return if result ~= nil then "found " .. result else "none"
end

local print3 = print
local result = nil
for key2, value in { "x", "y", "z" } do
    if value ~= "y" then
        continue
    end
    result = key2
    break
end
local result2 = if result ~= nil then "found " .. result else "none"
local result3 = nil
for key3, value2 in { "x" } do
    if value2 ~= "q" then
        continue
    end
    result3 = key3
    break
end
print3(result2, if result3 ~= nil then "found " .. result3 else "none")

local function conv(list)
    local list2 = {}
    for _, value in list do
        if typeof(value) ~= "number" then
            value = tonumber(value) or -1
        end
        table.insert(list2, value * 2)
    end
    return table.concat(list2, ",")
end

local function conv2(n: number)
    local list2 = {}
    local i
    for index2 = 1, n do
        i = index2
        if i % 2 == 0 then
            i *= 100
        end
        table.insert(list2, i)
    end
    return table.concat(list2, ",")
end

print((if true then conv else nil)({ 1, "2", "x", 4 }), (if true then conv2 else nil)(4))

local function m(items, opts)
    local map = {}
    for _, item in items do
        if item.name then
            local n = item.name
            if opts then
                if opts.skip then
                    if opts.skip[n .. "*"] then
                        map[n] = "skip*"
                    elseif opts then
                        if opts.skip then
                            if opts.skip[n] then
                                map[n] = "skip"
                            else
                                local k = item.kind
                                if k == 1 then
                                    map[n] = "one"
                                elseif k == 2 then
                                    map[n] = "two"
                                else
                                    if k == 3 then
                                        map[n] = "three"
                                    end
                                end
                            end
                        else
                            local k2 = item.kind
                            if k2 == 1 then
                                map[n] = "one"
                            elseif k2 == 2 then
                                map[n] = "two"
                            else
                                if k2 == 3 then
                                    map[n] = "three"
                                end
                            end
                        end
                    else
                        local k3 = item.kind
                        if k3 == 1 then
                            map[n] = "one"
                        elseif k3 == 2 then
                            map[n] = "two"
                        else
                            if k3 == 3 then
                                map[n] = "three"
                            end
                        end
                    end
                elseif opts then
                    if opts.skip then
                        if opts.skip[n] then
                            map[n] = "skip"
                        else
                            local k4 = item.kind
                            if k4 == 1 then
                                map[n] = "one"
                            elseif k4 == 2 then
                                map[n] = "two"
                            else
                                if k4 == 3 then
                                    map[n] = "three"
                                end
                            end
                        end
                    else
                        local k5 = item.kind
                        if k5 == 1 then
                            map[n] = "one"
                        elseif k5 == 2 then
                            map[n] = "two"
                        else
                            if k5 == 3 then
                                map[n] = "three"
                            end
                        end
                    end
                else
                    local k6 = item.kind
                    if k6 == 1 then
                        map[n] = "one"
                    elseif k6 == 2 then
                        map[n] = "two"
                    else
                        if k6 == 3 then
                            map[n] = "three"
                        end
                    end
                end
            elseif opts then
                if opts.skip then
                    if opts.skip[n] then
                        map[n] = "skip"
                    else
                        local k7 = item.kind
                        if k7 == 1 then
                            map[n] = "one"
                        elseif k7 == 2 then
                            map[n] = "two"
                        else
                            if k7 == 3 then
                                map[n] = "three"
                            end
                        end
                    end
                else
                    local k8 = item.kind
                    if k8 == 1 then
                        map[n] = "one"
                    elseif k8 == 2 then
                        map[n] = "two"
                    else
                        if k8 == 3 then
                            map[n] = "three"
                        end
                    end
                end
            else
                local k9 = item.kind
                if k9 == 1 then
                    map[n] = "one"
                elseif k9 == 2 then
                    map[n] = "two"
                else
                    if k9 == 3 then
                        map[n] = "three"
                    end
                end
            end
        else
            if item.kind ~= 9 then
                map.schema = "s"
            end
        end
    end
    local list2 = {}
    for key2, value in map do
        table.insert(list2, key2 .. "=" .. value)
    end
    table.sort(list2)
    return table.concat(list2, ",")
end

local print4 = print

local list3 = {
    { name = "a", kind = 1 },
    { name = "b", kind = 2 },
    { name = "c", kind = 3 },
    { name = "d", kind = 4 },
    { kind = 9 },
    { name = "e", kind = 1 },
    { name = "f", kind = 1 },
}

print4((if true then m else nil)(list3, nil))
print((if true then m else nil)(list3, { skip = { ["a*"] = true, b = true } }))
print((if true then m else nil)(list3, {}))
