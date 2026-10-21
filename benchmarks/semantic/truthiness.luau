local function truth(value)
    if value then
        return "truthy"
    else
        return "falsey"
    end
end
print(truth(false), truth(nil), truth(0), truth(""), truth({}))
