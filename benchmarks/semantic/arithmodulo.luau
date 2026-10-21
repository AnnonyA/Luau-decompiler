local function residues(a, b)
    return a % b, (a // b) * b + a % b
end
print(residues(17, 5))
print(residues(-17, 5))
print(residues(17, -5))
print(residues(-17, -5))
