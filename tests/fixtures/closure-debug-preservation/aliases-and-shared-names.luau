-- Project-authored controls for prototype names and shared native closures.
tag = "global-tag"
local function original(value)
    return value + 4, nil, value + 5
end
local alias = {renamed = original}
print("alias", debug.info(alias.renamed, "n"), alias.renamed(7))

local function compact()
    return {tag = function() return tag end}
end
local first, second = compact(), compact()
print("factory", debug.info(first.tag, "n"), first.tag == second.tag, first.tag(), second.tag())

local function separated()
    return {tag = function() return tag end}
end
local before = separated()
print("between", before.tag())
local after = separated()
local keys = {[before.tag] = "shared"}
print("dispatcher", debug.info(after.tag, "n"), before.tag == after.tag, keys[after.tag], after.tag())

local named = function() return "anonymous" end
local anonymous = {renamed = named}
print("anonymous", debug.info(anonymous.renamed, "n"), anonymous.renamed())
