local function event(...)
    local values = table.pack(...)
    local function register(_, callback)
        callback(table.unpack(values, 1, values.n))
    end
    return { Connect = register, Once = register, ConnectParallel = register }
end

local player = { DisplayName = "River", CharacterAdded = event({ Name = "RiverRig" }) }
local services = {
    UserInputService = { InputBegan = event({ Position = "3,4,5", KeyCode = "Q" }, false) },
    RunService = { Heartbeat = event(0.125) },
    SoundService = { ChildAdded = event({ IsA = function(_, class) return class == "Sound" end }) },
    Players = { PlayerAdded = event(player) },
}
local game = { GetService = function(_, name) return assert(services[name]) end }
local instances = {
    Part = { Touched = event({ Name = "Floor" }) },
    RemoteEvent = { OnServerEvent = event(player, 73) },
}
local Instance = { new = function(class) return assert(instances[class]) end }
local customSignals = { InputBegan = event("custom", 19) }
local customGame = { GetService = function() return { Heartbeat = event("custom heartbeat") } end }
local customInstance = { new = function() return { Touched = event("custom touch") } end }
