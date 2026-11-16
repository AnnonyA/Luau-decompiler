local config = {
	name = "Test",
	limits = { min = 1, max = 10 },
	tags = { "a", "b", "c" },
}
config.limits.max *= 2
config.tags[#config.tags + 1] = "d"
print(config.name, config.limits.min, config.limits.max, #config.tags)
