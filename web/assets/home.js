import {renderCode} from './highlight.js';
const examples = {
 after: `local Players = game:GetService("Players")

local function formatName(player: Player): string
    if player.DisplayName == player.Name then
        return player.Name
    end
    return player.DisplayName .. " / " .. player.Name
end

local function listPlayers()
    local names = {}
    for _, player in Players:GetPlayers() do
        names[#names + 1] = formatName(player)
    end
    return names
end

print(table.concat(listPlayers(), ", "))`,
 before: `local v0 = game:GetService("Players")

local function v1(v2)
    if v2.DisplayName == v2.Name then
        return v2.Name
    end
    return v2.DisplayName .. " / " .. v2.Name
end

local function v3()
    local v4 = {}
    for _, v5 in v0:GetPlayers() do
        v4[#v4 + 1] = v1(v5)
    end
    return v4
end

print(table.concat(v3(), ", "))`
};
const buttons = ['before','after'].map(name => document.getElementById('sample-'+name));
function select(name) {
 renderCode(document.getElementById('sample-code'),document.getElementById('sample-lines'),examples[name]);
 buttons.forEach(button=>{const active=button.id==='sample-'+name;button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;});
 document.getElementById('preview-code').setAttribute('aria-labelledby','sample-'+name);
}
buttons.forEach(button=>{button.addEventListener('click',()=>select(button.id.slice(7)));button.addEventListener('keydown',event=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();const target=event.key==='Home'?buttons[0]:event.key==='End'?buttons[1]:buttons.find(b=>b!==button);select(target.id.slice(7));target.focus();}});});
select('after');
