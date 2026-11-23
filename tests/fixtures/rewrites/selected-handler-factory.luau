local function choose(add)
    local nextValue
    if add then
        local balance = 1
        nextValue = function(amount)
            balance += amount
            return balance
        end
    else
        local balance = 50
        nextValue = function(amount)
            balance -= amount
            return balance
        end
    end
    return nextValue
end
local credit, debit = choose(true), choose(false)
print(credit(4), debit(7), credit(3), debit(2))
