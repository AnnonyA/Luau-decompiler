local log = {}
local function note(...)
	log[#log + 1] = table.concat({ ... }, " ")
end

local function destroy(tag)
	note("destroy", tag)
end

local function launch(target, flightTime, arcHeight, tag)
	if not (target and flightTime and arcHeight) then
		destroy(tag)
		return
	end
	note("launch", tag, target, flightTime, arcHeight)
end

local function build(tier, rise)
	local model = tier > 0 and { tier = tier } or nil
	if not model then
		note("wait", rise)
		return
	end
	local scale = model.scale or 3
	local height
	if model.tier > 2 then
		height = scale * 10
		for i = 1, model.tier do
			if i % 2 == 0 then
				note("even", i)
			end
		end
	else
		height = scale
		note("small")
	end
	note("built", height)
	return height
end

local function handle(input, processed)
	if processed then
		return
	end
	if input.kind == "mouse" then
		note("attack")
	elseif input.key == "shift" then
		note("sprint")
	elseif input.key == "e" then
		local gui = input.gui
		if gui then
			gui.enabled = not gui.enabled
			note("gui", tostring(gui.enabled))
		end
	end
end

local function scan(players, me)
	local nearest, best = nil, 50
	for _, other in ipairs(players) do
		if other == me then
			continue
		end
		local character = other.character
		if not character then
			continue
		end
		local root = character.root
		local humanoid = character.humanoid
		if root and humanoid and humanoid.health > 0 then
			local distance = math.abs(root - me.character.root)
			if distance < best then
				nearest = other
				best = distance
			end
		end
	end
	return nearest and nearest.name, best
end

local function ladder(a, b, c)
	if a then
		if b then
			if c then
				return "abc"
			else
				return "ab"
			end
		end
		return "a"
	elseif b and c then
		return "bc"
	end
	return "none"
end

local function firstFloor(root)
	local floor = root.floor
	local gui = floor and floor.gui
	local scale = gui and gui.scale
	if scale then
		scale.value = 0
	end
	return scale ~= nil, gui ~= nil
end

local function waitUntil(deadline, a, b, c)
	local clock = 0
	while clock < deadline do
		if a.length > 0 and b.length > 0 and c.loaded then
			break
		end
		clock += 1
		if clock == 2 then
			a.length = 1
			b.length = 1
		elseif clock == 4 then
			c.loaded = true
		end
	end
	return clock
end

local function stamina(start, steps)
	local sprinting = true
	local value = start
	local trace = {}
	for _ = 1, steps do
		if sprinting then
			value = math.max(0, value - 5)
			if value == 0 then
				sprinting = false
			end
		else
			value = math.min(100, value + 2)
		end
		trace[#trace + 1] = value
	end
	return table.concat(trace, ",")
end

launch("t", 2, 3, "one")
launch("t", nil, 3, "two")
launch(nil, 2, 3, "three")
launch("t", 2, nil, "four")
print(build(0, 7), build(1, 7), build(4, 7))
handle({ kind = "mouse" }, true)
handle({ kind = "mouse" }, false)
handle({ key = "shift" }, false)
handle({ key = "e", gui = { enabled = false } }, false)
handle({ key = "e" }, false)
handle({ key = "q" }, false)
local me = { name = "me", character = { root = 10, humanoid = { health = 5 } } }
print(scan({
	me,
	{ name = "nochar" },
	{ name = "dead", character = { root = 12, humanoid = { health = 0 } } },
	{ name = "far", character = { root = 90, humanoid = { health = 9 } } },
	{ name = "near", character = { root = 14, humanoid = { health = 9 } } },
	{ name = "noroot", character = { humanoid = { health = 9 } } },
}, me))
print(ladder(true, true, true), ladder(true, true, false), ladder(true, false, true), ladder(false, true, true), ladder(false, true, false))
print(firstFloor({}), firstFloor({ floor = {} }), firstFloor({ floor = { gui = { scale = {} } } }))
print(waitUntil(10, { length = 0 }, { length = 0 }, { loaded = false }), waitUntil(3, { length = 0 }, { length = 0 }, {}))
print(stamina(12, 8))
print(table.concat(log, "|"))
