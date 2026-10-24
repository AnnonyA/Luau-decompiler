local function token(index, count)
    return {text = 'sample', joined = index < count, penalty = index < count and 35 or 0}
end
local function settings(owner, group, permission)
    return {id = 7, owner = owner or 'guest', group = group or 'staff', permission = permission or 420}
end
for _, index in ipairs({1, 2, 4}) do
    local value = token(index, 2)
    print(value.text, value.joined, value.penalty)
end
for _, owner in ipairs({false, 'alice'}) do
    for _, group in ipairs({false, 'users'}) do
        local value = settings(owner, group, nil)
        print(value.id, value.owner, value.group, value.permission)
    end
end
