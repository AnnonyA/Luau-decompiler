-- Independent regression: hiding work must not terminate a periodic task.
local input = ...
local offset = tonumber(input) or 0
local state = {visible = false, ready = false, total = 0}
local worker = coroutine.create(function()
    while true do
        coroutine.yield("tick")
        if state.visible and state.ready then
            for _, value in {2, 5} do
                state.total += value
            end
        end
    end
end)
for index = 1, 8 do
    state.visible = (index + offset) % 3 ~= 1
    state.ready = (index + offset) % 2 == 0
    local ok, message = coroutine.resume(worker)
    print(index, ok, message, state.total, coroutine.status(worker))
end
