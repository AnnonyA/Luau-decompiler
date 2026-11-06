local function seek(xs, value)
 for i = 1, #xs do
  if xs[i] == value then return i end
 end
 return -1
end
local xs = {3,7,0,9}
local first = ...
local target = tonumber(first) or 7
local found = seek(xs,target)
print("found",found)
local empty = seek({},target)
print("empty",empty)
