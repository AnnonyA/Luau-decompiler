-- [[ annonya.github.io ]] v0.2.0 | decompiled at 2026-11-27T18:32:42Z
-- Luau bytecode version: 14 | Luau type version: 3

local list = {}
for index = 1, 210 do
    list[index] = (index * 13 + 5) % 97
end

local function segment(offset: number)
    return table.unpack(list, offset, offset + 20)
end

local function inspectWide()
    local result, value, value2, value3, value4, value5, value6, value7, value8, value9, value10, value11, value12, value13, value14, value15, value16, value17, value18, value19, value20 = table.unpack(list, 1, 21)
    local total = result
    local n21 = value20
    local result2, value21, value22, value23, value24, value25, value26, value27, value28, value29, value30, value31, value32, value33, value34, value35, value36, value37, value38, value39, value40 = table.unpack(list, 22, 42)
    local n42 = value40
    local result3, value41, value42, value43, value44, value45, value46, value47, value48, value49, value50, value51, value52, value53, value54, value55, value56, value57, value58, value59, value60 = table.unpack(list, 43, 63)
    local n63 = value60
    local result4, value61, value62, value63, value64, value65, value66, value67, value68, value69, value70, value71, value72, value73, value74, value75, value76, value77, value78, value79, value80 = table.unpack(list, 64, 84)
    local n84 = value80
    local result5, value81, value82, value83, value84, value85, value86, value87, value88, value89, value90, value91, value92, value93, value94, value95, value96, value97, value98, value99, value100 = table.unpack(list, 85, 105)
    local n105 = value100
    local result6, value101, value102, value103, value104, value105, value106, value107, value108, value109, value110, value111, value112, value113, value114, value115, value116, value117, value118, value119, value120 = table.unpack(list, 106, 126)
    local n126 = value120
    local n127, n128, n129, n130, n131, n132, n133, n134, n135, n136, n137, n138, n139, n140, n141, n142, n143, n144, n145, n146, n147 = (if true then segment else nil)(127)
    local n148, n149, n150, n151, n152, n153, n154, n155, n156, n157, n158, n159, n160, n161, n162, n163, n164, n165, n166, n167, n168 = (if true then segment else nil)(148)
    local n169, n170, n171, n172, n173, n174, n175, n176, n177, n178, n179, n180, n181, n182, n183, n184, n185, n186, n187, n188, n189 = (if true then segment else nil)(169)
    do
        local function bump()
            total += 2
            n189 -= 1
            return total, nil, n189
        end

        print("before", total, n105, n189)
        print("tuple", select("#", (if true then bump else nil)()), (if true then bump else nil)())
    end
    do
        local value121 = total + value + value2 + value3 + value4 + value5 + value6 + value7 + value8 + value9 + value10 + value11 + value12 + value13 + value14 + value15 + value16 + value17 + value18 + value19 + n21
        local value122 = result2 + value21 + value22 + value23 + value24 + value25 + value26 + value27 + value28 + value29 + value30 + value31 + value32 + value33 + value34 + value35 + value36 + value37 + value38 + value39 + n42
        local value123 = result3 + value41 + value42 + value43 + value44 + value45 + value46 + value47 + value48 + value49 + value50 + value51 + value52 + value53 + value54 + value55 + value56 + value57 + value58 + value59 + n63
        local value124 = result4 + value61 + value62 + value63 + value64 + value65 + value66 + value67 + value68 + value69 + value70 + value71 + value72 + value73 + value74 + value75 + value76 + value77 + value78 + value79 + n84
        local value125 = result5 + value81 + value82 + value83 + value84 + value85 + value86 + value87 + value88 + value89 + value90 + value91 + value92 + value93 + value94 + value95 + value96 + value97 + value98 + value99 + n105
        local value126 = result6 + value101 + value102 + value103 + value104 + value105 + value106 + value107 + value108 + value109 + value110 + value111 + value112 + value113 + value114 + value115 + value116 + value117 + value118 + value119 + n126
        local value127 = n127 + n128 + n129 + n130 + n131 + n132 + n133 + n134 + n135 + n136 + n137 + n138 + n139 + n140 + n141 + n142 + n143 + n144 + n145 + n146 + n147
        local value128 = n148 + n149 + n150 + n151 + n152 + n153 + n154 + n155 + n156 + n157 + n158 + n159 + n160 + n161 + n162 + n163 + n164 + n165 + n166 + n167 + n168
        print("groups", value121, value122, value123, value124, value125, value126, value127, value128, n169 + n170 + n171 + n172 + n173 + n174 + n175 + n176 + n177 + n178 + n179 + n180 + n181 + n182 + n183 + n184 + n185 + n186 + n187 + n188 + n189)
    end
    local print2 = print
    local list2 = { n21, n42, n63, n84, n105, n126, n147, n168, n189 }
    print2("tail", #list2, table.concat(list2, ":"), total)
    return n189, nil, n188
end

print("wide", (if true then inspectWide else nil)())
