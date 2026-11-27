-- [[ annonya.github.io ]] v0.2.0 | decompiled at 2026-11-27T19:50:12Z
-- Luau bytecode version: 14 | Luau type version: 3

local sharedCounter: number = 0

local function field(p)
    sharedCounter += 1
    return p, nil, "extra", nil
end

local function observe(...)
    print("values", select("#", ...), ...)
end

local list = { field }

local function selected(p: boolean | number | string)
    return (if true then list[1] else nil)(p), (if true then list[1] else nil)(p), nil
end;

(if true then observe else nil)((if true then selected else nil)(false));
(if true then observe else nil)((if true then selected else nil)(0));
(if true then observe else nil)((if true then selected else nil)("text"));
(if true then observe else nil)((if true then list[1] else nil)("open"))
print("captured calls", sharedCounter)

local function field2()
    sharedCounter += 1
    return -sharedCounter, "discarded"
end

local print2 = print
local list2 = { field2 }
print2("fastcall", math.abs((if true then list2[1] else nil)()), sharedCounter)
