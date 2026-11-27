-- rosetta mutant mut1-569 of loop_exits: flip, wrap do, wrap local function, wrap closure, flip
-- loops whose exits carry a value out, and a loop body that needs a goto to structure
do
	local Entry = {get = function() return {[2] = {seen = true}} end}
	local function seen(id)
		local e = Entry.get()[id]
		return e ~= nil and e.seen ~= nil
	end
	local function pick(tips)
local function __m737573()
local _ = (function()
		local index = nil
end)()
end
__m737573()
		for i, tip in tips do
			if tip.show and not seen(tip.id) then
				index = i
				break
			end
		end
		if index == nil then
			return false
		end
		local ok, v = pcall(function()
			return tips[index].id * 100
		end)
		return ok, v
	end
	print(pick({{show = false, id = 1}, {show = true, id = 2}, {show = true, id = 3}, {show = true, id = 4}}))
	print(pick({{show = true, id = 2}}))
end
do
	local function nextShown(tips, from)
		local index = nil
		for i = from + 1, #tips do
			if tips[i].toShow then
				index = i
				break
			end
		end
		if index ~= nil then
			return "show "  +  index .. " " .. tips[index].id
		end
		return "none"
	end
	local tips = {{toShow = true, id = "a"}, {toShow = false, id = "b"}, {toShow = true, id = "c"}}
	print(nextShown(tips, 0), nextShown(tips, 1), nextShown(tips, 3))
end
do
	local function findKey(t, want)
		local key = nil
		for k, v in t do
			if v == want then
				key = k
				break
			end
		end
		if key ~= nil then
			return "found " .. key
		end
		return "none"
	end
	print(findKey({"x", "y", "z"}, "y"), findKey({"x"}, "q"))
end
do
	local function conv(list)
		local out = {}
		for _, v in list do
			if typeof(v) ~= "number" then
				v = tonumber(v) or -1
			end
			table.insert(out, v * 2)
		end
		return table.concat(out, ",")
	end
	local function conv2(n)
		local out = {}
		for i = 1, n do
			if i % 2 == 0 then
				i = i * 100
			end
			table.insert(out, i)
		end
		return table.concat(out, ",")
	end
	print(conv({1, "2", "x", 4}), conv2(4))
end
do
	local function m(items, opts)
		local res = {}
		for _, it in items do
			if it.name then
				local n = it.name
				if opts and opts.skip and opts.skip[n .. "*"] then
					res[n] = "skip*"
				elseif opts and opts.skip and opts.skip[n] then
					res[n] = "skip"
				else
					local k = it.kind
					if k == 1 then
						res[n] = "one"
					elseif k == 2 then
						res[n] = "two"
					else
						if k ~= 3 then
							continue
						end
						res[n] = "three"
					end
				end
			else
				if it.kind  ==  9 then
					continue
				end
				res.schema = "s"
			end
		end
		local keys = {}
		for k, v in res do table.insert(keys, k .. "=" .. v) end
		table.sort(keys)
		return table.concat(keys, ",")
	end
	local items = {{name = "a", kind = 1}, {name = "b", kind = 2}, {name = "c", kind = 3}, {name = "d", kind = 4}, {kind = 9}, {name = "e", kind = 1}, {name = "f", kind = 1}}
	print(m(items, nil))
	print(m(items, {skip = {["a*"] = true, b = true}}))
do
	print(m(items, {}))
end
end
