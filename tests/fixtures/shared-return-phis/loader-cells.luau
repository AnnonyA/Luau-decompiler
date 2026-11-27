-- Project-authored: partial terminal guards followed by a fully assigned phi.
local trace = {}
local function load(stub)
    local previous = {kind = "previous"}
    local library = previous
    local oldAlias = library
    local observe = function() return library end
    if stub then
        local existing, version = stub:find()
        if existing and version and version >= 3 then
            return existing, observe, oldAlias, nil, "cached"
        end
        library = stub:create()
    else
        library = {kind = "standalone"}
    end
    library.ready = true
    library.read = function() return library end
    return library, observe, oldAlias, nil, "new"
end
local function stub(kind, version, present)
    local cached = {kind = kind}
    return {
        find = function()
            trace[#trace + 1] = "find:" .. kind
            return if present then cached else nil, version
        end,
        create = function()
            trace[#trace + 1] = "create:" .. kind
            return {kind = "created:" .. kind}
        end,
    }
end
local function inspect(name, ...)
    local library, observe, old, gap, mode = ...
    print(name, select("#", ...), library.kind, library.ready, mode, gap,
        old.kind, observe() == library, observe() == old,
        library.read and library:read() == library)
end
inspect("missing", load(nil))
inspect("false", load(false))
inspect("empty", load(stub("empty", nil, false)))
inspect("unversioned", load(stub("unversioned", nil, true)))
inspect("old", load(stub("old", 2, true)))
inspect("current", load(stub("current", 3, true)))
inspect("future", load(stub("future", 4, true)))
print(table.concat(trace, ","))

-- A surviving arm may retain the old value; the new bounded proof excludes it.
local function partial(first, second)
    local cell = {n = 1}
    local read = function() return cell end
    if first and second then return "early", nil end
    if first then cell = {n = 2} end
    return read().n, cell.n
end
print("partial", partial(false, false), partial(true, false), partial(true, true))

-- An inner scope closes a captured cell before a surviving continuation.
local function closeBeforeJoin(first, second)
    local saved
    do
        local value = {n = 8}
        saved = function() return value end
        if first and second then return saved, nil end
    end
    local value = {n = 9}
    return saved, value
end
for _, first in {false, true} do
    for _, second in {false, true} do
        local saved, after = closeBeforeJoin(first, second)
        print("closed", saved().n, after and after.n, after == saved())
    end
end
