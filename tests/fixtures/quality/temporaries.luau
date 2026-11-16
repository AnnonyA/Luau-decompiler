local TweenService = game:GetService("TweenService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Remotes = ReplicatedStorage:WaitForChild("Remotes")
local DamageEvent = Remotes:WaitForChild("Damage")
local Config = require(ReplicatedStorage.Modules.Config)

local camera = workspace.CurrentCamera
local humanoid = script.Parent:WaitForChild("Humanoid")
local rootPart = script.Parent:WaitForChild("HumanoidRootPart")
local sprinting = false
local log = {}

local function attack(target, distance)
	if target then
		DamageEvent:FireServer(target, math.floor(Config.BaseDamage * (1 - distance / 50)))
		return true
	end
	return false
end

local function setSprinting(enabled)
	if sprinting == enabled then
		return
	end
	sprinting = enabled
	local goal = { WalkSpeed = enabled and Config.SprintSpeed or Config.WalkSpeed }
	local tween = TweenService:Create(humanoid, TweenInfo.new(0.25, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), goal)
	tween:Play()
	TweenService:Create(camera, TweenInfo.new(0.3), { FieldOfView = enabled and 80 or 70 }):Play()
end

local function step(dt)
	local velocity = rootPart.AssemblyLinearVelocity
	local speed = Vector3.new(velocity.X, 0, velocity.Z).Magnitude
	local bob = math.sin(os.clock() * 8) * math.clamp(speed / 16, 0, 1) * 0.1
	camera.CFrame = camera.CFrame * CFrame.new(0, bob, 0)
	log[#log + 1] = table.concat({ speed, dt }, " ")
end

return { attack = attack, setSprinting = setSprinting, step = step }