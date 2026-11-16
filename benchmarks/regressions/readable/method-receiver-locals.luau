local Row = {}
Row.__index = Row

local Node = {}
Node.__index = Node

function Node:collect(rows)
	local out = {}
	for _, row in ipairs(rows) do
		if row.value > self.limit then
			local copy = setmetatable({ value = row.value }, Row)
			copy.tag = self.tag
			copy.owner = self
			out[#out + 1] = copy
		end
	end
	return out
end

function Node.build(limit, tag)
	local node = setmetatable({}, Node)
	node.limit = limit
	node.tag = tag
	return node
end

local node = Node.build(1, "t")
local result = node:collect({ { value = 1 }, { value = 2 }, { value = 3 } })
print(#result, result[1].tag, result[2].value, result[1].owner == node, getmetatable(result[1]) == Row)