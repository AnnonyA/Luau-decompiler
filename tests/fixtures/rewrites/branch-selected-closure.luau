local function test(t)
    local n=4
    local before=function() return n end
    local mutate
    if t then
        local a=10
        mutate=function() n+=a; a+=2 end
    else
        local a=20
        mutate=function() n-=a; a-=3 end
    end
    mutate(); print(before()); mutate(); print(before())
end
test(true); test(false)
