local sharedCounter: number = 0
local tag: number = 1
local record
record = function(self, index)
    sharedCounter += 1
    tag = tag * 3 + sharedCounter
    self.score = index * 7 + sharedCounter
    if index < 0 then
        self.tag = -1
        return
    else
        self.tag = tag
    end
end
local first = ...
local _ = tonumber
local value2 = tonumber(first) or 4
local config = {}
for i = -2, value2 do
    record(config, i)
    local value3: string = "record"
    local score = config.score
    local tag2 = config.tag
    print(value3, i, sharedCounter, tag, score, tag2)
end
local observe
observe = function()
    return sharedCounter, tag
end
print("final", observe())
