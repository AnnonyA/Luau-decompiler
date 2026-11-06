-- Original generated stress reduction: short-lived values, ordered effects,
-- and escaping captures must not require hundreds of simultaneous locals.
local first = ...
local seed = tonumber(first) or 3
local trace = {}
local saved = {}
local function event(tag, x)
    table.insert(trace, tag .. ":" .. x)
    return x + seed
end
local output = {}
do
    local before = event("before", 0)
    local after = event("after", 0+1)
    output["entry0"] = after - before
    saved[1] = function() return before, after end
end
do
    local before = event("before", 1)
    local after = event("after", 1+1)
    output["entry1"] = after - before
end
do
    local before = event("before", 2)
    local after = event("after", 2+1)
    output["entry2"] = after - before
end
do
    local before = event("before", 3)
    local after = event("after", 3+1)
    output["entry3"] = after - before
end
do
    local before = event("before", 4)
    local after = event("after", 4+1)
    output["entry4"] = after - before
end
do
    local before = event("before", 5)
    local after = event("after", 5+1)
    output["entry5"] = after - before
end
do
    local before = event("before", 6)
    local after = event("after", 6+1)
    output["entry6"] = after - before
end
do
    local before = event("before", 7)
    local after = event("after", 7+1)
    output["entry7"] = after - before
end
do
    local before = event("before", 8)
    local after = event("after", 8+1)
    output["entry8"] = after - before
end
do
    local before = event("before", 9)
    local after = event("after", 9+1)
    output["entry9"] = after - before
end
do
    local before = event("before", 10)
    local after = event("after", 10+1)
    output["entry10"] = after - before
end
do
    local before = event("before", 11)
    local after = event("after", 11+1)
    output["entry11"] = after - before
end
do
    local before = event("before", 12)
    local after = event("after", 12+1)
    output["entry12"] = after - before
end
do
    local before = event("before", 13)
    local after = event("after", 13+1)
    output["entry13"] = after - before
end
do
    local before = event("before", 14)
    local after = event("after", 14+1)
    output["entry14"] = after - before
end
do
    local before = event("before", 15)
    local after = event("after", 15+1)
    output["entry15"] = after - before
end
do
    local before = event("before", 16)
    local after = event("after", 16+1)
    output["entry16"] = after - before
end
do
    local before = event("before", 17)
    local after = event("after", 17+1)
    output["entry17"] = after - before
end
do
    local before = event("before", 18)
    local after = event("after", 18+1)
    output["entry18"] = after - before
end
do
    local before = event("before", 19)
    local after = event("after", 19+1)
    output["entry19"] = after - before
end
do
    local before = event("before", 20)
    local after = event("after", 20+1)
    output["entry20"] = after - before
end
do
    local before = event("before", 21)
    local after = event("after", 21+1)
    output["entry21"] = after - before
end
do
    local before = event("before", 22)
    local after = event("after", 22+1)
    output["entry22"] = after - before
end
do
    local before = event("before", 23)
    local after = event("after", 23+1)
    output["entry23"] = after - before
end
do
    local before = event("before", 24)
    local after = event("after", 24+1)
    output["entry24"] = after - before
end
do
    local before = event("before", 25)
    local after = event("after", 25+1)
    output["entry25"] = after - before
end
do
    local before = event("before", 26)
    local after = event("after", 26+1)
    output["entry26"] = after - before
end
do
    local before = event("before", 27)
    local after = event("after", 27+1)
    output["entry27"] = after - before
end
do
    local before = event("before", 28)
    local after = event("after", 28+1)
    output["entry28"] = after - before
end
do
    local before = event("before", 29)
    local after = event("after", 29+1)
    output["entry29"] = after - before
end
do
    local before = event("before", 30)
    local after = event("after", 30+1)
    output["entry30"] = after - before
end
do
    local before = event("before", 31)
    local after = event("after", 31+1)
    output["entry31"] = after - before
end
do
    local before = event("before", 32)
    local after = event("after", 32+1)
    output["entry32"] = after - before
end
do
    local before = event("before", 33)
    local after = event("after", 33+1)
    output["entry33"] = after - before
end
do
    local before = event("before", 34)
    local after = event("after", 34+1)
    output["entry34"] = after - before
end
do
    local before = event("before", 35)
    local after = event("after", 35+1)
    output["entry35"] = after - before
end
do
    local before = event("before", 36)
    local after = event("after", 36+1)
    output["entry36"] = after - before
end
do
    local before = event("before", 37)
    local after = event("after", 37+1)
    output["entry37"] = after - before
end
do
    local before = event("before", 38)
    local after = event("after", 38+1)
    output["entry38"] = after - before
end
do
    local before = event("before", 39)
    local after = event("after", 39+1)
    output["entry39"] = after - before
end
do
    local before = event("before", 40)
    local after = event("after", 40+1)
    output["entry40"] = after - before
end
do
    local before = event("before", 41)
    local after = event("after", 41+1)
    output["entry41"] = after - before
end
do
    local before = event("before", 42)
    local after = event("after", 42+1)
    output["entry42"] = after - before
end
do
    local before = event("before", 43)
    local after = event("after", 43+1)
    output["entry43"] = after - before
    saved[2] = function() return before, after end
end
do
    local before = event("before", 44)
    local after = event("after", 44+1)
    output["entry44"] = after - before
end
do
    local before = event("before", 45)
    local after = event("after", 45+1)
    output["entry45"] = after - before
end
do
    local before = event("before", 46)
    local after = event("after", 46+1)
    output["entry46"] = after - before
end
do
    local before = event("before", 47)
    local after = event("after", 47+1)
    output["entry47"] = after - before
end
do
    local before = event("before", 48)
    local after = event("after", 48+1)
    output["entry48"] = after - before
end
do
    local before = event("before", 49)
    local after = event("after", 49+1)
    output["entry49"] = after - before
end
do
    local before = event("before", 50)
    local after = event("after", 50+1)
    output["entry50"] = after - before
end
do
    local before = event("before", 51)
    local after = event("after", 51+1)
    output["entry51"] = after - before
end
do
    local before = event("before", 52)
    local after = event("after", 52+1)
    output["entry52"] = after - before
end
do
    local before = event("before", 53)
    local after = event("after", 53+1)
    output["entry53"] = after - before
end
do
    local before = event("before", 54)
    local after = event("after", 54+1)
    output["entry54"] = after - before
end
do
    local before = event("before", 55)
    local after = event("after", 55+1)
    output["entry55"] = after - before
end
do
    local before = event("before", 56)
    local after = event("after", 56+1)
    output["entry56"] = after - before
end
do
    local before = event("before", 57)
    local after = event("after", 57+1)
    output["entry57"] = after - before
end
do
    local before = event("before", 58)
    local after = event("after", 58+1)
    output["entry58"] = after - before
end
do
    local before = event("before", 59)
    local after = event("after", 59+1)
    output["entry59"] = after - before
end
do
    local before = event("before", 60)
    local after = event("after", 60+1)
    output["entry60"] = after - before
end
do
    local before = event("before", 61)
    local after = event("after", 61+1)
    output["entry61"] = after - before
end
do
    local before = event("before", 62)
    local after = event("after", 62+1)
    output["entry62"] = after - before
end
do
    local before = event("before", 63)
    local after = event("after", 63+1)
    output["entry63"] = after - before
end
do
    local before = event("before", 64)
    local after = event("after", 64+1)
    output["entry64"] = after - before
end
do
    local before = event("before", 65)
    local after = event("after", 65+1)
    output["entry65"] = after - before
end
do
    local before = event("before", 66)
    local after = event("after", 66+1)
    output["entry66"] = after - before
end
do
    local before = event("before", 67)
    local after = event("after", 67+1)
    output["entry67"] = after - before
end
do
    local before = event("before", 68)
    local after = event("after", 68+1)
    output["entry68"] = after - before
end
do
    local before = event("before", 69)
    local after = event("after", 69+1)
    output["entry69"] = after - before
end
do
    local before = event("before", 70)
    local after = event("after", 70+1)
    output["entry70"] = after - before
end
do
    local before = event("before", 71)
    local after = event("after", 71+1)
    output["entry71"] = after - before
end
do
    local before = event("before", 72)
    local after = event("after", 72+1)
    output["entry72"] = after - before
end
do
    local before = event("before", 73)
    local after = event("after", 73+1)
    output["entry73"] = after - before
end
do
    local before = event("before", 74)
    local after = event("after", 74+1)
    output["entry74"] = after - before
end
do
    local before = event("before", 75)
    local after = event("after", 75+1)
    output["entry75"] = after - before
end
do
    local before = event("before", 76)
    local after = event("after", 76+1)
    output["entry76"] = after - before
end
do
    local before = event("before", 77)
    local after = event("after", 77+1)
    output["entry77"] = after - before
end
do
    local before = event("before", 78)
    local after = event("after", 78+1)
    output["entry78"] = after - before
end
do
    local before = event("before", 79)
    local after = event("after", 79+1)
    output["entry79"] = after - before
end
do
    local before = event("before", 80)
    local after = event("after", 80+1)
    output["entry80"] = after - before
end
do
    local before = event("before", 81)
    local after = event("after", 81+1)
    output["entry81"] = after - before
end
do
    local before = event("before", 82)
    local after = event("after", 82+1)
    output["entry82"] = after - before
end
do
    local before = event("before", 83)
    local after = event("after", 83+1)
    output["entry83"] = after - before
end
do
    local before = event("before", 84)
    local after = event("after", 84+1)
    output["entry84"] = after - before
end
do
    local before = event("before", 85)
    local after = event("after", 85+1)
    output["entry85"] = after - before
end
do
    local before = event("before", 86)
    local after = event("after", 86+1)
    output["entry86"] = after - before
    saved[3] = function() return before, after end
end
do
    local before = event("before", 87)
    local after = event("after", 87+1)
    output["entry87"] = after - before
end
do
    local before = event("before", 88)
    local after = event("after", 88+1)
    output["entry88"] = after - before
end
do
    local before = event("before", 89)
    local after = event("after", 89+1)
    output["entry89"] = after - before
end
do
    local before = event("before", 90)
    local after = event("after", 90+1)
    output["entry90"] = after - before
end
do
    local before = event("before", 91)
    local after = event("after", 91+1)
    output["entry91"] = after - before
end
do
    local before = event("before", 92)
    local after = event("after", 92+1)
    output["entry92"] = after - before
end
do
    local before = event("before", 93)
    local after = event("after", 93+1)
    output["entry93"] = after - before
end
do
    local before = event("before", 94)
    local after = event("after", 94+1)
    output["entry94"] = after - before
end
do
    local before = event("before", 95)
    local after = event("after", 95+1)
    output["entry95"] = after - before
end
do
    local before = event("before", 96)
    local after = event("after", 96+1)
    output["entry96"] = after - before
end
do
    local before = event("before", 97)
    local after = event("after", 97+1)
    output["entry97"] = after - before
end
do
    local before = event("before", 98)
    local after = event("after", 98+1)
    output["entry98"] = after - before
end
do
    local before = event("before", 99)
    local after = event("after", 99+1)
    output["entry99"] = after - before
end
do
    local before = event("before", 100)
    local after = event("after", 100+1)
    output["entry100"] = after - before
end
do
    local before = event("before", 101)
    local after = event("after", 101+1)
    output["entry101"] = after - before
end
do
    local before = event("before", 102)
    local after = event("after", 102+1)
    output["entry102"] = after - before
end
do
    local before = event("before", 103)
    local after = event("after", 103+1)
    output["entry103"] = after - before
end
do
    local before = event("before", 104)
    local after = event("after", 104+1)
    output["entry104"] = after - before
end
do
    local before = event("before", 105)
    local after = event("after", 105+1)
    output["entry105"] = after - before
end
do
    local before = event("before", 106)
    local after = event("after", 106+1)
    output["entry106"] = after - before
end
do
    local before = event("before", 107)
    local after = event("after", 107+1)
    output["entry107"] = after - before
end
do
    local before = event("before", 108)
    local after = event("after", 108+1)
    output["entry108"] = after - before
end
do
    local before = event("before", 109)
    local after = event("after", 109+1)
    output["entry109"] = after - before
end
do
    local before = event("before", 110)
    local after = event("after", 110+1)
    output["entry110"] = after - before
end
do
    local before = event("before", 111)
    local after = event("after", 111+1)
    output["entry111"] = after - before
end
do
    local before = event("before", 112)
    local after = event("after", 112+1)
    output["entry112"] = after - before
end
do
    local before = event("before", 113)
    local after = event("after", 113+1)
    output["entry113"] = after - before
end
do
    local before = event("before", 114)
    local after = event("after", 114+1)
    output["entry114"] = after - before
end
do
    local before = event("before", 115)
    local after = event("after", 115+1)
    output["entry115"] = after - before
end
do
    local before = event("before", 116)
    local after = event("after", 116+1)
    output["entry116"] = after - before
end
do
    local before = event("before", 117)
    local after = event("after", 117+1)
    output["entry117"] = after - before
end
do
    local before = event("before", 118)
    local after = event("after", 118+1)
    output["entry118"] = after - before
end
do
    local before = event("before", 119)
    local after = event("after", 119+1)
    output["entry119"] = after - before
end
do
    local before = event("before", 120)
    local after = event("after", 120+1)
    output["entry120"] = after - before
end
do
    local before = event("before", 121)
    local after = event("after", 121+1)
    output["entry121"] = after - before
end
do
    local before = event("before", 122)
    local after = event("after", 122+1)
    output["entry122"] = after - before
end
do
    local before = event("before", 123)
    local after = event("after", 123+1)
    output["entry123"] = after - before
end
do
    local before = event("before", 124)
    local after = event("after", 124+1)
    output["entry124"] = after - before
end
do
    local before = event("before", 125)
    local after = event("after", 125+1)
    output["entry125"] = after - before
end
do
    local before = event("before", 126)
    local after = event("after", 126+1)
    output["entry126"] = after - before
end
do
    local before = event("before", 127)
    local after = event("after", 127+1)
    output["entry127"] = after - before
end
do
    local before = event("before", 128)
    local after = event("after", 128+1)
    output["entry128"] = after - before
end
do
    local before = event("before", 129)
    local after = event("after", 129+1)
    output["entry129"] = after - before
    saved[4] = function() return before, after end
end
do
    local before = event("before", 130)
    local after = event("after", 130+1)
    output["entry130"] = after - before
end
do
    local before = event("before", 131)
    local after = event("after", 131+1)
    output["entry131"] = after - before
end
do
    local before = event("before", 132)
    local after = event("after", 132+1)
    output["entry132"] = after - before
end
do
    local before = event("before", 133)
    local after = event("after", 133+1)
    output["entry133"] = after - before
end
do
    local before = event("before", 134)
    local after = event("after", 134+1)
    output["entry134"] = after - before
end
do
    local before = event("before", 135)
    local after = event("after", 135+1)
    output["entry135"] = after - before
end
do
    local before = event("before", 136)
    local after = event("after", 136+1)
    output["entry136"] = after - before
end
do
    local before = event("before", 137)
    local after = event("after", 137+1)
    output["entry137"] = after - before
end
do
    local before = event("before", 138)
    local after = event("after", 138+1)
    output["entry138"] = after - before
end
do
    local before = event("before", 139)
    local after = event("after", 139+1)
    output["entry139"] = after - before
end
do
    local before = event("before", 140)
    local after = event("after", 140+1)
    output["entry140"] = after - before
end
do
    local before = event("before", 141)
    local after = event("after", 141+1)
    output["entry141"] = after - before
end
do
    local before = event("before", 142)
    local after = event("after", 142+1)
    output["entry142"] = after - before
end
do
    local before = event("before", 143)
    local after = event("after", 143+1)
    output["entry143"] = after - before
end
do
    local before = event("before", 144)
    local after = event("after", 144+1)
    output["entry144"] = after - before
end
do
    local before = event("before", 145)
    local after = event("after", 145+1)
    output["entry145"] = after - before
end
do
    local before = event("before", 146)
    local after = event("after", 146+1)
    output["entry146"] = after - before
end
do
    local before = event("before", 147)
    local after = event("after", 147+1)
    output["entry147"] = after - before
end
do
    local before = event("before", 148)
    local after = event("after", 148+1)
    output["entry148"] = after - before
end
do
    local before = event("before", 149)
    local after = event("after", 149+1)
    output["entry149"] = after - before
end
do
    local before = event("before", 150)
    local after = event("after", 150+1)
    output["entry150"] = after - before
end
do
    local before = event("before", 151)
    local after = event("after", 151+1)
    output["entry151"] = after - before
end
do
    local before = event("before", 152)
    local after = event("after", 152+1)
    output["entry152"] = after - before
end
do
    local before = event("before", 153)
    local after = event("after", 153+1)
    output["entry153"] = after - before
end
do
    local before = event("before", 154)
    local after = event("after", 154+1)
    output["entry154"] = after - before
end
do
    local before = event("before", 155)
    local after = event("after", 155+1)
    output["entry155"] = after - before
end
do
    local before = event("before", 156)
    local after = event("after", 156+1)
    output["entry156"] = after - before
end
do
    local before = event("before", 157)
    local after = event("after", 157+1)
    output["entry157"] = after - before
end
do
    local before = event("before", 158)
    local after = event("after", 158+1)
    output["entry158"] = after - before
end
do
    local before = event("before", 159)
    local after = event("after", 159+1)
    output["entry159"] = after - before
end
do
    local before = event("before", 160)
    local after = event("after", 160+1)
    output["entry160"] = after - before
end
do
    local before = event("before", 161)
    local after = event("after", 161+1)
    output["entry161"] = after - before
end
do
    local before = event("before", 162)
    local after = event("after", 162+1)
    output["entry162"] = after - before
end
do
    local before = event("before", 163)
    local after = event("after", 163+1)
    output["entry163"] = after - before
end
do
    local before = event("before", 164)
    local after = event("after", 164+1)
    output["entry164"] = after - before
end
do
    local before = event("before", 165)
    local after = event("after", 165+1)
    output["entry165"] = after - before
end
do
    local before = event("before", 166)
    local after = event("after", 166+1)
    output["entry166"] = after - before
end
do
    local before = event("before", 167)
    local after = event("after", 167+1)
    output["entry167"] = after - before
end
do
    local before = event("before", 168)
    local after = event("after", 168+1)
    output["entry168"] = after - before
end
do
    local before = event("before", 169)
    local after = event("after", 169+1)
    output["entry169"] = after - before
end
do
    local before = event("before", 170)
    local after = event("after", 170+1)
    output["entry170"] = after - before
end
do
    local before = event("before", 171)
    local after = event("after", 171+1)
    output["entry171"] = after - before
end
do
    local before = event("before", 172)
    local after = event("after", 172+1)
    output["entry172"] = after - before
    saved[5] = function() return before, after end
end
do
    local before = event("before", 173)
    local after = event("after", 173+1)
    output["entry173"] = after - before
end
do
    local before = event("before", 174)
    local after = event("after", 174+1)
    output["entry174"] = after - before
end
do
    local before = event("before", 175)
    local after = event("after", 175+1)
    output["entry175"] = after - before
end
do
    local before = event("before", 176)
    local after = event("after", 176+1)
    output["entry176"] = after - before
end
do
    local before = event("before", 177)
    local after = event("after", 177+1)
    output["entry177"] = after - before
end
do
    local before = event("before", 178)
    local after = event("after", 178+1)
    output["entry178"] = after - before
end
do
    local before = event("before", 179)
    local after = event("after", 179+1)
    output["entry179"] = after - before
end
do
    local before = event("before", 180)
    local after = event("after", 180+1)
    output["entry180"] = after - before
end
do
    local before = event("before", 181)
    local after = event("after", 181+1)
    output["entry181"] = after - before
end
do
    local before = event("before", 182)
    local after = event("after", 182+1)
    output["entry182"] = after - before
end
do
    local before = event("before", 183)
    local after = event("after", 183+1)
    output["entry183"] = after - before
end
do
    local before = event("before", 184)
    local after = event("after", 184+1)
    output["entry184"] = after - before
end
do
    local before = event("before", 185)
    local after = event("after", 185+1)
    output["entry185"] = after - before
end
do
    local before = event("before", 186)
    local after = event("after", 186+1)
    output["entry186"] = after - before
end
do
    local before = event("before", 187)
    local after = event("after", 187+1)
    output["entry187"] = after - before
end
do
    local before = event("before", 188)
    local after = event("after", 188+1)
    output["entry188"] = after - before
end
do
    local before = event("before", 189)
    local after = event("after", 189+1)
    output["entry189"] = after - before
end
do
    local before = event("before", 190)
    local after = event("after", 190+1)
    output["entry190"] = after - before
end
do
    local before = event("before", 191)
    local after = event("after", 191+1)
    output["entry191"] = after - before
end
do
    local before = event("before", 192)
    local after = event("after", 192+1)
    output["entry192"] = after - before
end
do
    local before = event("before", 193)
    local after = event("after", 193+1)
    output["entry193"] = after - before
end
do
    local before = event("before", 194)
    local after = event("after", 194+1)
    output["entry194"] = after - before
end
do
    local before = event("before", 195)
    local after = event("after", 195+1)
    output["entry195"] = after - before
end
do
    local before = event("before", 196)
    local after = event("after", 196+1)
    output["entry196"] = after - before
end
do
    local before = event("before", 197)
    local after = event("after", 197+1)
    output["entry197"] = after - before
end
do
    local before = event("before", 198)
    local after = event("after", 198+1)
    output["entry198"] = after - before
end
do
    local before = event("before", 199)
    local after = event("after", 199+1)
    output["entry199"] = after - before
end
do
    local before = event("before", 200)
    local after = event("after", 200+1)
    output["entry200"] = after - before
end
do
    local before = event("before", 201)
    local after = event("after", 201+1)
    output["entry201"] = after - before
end
do
    local before = event("before", 202)
    local after = event("after", 202+1)
    output["entry202"] = after - before
end
do
    local before = event("before", 203)
    local after = event("after", 203+1)
    output["entry203"] = after - before
end
do
    local before = event("before", 204)
    local after = event("after", 204+1)
    output["entry204"] = after - before
end
do
    local before = event("before", 205)
    local after = event("after", 205+1)
    output["entry205"] = after - before
end
do
    local before = event("before", 206)
    local after = event("after", 206+1)
    output["entry206"] = after - before
end
do
    local before = event("before", 207)
    local after = event("after", 207+1)
    output["entry207"] = after - before
end
do
    local before = event("before", 208)
    local after = event("after", 208+1)
    output["entry208"] = after - before
end
do
    local before = event("before", 209)
    local after = event("after", 209+1)
    output["entry209"] = after - before
end
do
    local before = event("before", 210)
    local after = event("after", 210+1)
    output["entry210"] = after - before
end
do
    local before = event("before", 211)
    local after = event("after", 211+1)
    output["entry211"] = after - before
end
do
    local before = event("before", 212)
    local after = event("after", 212+1)
    output["entry212"] = after - before
end
do
    local before = event("before", 213)
    local after = event("after", 213+1)
    output["entry213"] = after - before
end
do
    local before = event("before", 214)
    local after = event("after", 214+1)
    output["entry214"] = after - before
end
local checksum = 0
for _, value in output do checksum += value end
print("checksum", checksum, #trace)
print(table.concat(trace, "|"))
for i, read in saved do print("saved", i, read()) end
