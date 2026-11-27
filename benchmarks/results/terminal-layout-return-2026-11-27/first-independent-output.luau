local list = {}
local list2 = {}

local function route(items)
    for _, item in items do
        if item == 3 then
            local function callback()
                return item
            end

            table.insert(list, callback)
            table.insert(list2, "three")
        elseif item == 7 then
            local function callback2()
                return item
            end

            table.insert(list, callback2)
            table.insert(list2, "seven")
            return
        else
            table.insert(list2, "step")
        end
    end
    table.insert(list2, "exhausted")
end

local list3 = { route };
(if true then list3[1] else nil)({ 1, 3, 7 });
(if true then list3[1] else nil)({ 7 });
(if true then list3[1] else nil)({ 1, 2 })
print(table.concat(list2, ","), (if true then list[1] else nil)(), (if true then list[2] else nil)(), #list)
local print2 = print
local select2 = select
print2(select2("#", (if true then list3[1] else nil)({})))
