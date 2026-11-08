local argument = ...
local seed = tonumber(argument) or 0
local trace = {}
local function makeRecord(id)
    return setmetatable({id = id}, {
        __index = function(self, key)
            table.insert(trace, tostring(self.id) .. ":" .. key)
            if key == "Order" then
                if self.id < 0 then return nil end
                if self.id == 0 then return false end
                return self.id % 3
            end
            if key == "Status" then return false end
            return nil
        end,
    })
end
local function order()
    return "explicit-name"
end
local function compare(left, right)
    local a = left and left.Order or 0
    local b = right and right.Order or 0
    if a ~= b then return a < b end
    return left.id < right.id
end
local records = {makeRecord(seed), makeRecord(seed + 1), makeRecord(seed - 1)}
table.sort(records, compare)
for index, record in records do
    local rank = record and record.Order or 0
    local status = record.Status or "unknown"
    local read = function(rank)
        return status, rank
    end
    print("record", index, record.id, rank, read(index))
end
local missing = nil
local absent = missing and missing.Order or 7
print("absent", absent, order(), debug.info(order, "n"))
print("trace", table.concat(trace, ","))
