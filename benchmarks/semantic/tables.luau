local item = { name = "alpha", score = 4 }
item.score += 3
item["name"] = item.name .. "!"
local sequence = { 2, 4, 6 }
print("tables", item.name, item.score, #sequence)
