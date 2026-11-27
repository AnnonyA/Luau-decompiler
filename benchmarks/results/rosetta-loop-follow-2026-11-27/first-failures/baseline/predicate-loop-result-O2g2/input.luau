local function firstMatch(items, predicate)
    for _, item in items do
        if predicate(item) then
            return item
        end
    end
    return nil
end
print(firstMatch({2, 7, 9}, function(item) return item > 5 end))
print(firstMatch({2, 3}, function(item) return item > 5 end))
