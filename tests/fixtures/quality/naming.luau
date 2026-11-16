local Players = game:GetService("Players")
local SoundService = game:GetService("SoundService")
local TweenService = game:GetService("TweenService")

local function createLoopedSound(name, id, volume)
	local sound = Instance.new("Sound")
	sound.Name = name
	sound.SoundId = id
	sound.Volume = volume
	sound.Parent = SoundService
	return sound
end

local function fadeOut(sound, info)
	local tween = TweenService:Create(sound, info, { Volume = 0 })
	tween.Completed:Once(function()
		sound:Destroy()
	end)
	tween:Play()
end

local function describe(part)
	local folder = workspace:WaitForChild("Props")
	local frame = Instance.new("Frame")
	frame.Name = part.Name
	frame.Parent = folder
	local ok, err = pcall(function()
		part:SetAttribute("Seen", true)
	end)
	local total = 0
	for _, player in Players:GetPlayers() do
		total += #player.Name
	end
	return ok, err, total, frame
end

local function apply(callback, items, text)
	local count = #items
	for index = 1, count do
		callback(items[index], text:upper())
	end
end

local function measure(first, second)
	local distance = first - second
	local doubled = distance * 2
	return doubled, distance
end

return { createLoopedSound = createLoopedSound, fadeOut = fadeOut, describe = describe, apply = apply, measure = measure }