local counter = 0
local function tick()
    counter += 1
    return counter
end
local first = { ["code"] = tick(), ["two words"] = tick(), ["end"] = tick() }
local anonymous = { ["run"] = function(value) return value + 3 end }
local named = { run = function(value) return value + 7 end }
local key = "code"
local duplicate = { ["code"] = tick(), [key] = tick(), ["code"] = tick() }
print(first.code, first["two words"], first["end"], duplicate.code, counter)
print(anonymous.run(4), named.run(4), debug.info(anonymous.run, "n") == "", debug.info(named.run, "n") == "run")
