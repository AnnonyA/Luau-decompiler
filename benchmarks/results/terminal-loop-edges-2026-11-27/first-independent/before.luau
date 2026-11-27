local function function_(p: boolean)
    local calls: number = 0
    while calls < 3 do
        if p then
            local value: number = 75
            break
        end
        calls += 1
    end
    return calls
end

print((if true then function_ else nil)(true))
print((if true then function_ else nil)(false))
