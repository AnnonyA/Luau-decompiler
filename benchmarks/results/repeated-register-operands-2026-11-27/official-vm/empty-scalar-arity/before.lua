-- [[ annonya.github.io ]] v0.2.0 | decompiled at 2026-11-27T19:50:12Z
-- Luau bytecode version: 14 | Luau type version: 3

local sharedCounter: number = 0

local function field()
    sharedCounter += 1
end

local function observe(...)
    print("arity", select("#", ...), ...)
end

local list = { field };
(if true then observe else nil)(((if true then list[1] else nil)()));
(if true then observe else nil)(((if true then list[1] else nil)()));
(if true then observe else nil)((if true then list[1] else nil)())
print("calls", sharedCounter)
