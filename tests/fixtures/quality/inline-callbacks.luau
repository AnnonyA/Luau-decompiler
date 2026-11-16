local RunService = game:GetService("RunService")
local UserInputService = game:GetService("UserInputService")

local connections = {}
local sprinting = false

local function setSprinting(enabled)
	if sprinting == enabled then
		return
	end
	sprinting = enabled
end

table.insert(connections, UserInputService.InputBegan:Connect(function(input, gameProcessed)
	if gameProcessed then
		return
	end
	setSprinting(input.KeyCode == Enum.KeyCode.LeftShift)
end))

local function track(rig, animation)
	local camPart = rig.RootPart.CamPart
	local elapsed = 0
	table.insert(connections, RunService.PreAnimation:Connect(function()
		elapsed += 1
		workspace.CurrentCamera.CFrame = camPart.CFrame * animation.Offset
	end))
	task.delay(1, function()
		print(elapsed)
	end)
end

task.spawn(function()
	while sprinting do
		task.wait(0.2)
	end
end)

return track