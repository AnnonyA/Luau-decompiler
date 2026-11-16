local Lighting = game:GetService('Lighting')
local function f(a, b)
	local saved = Lighting:GetChildren()
	for _, v in saved do
		v.Parent = nil
	end
	local attrs = {}
	for k in b:GetAttributes() do
		attrs[k] = Lighting[k]
	end
	for _, v in b:Clone():GetChildren() do
		v.Parent = Lighting
	end
	for k, v in b:GetAttributes() do
		Lighting[k] = v
	end
	return saved, attrs
end
return f