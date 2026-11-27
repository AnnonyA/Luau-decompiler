do
	local Class1 = {}
Class1.__index = Class1
function Class1.new(x) return setmetatable({x = x}, Class1) end
function Class1:get() return self.x end
function Class1:add(n) self.x += n return self end
Class1.__add = function(p, q) return Class1.new(p.x + q.x) end
Class1.__lt = function(p, q) return p.x < q.x end
Class1.__concat = function(p, q) return tostring(p) .. "&" .. tostring(q) end
Class1.__len = function() return 7 end
Class1.__unm = function(p) return -p.x end
local o1, o2 = Class1.new(3), Class1.new(-2)
out("L1", o1:get(), o1:add(2):get(), (o1 + o2):get(), o1 < o2, o1 > o2, o1 .. "s", #o1, -o1)
	local v2, v3, v4 = math.pi, (false or (type((0 / 0)) == "nil"))
	for i8 = 1, -1, -1 do
		local function f20(p10, p11, p12, ...)
			for k16, e17 in {math.clamp(p12, -4, 4)} do
				do
					continue
				end
			end
			out("L2", "\u{1F600}")
		end
		for i22 = 1, 1, -1 do
			local w24 = 0
			while w24 < 4 and (not nil or (false and "s" or 0)) do
				w24 += 1
				local t25 = {(v2 * 5e-324)}
				local v3 = (math.clamp((- t25[1]), -4, 4) ^ 0.25)
			end
		end
	end
	out("L3", v4, v3, v2)
end
do
	local s29 = "end"
	if false then
		for i31 = 3, 1 do
			if true then
				break
			end
			local a33 = (s29 or (not (0 ~= math.huge) and not nil or (0 / 0)))
			local function f41(p35, p36)
				if (("]]" ~= string.rep("\r\t\v\f\a\b", 2)) and not (string.len(p35) >= 1_000)) then
					local s39 = "\r\t\v\f\a\b"
				else
				end
				return (2 / (if true then 100 else p36)), math.min((p36 // 1), (0.30000000000000004 - i31))
			end
		end
	else
	end
	out("L4", s29)
end
do
	local function f45(p43)
		out("L5", (`{(true or nil)}{(#("nil"))}` .. "\0nul"))
		out("L6", "\r\t\v\f\a\b", p43)
		return true
	end
	local t47 = {(2 ^ 53), 0.5, (0 / 0)}
	local r49 = {x = 3.5}
	local b51 = (((2.5e-3 // r49.x) + select("#", ...)) > (- 1e-7))
	local f73 = function(p53, p54, p55)
		out("L7", (math.max((- 1), (if false then 2 else p54)) % r49.x), ((string.rep("\x41\65", 1) .. ("%d%%" .. "end")) >= (("0x1F" .. "quote\"s") .. string.rep("]]", 3))))
		local function f71()
			for k59, e60 in next, t47 do
				if (f45('single') and b51) then
					continue
				end
				local t63 = {math.max((#("\r\t\v\f\a\b")), 0.30000000000000004)}
			end
			local v65, v66 = tonumber("-3.5"), true
			local a69
			out("L8", v65, r49.x)
			f45(tostring((p54 % 3)))
			return string.rep("é", 3)
		end
		return ((p53 + 123456789.125) * 10), 0
	end
	out("L9", b51, r49, t47)
end
do
	local r75 = 0
	repeat
		r75 += 1
		local u76 = 0x7F
		for i78 = 1, math.min(#("x y"), 4) do
			local r80 = {[1] = `end{9007199254740993}end{math.clamp(0.1, -4, 4)}`, [2] = 65536, x = 1}
			for i82 = 0, 3 do
				out("L10", i78, (0 / 0), not rawequal((0 and nil), false), i82)
				local s84 = ("[["):sub(-3, 2)
			end
			local v86, v87 = ((0x7F % -1) * (math.pi ^ 0))
			v86 -= math.ceil(math.clamp(r80[2], -4, 4))
		end
	until r75 >= 3 or ((type((0 / 0)) == "boolean") and ((0 / 0) or false) or (false or nil))
	out("L11", r75)
end
do
	local a91 = 0
	local b93 = (math.huge > math.clamp(string.len("  spaced  "), -4, 4))
	local n95 = (0x7F ^ 0)
	local function f119(p97, p98)
		local w101 = 0
		while w101 < 3 and (if (0 / 0) then not "s" else "s") do
			w101 += 1
			if not nil then
				return 1.7976931348623157e308, 0.1, (string.len("[[") < (-2.5 ^ 3))
			end
			local v102, v103 = p97
			for k106, e107 in {1e-7, (if true then 0 else 1e300)} do
				local a110 = ((if (if (0 / 0) then "s" else p97) then not p97 else (b93 and true or (0 / 0))) and (if (nil and false) then (true or v103) else true))
				local a112
				local n114 = ((#([[long
string]] .. "nil")) - (math.clamp(e107, -4, 4) + (1e-7 + math.huge)))
			end
		end
		local b117 = rawequal(9007199254740993, "s")
		out("L12", w101, true)
		return 0.30000000000000004, 2, (type(a91) == "number")
	end
	n95 -= 3.5
	for k121, e122 in {(#("10"))} do
		b93 = true
		if (k121 <= 3) then
		elseif ((not (100 ~= 0.30000000000000004) and (true and nil or a91) or 2.5e-3) and (((0 / 0) and a91) or (0 and "s"))) then
		end
	end
	out("L13", n95, b93, a91)
end
do
	local store125 = {}
local proxy126 = setmetatable({}, {
	__index = function(_, k) return tostring(k) .. "!" end,
	__newindex = function(_, k, v) rawset(store125, k, v) end,
})
proxy126.a = 0.5
proxy126[1] = "one"
out("L14", proxy126.a, proxy126.zz, rawget(proxy126, "a"), store125.a, store125[1])
local base127 = {greet = function(self) return "hi " .. self.name end, name = "base"}
base127.__index = base127
local child128 = setmetatable({name = "child"}, base127)
out("L15", child128:greet(), child128.greet == base127.greet, getmetatable(child128) == base127)
	do
		out("L16", (0.5 / tonumber("0x1F")), (1 / 0), string.len(((if false then "" else "  spaced  ") .. `v={true}{1_000}`)), "\x41\65")
	end
	local r129 = {count = string.format("%s|%g", ("--not a comment" .. -1), math.ceil(9007199254740993))}
	for k131, e132 in {} do
		local b135 = true
		out("L17", math.clamp(k131, -4, 4))
		do
			if rawequal(((if (0 / 0) then false else 0) and (nil or true)), "\u{1F600}") then
				local s137 = ("{braces}" .. "hello")
			elseif not (true and not nil or not true) then
				local r139 = {["two words"] = tostring(10), [2] = 3}
				local a141 = (0 / 0)
				local n143 = ((#(r139["two words"] .. "\r\t\v\f\a\b")) // 7)
			end
			local a145 = nil
		end
	end
	local s147 = (("%d%%" .. (math.pi % 7)) .. (1e10 / math.min(2, (0 / 0))))
	local t149 = {((- 100) % (1 * 1)), select("#", ...)}
	out("L18", ((3.5 + tonumber(" 7 ")) >= (-0)), t149)
	for i151 = 1, math.min(#(tostring(123456789.125)), 4) do
		local b153 = ((not (i151 <= (-0)) and (1.7976931348623157e308 ~= 0.5)) and not (1.7976931348623157e308 < tonumber(" 7 ")))
	end
	out("L19", t149, s147, r129)
end
do
	local n155 = (#("end"))
	n155 += (#("-3.5" .. n155))
	local function f163(p157, p158)
		if (('single' == ("\n" .. "0x1F")) or ((true or false) or not (4294967296 ~= 1e300))) then
			out("L20", (if 0 then true else nil), p158, (false and p157 or (false and (p157 or nil) or false)), ((string.format("%s|%g", "tab\there", 1e-7)):sub(1, 2) .. tostring((false or true))))
			local b161 = (math.clamp(-5, -4, 4) >= tonumber("1e3"))
		elseif ((if (true and nil or "s") then nil else "s") and nil) then
		elseif not rawequal((nil or true), p157) then
		else
		end
		return (math.sign((-1 / 0)) == (0 / 0)), math.ceil(math.min(n155, 2))
	end
	out("L21", n155)
end
do
	local function range165(n)
	local i = 0
	return function()
		i += 1
		if i <= n then return i, i * i end
		return nil
	end
end
local acc = {}
for a, b in range165(4) do table.insert(acc, a + b) end
out("L22", acc)
local rec167 = {x = 1, y = 2, ["two words"] = 3, [10] = 4}
local keys166 = {}
for k in pairs(rec167) do table.insert(keys166, tostring(k)) end
table.sort(keys166)
out("L23", table.concat(keys166, ","))
local down = {}
for i = #acc, 1, -1 do table.insert(down, acc[i]) end
local function stateless(t, i) i += 1 if t[i] then return i, t[i] end return nil end
for i, v in stateless, down, 0 do acc[i] = v * 2 end
out("L24", down, acc)
	local s168 = string.format("%s|%g", ([[long
string]] .. ("\u{1F600}" .. "\0nul")), -2.5)
	for w170 in string.gmatch("", "%w+") do
		for i172 = 3, 1 do
			out("L25", 123456789.125, (select("#", ...) - ((1e10 // 100) ^ 2)), s168)
		end
		local a174
		local function f186(p176, p177, p178)
			local a182
			out("L26", ((0 / 0) and ((if 0 then false else nil) and (true and (0 / 0) or true))), ((p176 ~= ([==[a]]b]==] .. 65536)) or ((if true then 1_000 else p178) >= 7)))
			a174 = (rawequal(2.5e-3, false) and ((0x7F > p178) and ("s" or true) or p178) or not true)
			local s184 = (("%d%%"):sub(0, 3) .. tostring(string.len(s168)))
			return s168, ("--not a comment" .. "hello")
		end
		local f206 = function(p188, p189, p190, ...)
			local b194 = false
			local b196 = (math.round(1_000) <= ((1e10 // p190) / p190))
			local a198 = ((tostring(0x7F) >= "]]") and (if ("s" or 0) then (0 / 0) else 0) or (false and not nil))
			for k200, e201 in {tonumber("10"), (- 0)} do
				local t204 = {"nil", (if (10 > p190) then string.rep("x y", 0) else ("quote\"s" .. -1))}
			end
		end
	end
	out("L27", s168)
end
