local function packet(seed)
    local state = seed
    local function read(delta)
        local previous = state
        state += delta
        return previous, state, nil
    end
    return {read = read}
end
local first, second = packet(4), packet(4)
print(debug.info(first.read, "n"), first.read == second.read)
print(first.read(3))
print(first.read(2))
print(second.read(1))

local function stable()
    local function tag() return 91 end
    return {tag = tag}
end
local a, b = stable(), stable()
local keys = {[a.tag] = "saved"}
print(debug.info(a.tag, "n"), a.tag == b.tag, keys[b.tag], a.tag())

local batch = {}
for i = 1, 3 do
    local function take() return i end
    batch[i] = {take = take}
end
print(batch[1].take(), batch[2].take(), batch[3].take(), batch[1].take == batch[2].take)
