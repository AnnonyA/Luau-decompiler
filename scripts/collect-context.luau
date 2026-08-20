-- Collect live naming hints from a Roblox executor / loadstring session.
-- Print the JSON and pass it to the decompiler:
--   luau-decompile decompile chunk.luac --context context.json
-- Omit --context (or set runtime_context=false) to disable.

local HttpService = game:GetService("HttpService")

local function instanceName()
    local ok, current = pcall(function()
        return script
    end)
    if ok and typeof(current) == "Instance" then
        return current.Name
    end
    return nil
end

local function sanitize(name)
    if type(name) ~= "string" then
        return nil
    end
    if not string.match(name, "^[_%a][_%w]*$") then
        return nil
    end
    return name
end

local scriptName = sanitize(instanceName())
local context = {
    scriptName = scriptName,
    moduleName = scriptName,
    names = {},
}

print(HttpService:JSONEncode(context))
return context
