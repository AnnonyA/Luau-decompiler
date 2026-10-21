local function make()
    local value = 0
    local function set(nextValue) value = nextValue end
    local function get() return value end
    return set, get
end
local set, get = make()
print(get())
set(7)
print(get())
set(-2)
print(get())
