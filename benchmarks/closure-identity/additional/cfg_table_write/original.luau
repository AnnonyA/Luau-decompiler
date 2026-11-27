local function factory() return function() end end
local function quiet(_) end
local function change(f) _G.setfenv(f, {}) end
local actions = {quiet}
local first = factory()
local flag = ...
if flag then
    actions[1] = change
end
actions[1](first)
local second = factory()
local values = {[first] = "first"}
values[second] = "second"
print(first == second, values[first], values[second])
