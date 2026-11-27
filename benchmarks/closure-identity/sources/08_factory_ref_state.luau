local function factory()
    local count = 0
    return function()
        count += 1
        return count
    end
end
local call = {factory}
local a = call[1]()
local b = call[1]()
local keys = {[a] = "first"}
print(a == b, a(), a(), b(), keys[b])
