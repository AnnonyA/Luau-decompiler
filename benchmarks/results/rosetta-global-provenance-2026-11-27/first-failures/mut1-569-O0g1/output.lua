-- [[ annonya.github.io ]] v0.2.0 | decompiled at 2026-11-27T18:52:39Z
-- Luau bytecode version: 14 | Luau type version: 3

local function get()
    return { [2] = { ["seen"] = true } }
end

local tbl = {}
tbl["get"] = get

local function seen(p)
    local value = (if true then tbl.get else nil)()[p]
    local flag: boolean = false
    if value ~= nil then
        flag = value.seen ~= nil
    end
    return flag
end

local function pick(items)
    local function __m737573()
        local _ = (function()
end)()
    end;

    (if true then __m737573 else nil)()
    for key, value in items do
        if value.show and not (if true then seen else nil)(value.id) then
            break
        end
    end
    if index == nil then
        return false
    end
    local success, result = pcall(function()
        return items[index].id * 100
    end)
    return success, result
end

print((if true then pick else nil)({
    { ["show"] = false, ["id"] = 1 },
    { ["show"] = true, ["id"] = 2 },
    { ["show"] = true, ["id"] = 3 },
    { ["show"] = true, ["id"] = 4 },
}))
local print2 = print
local data = { ["show"] = true }
data["id"] = 2
print2((if true then pick else nil)({ data }))

local function nextShown(list, p: number)
    local i = nil
    for i2 = p + 1, #list do
        if not list[i2].toShow then
            continue
        end
        i = i2
        break
    end
    return if i ~= nil then "show " + i .. " " .. list[i].id else "none"
end

local print3 = print

local list = {
    { ["toShow"] = true, ["id"] = "a" },
    { ["toShow"] = false, ["id"] = "b" },
    { ["toShow"] = true, ["id"] = "c" },
}

print3((if true then nextShown else nil)(list, 0), (if true then nextShown else nil)(list, 1), (if true then nextShown else nil)(list, 3))

local function findKey(items, p: string)
    local result = nil
    for key, value in items do
        if value ~= p then
            continue
        end
        result = key
        break
    end
    return if result ~= nil then "found " .. result else "none"
end

print((if true then findKey else nil)({ "x", "y", "z" }, "y"), (if true then findKey else nil)({ "x" }, "q"))

local function conv(items)
    local list = {}
    for _, value in items do
        if typeof(value) ~= "number" then
            local result: number? = tonumber(value)
            if not result then
                result = -1
                value = result
            else
                value = result
            end
        end;
        (if true then table.insert else nil)(list, value * 2)
    end
    return (if true then table.concat else nil)(list, ",")
end

local function conv2(limit: number)
    local list = {}
    local i
    for i2 = 1, limit do
        i = i2
        if i % 2 == 0 then
            i *= 100
        end;
        (if true then table.insert else nil)(list, i)
    end
    return (if true then table.concat else nil)(list, ",")
end

print((if true then conv else nil)({ 1, "2", "x", 4 }), (if true then conv2 else nil)(4))

local function m(items, p)
    local map = {}
    for _, value in items do
        if value.name then
            local name = value.name
            if p then
                if p.skip then
                    if p.skip[name .. "*"] then
                        map[name] = "skip*"
                    elseif p then
                        if p.skip then
                            if p.skip[name] then
                                map[name] = "skip"
                            else
                                local kind = value.kind
                                if kind == 1 then
                                    map[name] = "one"
                                elseif kind == 2 then
                                    map[name] = "two"
                                else
                                    if kind == 3 then
                                        map[name] = "three"
                                    end
                                end
                            end
                        else
                            local kind2 = value.kind
                            if kind2 == 1 then
                                map[name] = "one"
                            elseif kind2 == 2 then
                                map[name] = "two"
                            else
                                if kind2 == 3 then
                                    map[name] = "three"
                                end
                            end
                        end
                    else
                        local kind3 = value.kind
                        if kind3 == 1 then
                            map[name] = "one"
                        elseif kind3 == 2 then
                            map[name] = "two"
                        else
                            if kind3 == 3 then
                                map[name] = "three"
                            end
                        end
                    end
                elseif p then
                    if p.skip then
                        if p.skip[name] then
                            map[name] = "skip"
                        else
                            local kind4 = value.kind
                            if kind4 == 1 then
                                map[name] = "one"
                            elseif kind4 == 2 then
                                map[name] = "two"
                            else
                                if kind4 == 3 then
                                    map[name] = "three"
                                end
                            end
                        end
                    else
                        local kind5 = value.kind
                        if kind5 == 1 then
                            map[name] = "one"
                        elseif kind5 == 2 then
                            map[name] = "two"
                        else
                            if kind5 == 3 then
                                map[name] = "three"
                            end
                        end
                    end
                else
                    local kind6 = value.kind
                    if kind6 == 1 then
                        map[name] = "one"
                    elseif kind6 == 2 then
                        map[name] = "two"
                    else
                        if kind6 == 3 then
                            map[name] = "three"
                        end
                    end
                end
            elseif p then
                if p.skip then
                    if p.skip[name] then
                        map[name] = "skip"
                    else
                        local kind7 = value.kind
                        if kind7 == 1 then
                            map[name] = "one"
                        elseif kind7 == 2 then
                            map[name] = "two"
                        else
                            if kind7 == 3 then
                                map[name] = "three"
                            end
                        end
                    end
                else
                    local kind8 = value.kind
                    if kind8 == 1 then
                        map[name] = "one"
                    elseif kind8 == 2 then
                        map[name] = "two"
                    else
                        if kind8 == 3 then
                            map[name] = "three"
                        end
                    end
                end
            else
                local kind9 = value.kind
                if kind9 == 1 then
                    map[name] = "one"
                elseif kind9 == 2 then
                    map[name] = "two"
                else
                    if kind9 == 3 then
                        map[name] = "three"
                    end
                end
            end
        else
            if value.kind ~= 9 then
                map.schema = "s"
            end
        end
    end
    local list = {}
    for key, value2 in map do
        (if true then table.insert else nil)(list, key .. "=" .. value2)
    end;
    (if true then table.sort else nil)(list)
    return (if true then table.concat else nil)(list, ",")
end

local print4 = print

local list2 = {
    { ["name"] = "a", ["kind"] = 1 },
    { ["name"] = "b", ["kind"] = 2 },
    { ["name"] = "c", ["kind"] = 3 },
    { ["name"] = "d", ["kind"] = 4 },
    { ["kind"] = 9 },
    { ["name"] = "e", ["kind"] = 1 },
    { ["name"] = "f", ["kind"] = 1 },
}

print4((if true then m else nil)(list2, nil))
print((if true then m else nil)(list2, { ["skip"] = { ["a*"] = true, ["b"] = true } }))
print((if true then m else nil)(list2, {}))
