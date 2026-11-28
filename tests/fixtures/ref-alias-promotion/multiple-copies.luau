-- Project-authored: MOVE copies made before REF capture keep their old values.
local function copies(initial, replacement)
    local cell = initial
    local first = cell
    local second = cell
    local third = second
    local reader = function() return cell end
    local function replace()
        cell = replacement
        return cell
    end
    replace()
    print("copies", first == initial, second == initial, third == initial,
        reader() == replacement, first == second, second == third)
    return first, nil, second, third, reader()
end

local function observe(...)
    local count = select("#", ...)
    local first, hole, second, third, current = ...
    print("pack", count, hole == nil, first == second, second == third, first == current)
end

observe(copies(4, 7))
observe(copies(nil, false))
local initial = {value = 8}
local replacement = {value = 11}
observe(copies(initial, replacement))
print("tables", initial.value, replacement.value)
local firstFunction = function() return 13 end
local secondFunction = function() return 17 end
observe(copies(firstFunction, secondFunction))
print("functions", firstFunction(), secondFunction())
