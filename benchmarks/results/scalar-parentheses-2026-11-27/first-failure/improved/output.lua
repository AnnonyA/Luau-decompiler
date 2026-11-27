-- [[ annonya.github.io ]] v0.2.0 | decompiled at 2026-11-27T21:25:51Z
-- Luau bytecode version: 14 | Luau type version: 3

local list = {}

local function values(value, ...)
    list[#list + 1] = value
    return ...
end

local function empty(tag: string)
    list[#list + 1] = tag
end

local function record(value2, ...)
    local count = select("#", ...)
    local list = {}
    for index = 1, count do
        list[index] = tostring(select(index, ...))
    end
    print(value2, count, (table.concat)(list, ":"))
end

local one = (values)("one", 11, nil, 13)
local left, right = (values)("left", 21, nil, 23), (values)("right", 31, nil, 33)
local filled, missing, absent = (values)("padded", 41, 42, 43), nil, nil;
(record)("locals", one, left, right, filled, missing, absent);
(record)("assign", (values)("assign-first", 51, 52), (values)("assign-last", 61, 62), (values)("assign-padded", 71, 72, 73), nil, nil);
(record)("arg-prefix", (values)("arg-first", 81, nil, 83), "tail");
(record)("arg-tail", "head", ((values)("arg-last", 91, nil, 93)));
(record)("arg-open", "head", (values)("arg-open", 101, nil, 103));
(record)("empty-tail", ((true and empty)("empty-tail")));
(record)("empty-open", (true and empty)("empty-open"))
local tbl = {}

function tbl.read(self, tag)
    list[#list + 1] = tag
    return self, nil, "extra"
end

local receiver = tbl:read("method-single");
(record)("method-prefix", not (tbl:read("method-prefix") ~= tbl), receiver == tbl);
(record)("method-tail-count", select("#", (tbl:read("method-tail"))))
local data = {
    (values)("array-first", "alpha", "extra"),
    keyed = (values)("field-value", "beta", "extra"),
    [(values)("field-key", "dynamic", "extra")] = (values)("dynamic-value", "gamma", "extra"),
    ((values)("array-last", "delta", "extra")),
};
(record)("table", #data, data[1], data[2], data[3], data.keyed, data.dynamic);
(record)("index", data[(values)("lookup", "dynamic", "extra")])
local list2 = { (values)("list-prefix", 1, 2), (values)("list-open", 3, nil, 5) };
(record)("spread", list2[1], list2[2], list2[3], list2[4], list2[5])

local function returns(flag: boolean)
    return (values)("return-prefix", 201, nil, 203), ((values)(if flag then "return-yes" else "return-no", 211, nil, 213))
end;

(record)("returns-true", (true and returns)(true));
(record)("returns-false", (true and returns)(false))

local function conditional(flag: boolean)
    return if flag then (values)("conditional-yes", 221, nil, 223) else (true and empty)("conditional-no")
end;

(record)("conditional-true", (true and conditional)(true));
(record)("conditional-false", (true and conditional)(false))

local function variadic(...)
    local first = ...
    local first2 = ...
    local nil1, nil2 = nil, nil
    local first3 = ...
    local first4 = ...
    local list = { first3, "tail" }
    local value2 = list[1]
    local value3 = list[2]
    local list2 = { first4 };
    (record)("vararg-locals", first, first2, nil1, nil2, value2, value3, list2[1], list2[2]);
    (record)("vararg-prefix", ..., "tail")
    local first5 = ...;
    (record)("vararg-tail", "head", first5)
    return ..., (...)
end;

(record)("vararg-return", (variadic)(231, nil, 233));
(record)("vararg-empty", (variadic)())
local total: number = 0
for index2 = (values)("start", 1, 9), (values)("stop", 2, 9), (values)("step", 1, 9) do
    total += (values)("increment", index2, 9)
end
if (values)("if-test", true, false) then
    total += -(values)("negative", -4, 9) + (values)("binary", 5, 9)
end
local count2: number = 0
while (values)("while-test", count2 < 1, false) do
    count2 += 1
end
repeat
    count2 += 1
    local result = count2 >= 3
until (values)("until-test", result, false)
local value2 = (values)("interpolation", "word", "extra");
(record)("bounds", total, count2, (("%*"):format(value2)))

local function iterator()
    local index: number = 0
    return function(state)
        if state ~= nil then
            error("grouped iterator leaked its extra state")
        end
        index += 1
        if index <= 2 then
            return index, index * 10
        end
    end, "ignored-state", "ignored-control"
end

for key, value3 in (true and iterator)() do
    (record)("iteration", key, value3)
end

local function create(value: number)
    local data = { value = value }
    return function(delta)
        data.value += delta
        return data
    end, "ignored-function-tail"
end

local callback = (true and create)(7)
local alias = callback
local initial = callback(0)
local changed = alias(2)

local function run(): number
    return 1
end

local tbl2 = {}
tbl2["run"] = run
local function_3 = function(): number
    return 2
end
local tbl3 = {}
tbl3["run"] = function_3;
(record)("closures", callback == alias, initial == changed, initial.value, (debug.info)(callback, "n"), (debug.info)(tbl2.run, "n"), (debug.info)(tbl3.run, "n"))
print("trace", (table.concat)(list, ","))
