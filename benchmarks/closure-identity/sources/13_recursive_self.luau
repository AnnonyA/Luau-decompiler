local function self(depth)
    if depth == 0 then return self end
    return self(depth - 1)
end
print(self(0) == self, self(3) == self)
