local counter = {value = 0}
function counter:increment(delta)
    self.value += delta
    return self.value
end
print(counter:increment(2), counter:increment(3), counter.value)
