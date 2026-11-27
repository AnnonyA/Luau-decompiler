local function function_(p: boolean)
    local calls: number = 0
    while calls < 3 do
        if p then
            return 75
        end
        calls += 1
    end
    return calls
end

print((if true then function_ else nil)(true))
print((if true then function_ else nil)(false))
