-- Project-authored: closed captures keep distinct cells across register reuse.
local callbacks = {}
for index = 1, 3 do
    do
        local cell = index
        local first = cell
        local second = first
        local reader = function() return cell end
        local function bump()
            cell += 10
            return cell
        end
        bump()
        local afterFirstCapture = cell
        local laterReader = function() return cell end
        bump()
        callbacks[#callbacks + 1] = function()
            return first, second, afterFirstCapture, reader(), laterReader()
        end
    end
    do
        local cell = index * 100
        local saved = cell
        local function bump()
            cell += 1
            return cell
        end
        bump()
        callbacks[#callbacks + 1] = function()
            return saved, cell, bump()
        end
    end
end
for index, callback in callbacks do
    print("closed", index, callback())
    print("again", index, callback())
end
