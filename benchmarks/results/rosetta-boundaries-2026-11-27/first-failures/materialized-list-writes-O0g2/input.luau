local key = "value"
local object = {
    [key] = 17,
    read = function(self)
        return self.value
    end,
    "alpha",
    "omega",
}
local alias = object
print(object.value, object:read(), object[1], object[2], alias == object)
object[1] = "changed"
print(alias[1], object.read == alias.read)
