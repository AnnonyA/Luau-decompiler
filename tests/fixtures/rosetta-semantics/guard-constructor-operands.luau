local function values(...) return ... end
local before = {13, 17.25, (values(5, 6))}
local open = {math.max(17.25, 0.75), values(5, 6)}
local first = {math.ceil(-3), {4, "child"}, math.clamp(7, -4, 4), 1, [""] = "marker"}
local second = {("prefix"):sub(1, 2), math.clamp(19, -4, 4), {-2, "tail"}, [1] = math.max(17, 9), (values(5, 6))}
local pinned1 = math.sin(1/10)
local pinned2 = math.sin(2/10)
local pinned3 = math.sin(3/10)
local pinned4 = math.sin(4/10)
local pinned5 = math.sin(5/10)
local pinned6 = math.sin(6/10)
local pinned7 = math.sin(7/10)
local pinned8 = math.sin(8/10)
local selected = if math.pi > 2 then 19 else 23
print(selected, pinned1, pinned2, pinned3, pinned4, pinned5, pinned6, pinned7, pinned8)
print(type(first[2]), type(second[3]), first[1], second[1], first[""], #before, #open)
print(first[2][1], first[2][2], second[3][1], second[3][2])
first[2][1] += 7
print(first[2][1], second[3][1])
