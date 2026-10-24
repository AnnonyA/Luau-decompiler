-- Independently authored virtual archive filesystem workload.
-- No generated handlers, external modules, host filesystem, or nondeterministic inputs.
local seedText, modeText = ...
local seed = tonumber(seedText) or 0
local mode = tonumber(modeText) or 0
local MOD = 2147483629
local function fail(message)
    error(message, 0)
end
local function expect(condition, message)
    if not condition then
        fail(message)
    end
end
local function copyMap(source)
    local result = {}
    for key, value in pairs(source) do
        result[key] = value
    end
    return result
end
local function copyArray(source)
    local result = {}
    for index, value in ipairs(source) do
        result[index] = value
    end
    return result
end
local function sortedKeys(source)
    local result = {}
    for key in pairs(source) do
        table.insert(result, key)
    end
    table.sort(result)
    return result
end
local function checksum(text)
    local a = 17
    local b = 31
    for index = 1, #text do
        local byte = string.byte(text, index)
        a = (a * 131 + byte + index) % MOD
        b = (b * 67 + byte * (index % 97 + 1)) % MOD
    end
    return string.format('%08x%08x', a, b)
end
local function foldNumber(state, value)
    return (state * 127 + value + 19) % MOD
end
local function joinPath(parent, name)
    if parent == '/' then
        return '/' .. name
    end
    return parent .. '/' .. name
end
local function splitPath(path)
    local result = {}
    for part in string.gmatch(path, '[^/]+') do
        table.insert(result, part)
    end
    return result
end
local function canonical(path, cwd)
    local parts = {}
    if string.sub(path, 1, 1) ~= '/' then
        for _, part in ipairs(splitPath(cwd or '/')) do
            table.insert(parts, part)
        end
    end
    for _, part in ipairs(splitPath(path)) do
        if part == '..' then
            if #parts > 0 then
                table.remove(parts)
            end
        elseif part ~= '.' then
            table.insert(parts, part)
        end
    end
    return '/' .. table.concat(parts, '/')
end
local function parentPath(path)
    local clean = canonical(path, '/')
    local position = string.match(clean, '^.*()/')
    if position == 1 then
        return '/', string.sub(clean, 2)
    end
    return string.sub(clean, 1, position - 1), string.sub(clean, position + 1)
end
local function escape(text)
    local output = {}
    for index = 1, #text do
        local byte = string.byte(text, index)
        if byte < 33 or byte > 126 or byte == 37 or byte == 124 then
            table.insert(output, string.format('%%%02X', byte))
        else
            table.insert(output, string.char(byte))
        end
    end
    return table.concat(output)
end
local function unescape(text)
    local output = {}
    local index = 1
    while index <= #text do
        local char = string.sub(text, index, index)
        if char == '%' then
            local hex = string.sub(text, index + 1, index + 2)
            expect(#hex == 2 and string.match(hex, '^%x%x$') ~= nil, 'invalid escape')
            table.insert(output, string.char(tonumber(hex, 16)))
            index += 3
        else
            table.insert(output, char)
            index += 1
        end
    end
    return table.concat(output)
end
local function fields(line)
    local result = {}
    local start = 1
    while true do
        local finish = string.find(line, '|', start, true)
        if not finish then
            table.insert(result, string.sub(line, start))
            break
        end
        table.insert(result, string.sub(line, start, finish - 1))
        start = finish + 1
    end
    return result
end
local function record(kind, values)
    local output = { kind }
    for _, value in ipairs(values) do
        table.insert(output, escape(tostring(value)))
    end
    return table.concat(output, '|')
end
local function linesOf(text)
    local result = {}
    local start = 1
    while start <= #text do
        local finish = string.find(text, '\n', start, true)
        if not finish then
            table.insert(result, string.sub(text, start))
            break
        end
        table.insert(result, string.sub(text, start, finish - 1))
        start = finish + 1
    end
    return result
end
local function report(label, ...)
    local result = { label }
    for index = 1, select('#', ...) do
        table.insert(result, tostring(select(index, ...)))
    end
    print(table.concat(result, '|'))
end
local ChunkStore = {}
ChunkStore.__index = ChunkStore
function ChunkStore.new(width)
    return setmetatable({ width = width, data = {}, hits = 0, misses = 0, bytes = 0 }, ChunkStore)
end
function ChunkStore:intern(text)
    local key = checksum(text) .. ':' .. tostring(#text)
    local candidate = key
    local collision = 0
    while self.data[candidate] ~= nil and self.data[candidate] ~= text do
        collision += 1
        candidate = key .. ':' .. tostring(collision)
    end
    if self.data[candidate] == nil then
        self.data[candidate] = text
        self.misses += 1
        self.bytes += #text
    else
        self.hits += 1
    end
    return candidate
end
function ChunkStore:put(text)
    local chunks = {}
    for start = 1, #text, self.width do
        local block = string.sub(text, start, start + self.width - 1)
        table.insert(chunks, self:intern(block))
    end
    return chunks, #text, checksum(text)
end
function ChunkStore:get(chunks)
    local output = {}
    for _, key in ipairs(chunks) do
        expect(self.data[key] ~= nil, 'missing chunk:' .. key)
        table.insert(output, self.data[key])
    end
    return table.concat(output)
end
function ChunkStore:range(chunks, offset, count)
    expect(offset >= 0 and count >= 0, 'invalid range')
    local output = {}
    local cursor = 0
    local remaining = count
    for _, key in ipairs(chunks) do
        local block = self.data[key]
        local finish = cursor + #block
        if finish > offset and remaining > 0 then
            local first = math.max(1, offset - cursor + 1)
            local portion = string.sub(block, first, first + remaining - 1)
            table.insert(output, portion)
            remaining -= #portion
            offset += #portion
        end
        cursor = finish
    end
    return table.concat(output), remaining
end
function ChunkStore:stats(live)
    local total = 0
    local retained = 0
    local dead = 0
    local fingerprint = 1
    for _, key in ipairs(sortedKeys(self.data)) do
        local bytes = #self.data[key]
        total += 1
        if live[key] then
            retained += bytes
        else
            dead += bytes
        end
        fingerprint = foldNumber(fingerprint, bytes + #key)
    end
    return total, retained, dead, fingerprint
end
function ChunkStore:compact(live)
    local removed = 0
    local reclaimed = 0
    for _, key in ipairs(sortedKeys(self.data)) do
        if not live[key] then
            reclaimed += #self.data[key]
            self.bytes -= #self.data[key]
            self.data[key] = nil
            removed += 1
        end
    end
    return removed, reclaimed
end
local function cloneNode(node)
    local clone = copyMap(node)
    clone.attrs = copyMap(node.attrs)
    if node.entries then
        clone.entries = copyMap(node.entries)
    end
    if node.chunks then
        clone.chunks = copyArray(node.chunks)
    end
    return clone
end
local function hasBit(value, weight)
    return math.floor(value / weight) % 2 == 1
end
local Filesystem = {}
Filesystem.__index = Filesystem
function Filesystem.new(pool)
    local root = {
        id = 1,
        kind = 'dir',
        owner = 'root',
        group = 'staff',
        perm = 493,
        links = 1,
        version = 1,
        entries = {},
        attrs = {},
        size = 0,
    }
    return setmetatable({
        pool = pool,
        nodes = { [1] = root },
        nextId = 2,
        revision = 1,
        clock = 0,
        journal = {},
        snapshots = {},
        session = { user = 'root', groups = { staff = true }, cwd = '/' },
        watchers = {},
        openHandles = {},
        nextHandle = 1,
    }, Filesystem)
end
function Filesystem:touch(id)
    local node = self.nodes[id]
    expect(node ~= nil, 'missing inode:' .. tostring(id))
    if node.version ~= self.revision then
        node = cloneNode(node)
        node.version = self.revision
        self.nodes[id] = node
    end
    self.clock += 1
    node.modified = self.clock
    return node
end
function Filesystem:allowed(node, action)
    if self.session.user == 'root' then
        return true
    end
    local shift = 0
    if node.owner == self.session.user then
        shift = 6
    elseif self.session.groups[node.group] then
        shift = 3
    end
    local bits = math.floor(node.perm / (2 ^ shift)) % 8
    local weights = { read = 4, write = 2, search = 1 }
    return hasBit(bits, weights[action])
end
function Filesystem:requireAccess(node, action)
    expect(self:allowed(node, action), 'permission:' .. action .. ':' .. tostring(node.id))
end
function Filesystem:resolve(path, followFinal)
    expect(type(path) == 'string' and #path > 0, 'empty path')
    local absolute = canonical(path, self.session.cwd)
    local pending = splitPath(absolute)
    local current = 1
    local prefix = '/'
    local index = 1
    local followed = 0
    while index <= #pending do
        local directory = self.nodes[current]
        expect(directory.kind == 'dir', 'not directory:' .. prefix)
        self:requireAccess(directory, 'search')
        local name = pending[index]
        local childId = directory.entries[name]
        expect(childId ~= nil, 'not found:' .. joinPath(prefix, name))
        local child = self.nodes[childId]
        local isFinal = index == #pending
        if child.kind == 'symlink' and (not isFinal or followFinal ~= false) then
            followed += 1
            expect(followed <= 24, 'symlink loop:' .. absolute)
            local replacement = canonical(child.target, prefix)
            local tail = {}
            for tailIndex = index + 1, #pending do
                table.insert(tail, pending[tailIndex])
            end
            pending = splitPath(replacement)
            for _, component in ipairs(tail) do
                table.insert(pending, component)
            end
            current = 1
            prefix = '/'
            index = 1
        else
            current = childId
            prefix = joinPath(prefix, name)
            index += 1
        end
    end
    return self.nodes[current], prefix, followed
end
function Filesystem:parent(path)
    local clean = canonical(path, self.session.cwd)
    local parent, name = parentPath(clean)
    expect(name ~= '' and name ~= '.' and name ~= '..', 'invalid basename')
    local node = self:resolve(parent)
    expect(node.kind == 'dir', 'parent not directory')
    self:requireAccess(node, 'write')
    self:requireAccess(node, 'search')
    return node, name, clean
end
function Filesystem:emit(operation, path, id, detail)
    local entry = {
        sequence = #self.journal + 1,
        operation = operation,
        path = path,
        inode = id,
        detail = detail or '',
        revision = self.revision,
    }
    table.insert(self.journal, entry)
    for _, watcher in ipairs(self.watchers) do
        if string.sub(path, 1, #watcher.prefix) == watcher.prefix then
            watcher.callback(entry)
        end
    end
end
function Filesystem:allocate(kind, owner, group, perm)
    local id = self.nextId
    self.nextId += 1
    local node = {
        id = id,
        kind = kind,
        owner = owner or self.session.user,
        group = group or 'staff',
        perm = perm or 420,
        links = 1,
        attrs = {},
        size = 0,
        version = self.revision,
    }
    if kind == 'dir' then
        node.entries = {}
    elseif kind == 'file' then
        node.chunks = {}
        node.digest = checksum('')
    else
        node.target = ''
    end
    self.nodes[id] = node
    return node
end
function Filesystem:attach(parentId, name, id)
    local directory = self:touch(parentId)
    expect(directory.entries[name] == nil, 'already exists:' .. name)
    directory.entries[name] = id
    directory.size += 1
end
function Filesystem:mkdir(path, perm)
    local parent, name, clean = self:parent(path)
    expect(parent.entries[name] == nil, 'already exists:' .. clean)
    local node = self:allocate('dir', nil, nil, perm or 493)
    self:attach(parent.id, name, node.id)
    self:emit('mkdir', clean, node.id)
    return node.id
end
function Filesystem:mkdirp(path)
    local clean = canonical(path, self.session.cwd)
    local current = '/'
    for _, name in ipairs(splitPath(clean)) do
        current = joinPath(current, name)
        local ok, node = pcall(function()
            return self:resolve(current)
        end)
        if ok then
            expect(node.kind == 'dir', 'mkdirp obstruction:' .. current)
        else
            self:mkdir(current)
        end
    end
    return self:resolve(clean).id
end
function Filesystem:create(path, text, perm)
    local parent, name, clean = self:parent(path)
    expect(parent.entries[name] == nil, 'already exists:' .. clean)
    local node = self:allocate('file', nil, nil, perm)
    node.chunks, node.size, node.digest = self.pool:put(text)
    self:attach(parent.id, name, node.id)
    self:emit('create', clean, node.id, node.digest)
    return node.id
end
function Filesystem:read(path)
    local node = self:resolve(path)
    expect(node.kind == 'file', 'not regular:' .. path)
    self:requireAccess(node, 'read')
    return self.pool:get(node.chunks), node.digest, node.id
end
function Filesystem:write(path, text)
    local node, clean = self:resolve(path)
    expect(node.kind == 'file', 'not regular:' .. path)
    self:requireAccess(node, 'write')
    node = self:touch(node.id)
    node.chunks, node.size, node.digest = self.pool:put(text)
    self:emit('write', clean, node.id, node.digest)
    return node.size, node.digest
end
function Filesystem:append(path, text)
    local original = self:read(path)
    return self:write(path, original .. text)
end
function Filesystem:patch(path, offset, removeCount, addition)
    local original = self:read(path)
    expect(offset >= 0 and offset <= #original, 'patch offset')
    expect(removeCount >= 0, 'patch count')
    local prefix = string.sub(original, 1, offset)
    local suffix = string.sub(original, offset + removeCount + 1)
    return self:write(path, prefix .. addition .. suffix)
end
function Filesystem:truncate(path, length)
    local original = self:read(path)
    expect(length >= 0, 'truncate length')
    local replacement = string.sub(original, 1, length)
    if length > #original then
        replacement ..= string.rep('\0', length - #original)
    end
    return self:write(path, replacement)
end
function Filesystem:symlink(target, path)
    local parent, name, clean = self:parent(path)
    expect(parent.entries[name] == nil, 'already exists:' .. clean)
    local node = self:allocate('symlink', nil, nil, 511)
    node.target = target
    node.size = #target
    self:attach(parent.id, name, node.id)
    self:emit('symlink', clean, node.id, target)
    return node.id
end
function Filesystem:link(source, destination)
    local node = self:resolve(source)
    expect(node.kind == 'file', 'hardlink requires file')
    local parent, name, clean = self:parent(destination)
    expect(parent.entries[name] == nil, 'already exists:' .. clean)
    self:attach(parent.id, name, node.id)
    node = self:touch(node.id)
    node.links += 1
    self:emit('link', clean, node.id, source)
    return node.id, node.links
end
function Filesystem:unlink(path)
    local parent, name, clean = self:parent(path)
    local id = parent.entries[name]
    expect(id ~= nil, 'not found:' .. clean)
    local node = self.nodes[id]
    expect(node.kind ~= 'dir' or node.size == 0, 'directory not empty:' .. clean)
    parent = self:touch(parent.id)
    parent.entries[name] = nil
    parent.size -= 1
    node = self:touch(id)
    node.links -= 1
    if node.links == 0 then
        local held = false
        for _, handle in pairs(self.openHandles) do
            if handle.inode == id then
                held = true
            end
        end
        if not held then
            self.nodes[id] = nil
        end
    end
    self:emit('unlink', clean, id)
    return id
end
function Filesystem:removeTree(path)
    local node, clean = self:resolve(path, false)
    expect(clean ~= '/', 'cannot remove root')
    if node.kind == 'dir' then
        for _, name in ipairs(sortedKeys(node.entries)) do
            self:removeTree(joinPath(clean, name))
        end
    end
    return self:unlink(clean)
end
function Filesystem:rename(source, destination)
    local sourceParent, sourceName, sourceClean = self:parent(source)
    local destinationParent, destinationName, destinationClean = self:parent(destination)
    local id = sourceParent.entries[sourceName]
    expect(id ~= nil, 'rename source missing')
    expect(destinationParent.entries[destinationName] == nil, 'rename destination exists')
    local node = self.nodes[id]
    if node.kind == 'dir' then
        expect(string.sub(destinationClean .. '/', 1, #sourceClean + 1) ~= sourceClean .. '/', 'rename cycle')
    end
    sourceParent = self:touch(sourceParent.id)
    sourceParent.entries[sourceName] = nil
    sourceParent.size -= 1
    destinationParent = self:touch(destinationParent.id)
    destinationParent.entries[destinationName] = id
    destinationParent.size += 1
    self:emit('rename', destinationClean, id, sourceClean)
    return id
end
function Filesystem:chmod(path, permission)
    local node, clean = self:resolve(path, false)
    expect(self.session.user == 'root' or node.owner == self.session.user, 'chmod owner')
    expect(permission >= 0 and permission < 512, 'chmod bits')
    node = self:touch(node.id)
    node.perm = permission
    self:emit('chmod', clean, node.id, tostring(permission))
end
function Filesystem:chown(path, owner, group)
    expect(self.session.user == 'root', 'chown root')
    local node, clean = self:resolve(path, false)
    node = self:touch(node.id)
    node.owner = owner
    node.group = group
    self:emit('chown', clean, node.id, owner .. ':' .. group)
end
function Filesystem:setattr(path, key, value)
    local node, clean = self:resolve(path, false)
    self:requireAccess(node, 'write')
    node = self:touch(node.id)
    node.attrs[key] = value
    self:emit('attr', clean, node.id, key .. '=' .. tostring(value))
end
function Filesystem:asUser(user, groups, callback)
    local previous = self.session
    local groupSet = {}
    for _, group in ipairs(groups) do
        groupSet[group] = true
    end
    self.session = { user = user, groups = groupSet, cwd = previous.cwd }
    local result = table.pack(pcall(callback, self))
    self.session = previous
    if not result[1] then
        error(result[2], 0)
    end
    return table.unpack(result, 2, result.n)
end
function Filesystem:chdir(path)
    local node, clean = self:resolve(path)
    expect(node.kind == 'dir', 'cwd not directory')
    self:requireAccess(node, 'search')
    self.session.cwd = clean
    return clean
end
function Filesystem:snapshot(name)
    expect(self.snapshots[name] == nil, 'snapshot exists')
    self.snapshots[name] = {
        nodes = copyMap(self.nodes),
        nextId = self.nextId,
        clock = self.clock,
        revision = self.revision,
        journalLength = #self.journal,
    }
    self.revision += 1
    return self.snapshots[name]
end
function Filesystem:restore(name)
    local snapshot = self.snapshots[name]
    expect(snapshot ~= nil, 'snapshot missing')
    expect(next(self.openHandles) == nil, 'open handles block restore')
    self.nodes = copyMap(snapshot.nodes)
    self.nextId = snapshot.nextId
    self.clock = snapshot.clock
    self.revision += 1
    self:emit('restore', '/', 1, name)
end
function Filesystem:transaction(label, callback)
    local before = {
        nodes = copyMap(self.nodes),
        nextId = self.nextId,
        clock = self.clock,
        journalLength = #self.journal,
    }
    self.revision += 1
    local result = table.pack(pcall(callback, self))
    if result[1] then
        self:emit('commit', '/', 1, label)
        self.revision += 1
        return true, table.unpack(result, 2, result.n)
    end
    self.nodes = before.nodes
    self.nextId = before.nextId
    self.clock = before.clock
    while #self.journal > before.journalLength do
        table.remove(self.journal)
    end
    self.revision += 1
    self:emit('rollback', '/', 1, label)
    return false, result[2]
end
function Filesystem:walk(path, predicate)
    local root, clean = self:resolve(path, false)
    local stack = { { path = clean, id = root.id, depth = 0 } }
    return function()
        while #stack > 0 do
            local item = table.remove(stack)
            local node = self.nodes[item.id]
            if node.kind == 'dir' then
                local names = sortedKeys(node.entries)
                for index = #names, 1, -1 do
                    local name = names[index]
                    table.insert(stack, {
                        path = joinPath(item.path, name),
                        id = node.entries[name],
                        depth = item.depth + 1,
                    })
                end
            end
            if predicate == nil or predicate(item.path, node, item.depth) then
                return item.path, node, item.depth
            end
        end
        return nil
    end
end
function Filesystem:list(path)
    local node = self:resolve(path)
    expect(node.kind == 'dir', 'list not directory')
    self:requireAccess(node, 'read')
    local result = {}
    for _, name in ipairs(sortedKeys(node.entries)) do
        local child = self.nodes[node.entries[name]]
        table.insert(result, { name = name, kind = child.kind, id = child.id, size = child.size })
    end
    return result
end
function Filesystem:watch(prefix, callback)
    local watcher = { prefix = prefix, callback = callback }
    table.insert(self.watchers, watcher)
    return function()
        for index, candidate in ipairs(self.watchers) do
            if candidate == watcher then
                table.remove(self.watchers, index)
                return true
            end
        end
        return false
    end
end
function Filesystem:open(path, writable)
    local node = self:resolve(path)
    expect(node.kind == 'file', 'open not regular')
    self:requireAccess(node, writable and 'write' or 'read')
    local id = self.nextHandle
    self.nextHandle += 1
    local handle = { id = id, inode = node.id, offset = 0, writable = writable, closed = false }
    self.openHandles[id] = handle
    local filesystem = self
    local methods = {}
    function methods:read(count)
        expect(not handle.closed, 'closed handle')
        local current = filesystem.nodes[handle.inode]
        local text = filesystem.pool:range(current.chunks, handle.offset, count)
        handle.offset += #text
        return text, handle.offset
    end
    function methods:seek(offset, origin)
        expect(not handle.closed, 'closed handle')
        local current = filesystem.nodes[handle.inode]
        local base = origin == 'end' and current.size or (origin == 'current' and handle.offset or 0)
        expect(base + offset >= 0, 'negative seek')
        handle.offset = base + offset
        return handle.offset
    end
    function methods:write(text)
        expect(not handle.closed and handle.writable, 'handle not writable')
        local current = filesystem:touch(handle.inode)
        local previous = filesystem.pool:get(current.chunks)
        if handle.offset > #previous then
            previous ..= string.rep('\0', handle.offset - #previous)
        end
        local replacement = string.sub(previous, 1, handle.offset) .. text .. string.sub(previous, handle.offset + #text + 1)
        current.chunks, current.size, current.digest = filesystem.pool:put(replacement)
        handle.offset += #text
        filesystem:emit('handle-write', '#inode/' .. tostring(current.id), current.id, current.digest)
        return #text, handle.offset
    end
    function methods:close()
        if handle.closed then
            return false
        end
        handle.closed = true
        filesystem.openHandles[handle.id] = nil
        local current = filesystem.nodes[handle.inode]
        if current.links == 0 then
            filesystem.nodes[handle.inode] = nil
        end
        return true
    end
    return setmetatable({}, { __index = methods, __tostring = function()
        return 'handle:' .. tostring(handle.id) .. ':' .. tostring(handle.inode)
    end })
end
function Filesystem:liveChunks(includeSnapshots)
    local live = {}
    local function visit(nodes)
        for _, node in pairs(nodes) do
            if node.chunks then
                for _, key in ipairs(node.chunks) do
                    live[key] = (live[key] or 0) + 1
                end
            end
        end
    end
    visit(self.nodes)
    if includeSnapshots then
        for _, name in ipairs(sortedKeys(self.snapshots)) do
            visit(self.snapshots[name].nodes)
        end
    end
    return live
end
function Filesystem:usage(path)
    local seen = {}
    local logical = 0
    local unique = 0
    local files = 0
    local directories = 0
    local symlinks = 0
    for _, node in self:walk(path) do
        if node.kind == 'file' then
            files += 1
            logical += node.size
            if not seen[node.id] then
                unique += node.size
                seen[node.id] = true
            end
        elseif node.kind == 'dir' then
            directories += 1
        else
            symlinks += 1
        end
    end
    return logical, unique, files, directories, symlinks
end
function Filesystem:verify()
    local links = { [1] = 1 }
    local directories = {}
    local reachable = {}
    local function visit(id)
        local node = self.nodes[id]
        expect(node ~= nil, 'dangling inode')
        reachable[id] = true
        if node.kind == 'dir' then
            expect(not directories[id], 'directory cycle')
            directories[id] = true
            local count = 0
            for _, name in ipairs(sortedKeys(node.entries)) do
                expect(name ~= '' and not string.find(name, '/', 1, true), 'invalid entry')
                local child = node.entries[name]
                links[child] = (links[child] or 0) + 1
                visit(child)
                count += 1
            end
            expect(count == node.size, 'directory size')
        elseif node.kind == 'file' then
            local contents = self.pool:get(node.chunks)
            expect(#contents == node.size, 'file size')
            expect(checksum(contents) == node.digest, 'file checksum')
        else
            expect(node.kind == 'symlink', 'unknown inode kind')
            expect(#node.target == node.size, 'symlink size')
        end
    end
    visit(1)
    local count = 0
    local fingerprint = 0
    for _, id in ipairs(sortedKeys(self.nodes)) do
        local node = self.nodes[id]
        expect((links[id] or 0) == node.links, 'link count:' .. tostring(id))
        expect(reachable[id] or node.links == 0, 'unreachable inode')
        count += 1
        fingerprint = foldNumber(fingerprint, id * 7 + node.size * 11 + node.links)
    end
    return count, fingerprint
end
local Manifest = {}
function Manifest.capture(fs, root)
    local manifest = { version = 1, root = root, entries = {}, inodes = {}, chunks = {} }
    local identity = {}
    local nextIdentity = 1
    for path, node, depth in fs:walk(root) do
        local relative = path == root and '.' or string.sub(path, #root + (root == '/' and 0 or 1) + 1)
        if root == '/' and path ~= '/' then
            relative = string.sub(path, 2)
        end
        if not identity[node.id] then
            identity[node.id] = nextIdentity
            nextIdentity += 1
            local inode = {
                identity = identity[node.id],
                kind = node.kind,
                owner = node.owner,
                group = node.group,
                perm = node.perm,
                size = node.size,
                attrs = copyMap(node.attrs),
                chunks = node.chunks and copyArray(node.chunks) or nil,
                digest = node.digest,
                target = node.target,
            }
            manifest.inodes[inode.identity] = inode
            if inode.chunks then
                for _, key in ipairs(inode.chunks) do
                    manifest.chunks[key] = fs.pool.data[key]
                end
            end
        end
        table.insert(manifest.entries, { path = relative, identity = identity[node.id], depth = depth })
    end
    return manifest
end
function Manifest.encode(manifest)
    local output = { record('ARCHIVE', { manifest.version, manifest.root }) }
    for _, key in ipairs(sortedKeys(manifest.chunks)) do
        table.insert(output, record('CHUNK', { key, manifest.chunks[key] }))
    end
    for _, id in ipairs(sortedKeys(manifest.inodes)) do
        local inode = manifest.inodes[id]
        table.insert(output, record('INODE', { id, inode.kind, inode.owner, inode.group, inode.perm, inode.size }))
        for _, key in ipairs(sortedKeys(inode.attrs)) do
            table.insert(output, record('ATTR', { id, key, inode.attrs[key] }))
        end
        if inode.kind == 'file' then
            table.insert(output, record('DATA', { id, inode.digest, table.concat(inode.chunks, ',') }))
        elseif inode.kind == 'symlink' then
            table.insert(output, record('TARGET', { id, inode.target }))
        end
    end
    for _, entry in ipairs(manifest.entries) do
        table.insert(output, record('ENTRY', { entry.path, entry.identity, entry.depth }))
    end
    local payload = table.concat(output, '\n') .. '\n'
    return payload .. record('SEAL', { checksum(payload), #manifest.entries }) .. '\n'
end
function Manifest.decode(encoded)
    local input = linesOf(encoded)
    expect(#input >= 2, 'archive too short')
    local sealFields = fields(input[#input])
    expect(sealFields[1] == 'SEAL' and #sealFields == 3, 'missing seal')
    local payloadLines = {}
    for index = 1, #input - 1 do
        table.insert(payloadLines, input[index])
    end
    local payload = table.concat(payloadLines, '\n') .. '\n'
    expect(checksum(payload) == unescape(sealFields[2]), 'archive seal mismatch')
    local manifest = { entries = {}, inodes = {}, chunks = {} }
    local seenPaths = {}
    for lineIndex = 1, #input - 1 do
        local values = fields(input[lineIndex])
        local kind = table.remove(values, 1)
        for index, value in ipairs(values) do
            values[index] = unescape(value)
        end
        if kind == 'ARCHIVE' then
            expect(lineIndex == 1 and #values == 2, 'archive header')
            manifest.version = tonumber(values[1])
            manifest.root = values[2]
            expect(manifest.version == 1, 'archive version')
        elseif kind == 'CHUNK' then
            expect(#values == 2 and manifest.chunks[values[1]] == nil, 'duplicate chunk')
            local expected = checksum(values[2]) .. ':' .. tostring(#values[2])
            expect(string.sub(values[1], 1, #expected) == expected, 'chunk checksum')
            manifest.chunks[values[1]] = values[2]
        elseif kind == 'INODE' then
            local id = tonumber(values[1])
            expect(#values == 6 and id ~= nil and manifest.inodes[id] == nil, 'invalid inode')
            expect(values[2] == 'file' or values[2] == 'dir' or values[2] == 'symlink', 'inode kind')
            manifest.inodes[id] = {
                identity = id,
                kind = values[2],
                owner = values[3],
                group = values[4],
                perm = tonumber(values[5]),
                size = tonumber(values[6]),
                attrs = {},
            }
        elseif kind == 'ATTR' then
            local inode = manifest.inodes[tonumber(values[1])]
            expect(inode ~= nil and #values == 3, 'attribute inode')
            expect(inode.attrs[values[2]] == nil, 'duplicate attribute')
            inode.attrs[values[2]] = values[3]
        elseif kind == 'DATA' then
            local inode = manifest.inodes[tonumber(values[1])]
            expect(inode ~= nil and inode.kind == 'file' and inode.chunks == nil, 'data inode')
            inode.digest = values[2]
            inode.chunks = {}
            for key in string.gmatch(values[3], '[^,]+') do
                expect(manifest.chunks[key] ~= nil, 'data chunk missing')
                table.insert(inode.chunks, key)
            end
            local fragments = {}
            for _, key in ipairs(inode.chunks) do
                table.insert(fragments, manifest.chunks[key])
            end
            local contents = table.concat(fragments)
            expect(#contents == inode.size and checksum(contents) == inode.digest, 'inode data mismatch')
        elseif kind == 'TARGET' then
            local inode = manifest.inodes[tonumber(values[1])]
            expect(inode ~= nil and inode.kind == 'symlink', 'target inode')
            expect(#values[2] == inode.size, 'target size')
            inode.target = values[2]
        elseif kind == 'ENTRY' then
            expect(#values == 3 and not seenPaths[values[1]], 'duplicate path')
            expect(values[1] == '.' or canonical('/' .. values[1], '/') == '/' .. values[1], 'unsafe path')
            local id = tonumber(values[2])
            expect(manifest.inodes[id] ~= nil, 'entry inode missing')
            seenPaths[values[1]] = true
            table.insert(manifest.entries, { path = values[1], identity = id, depth = tonumber(values[3]) })
        else
            fail('unknown record:' .. tostring(kind))
        end
    end
    expect(#manifest.entries == tonumber(sealFields[3]), 'entry count mismatch')
    expect(manifest.entries[1].path == '.', 'root entry missing')
    return manifest
end
function Manifest.install(manifest, fs, destination)
    fs:mkdirp(destination)
    local identities = {}
    local deferred = {}
    local function metadata(path, inode)
        fs:chown(path, inode.owner, inode.group)
        fs:chmod(path, inode.perm)
        for _, key in ipairs(sortedKeys(inode.attrs)) do
            fs:setattr(path, key, inode.attrs[key])
        end
    end
    for _, entry in ipairs(manifest.entries) do
        local path = entry.path == '.' and destination or joinPath(destination, entry.path)
        local inode = manifest.inodes[entry.identity]
        if entry.path == '.' then
            expect(inode.kind == 'dir', 'manifest root not directory')
            identities[entry.identity] = path
            table.insert(deferred, { path = path, inode = inode })
        elseif identities[entry.identity] then
            fs:link(identities[entry.identity], path)
        elseif inode.kind == 'dir' then
            fs:mkdir(path)
            identities[entry.identity] = path
            table.insert(deferred, { path = path, inode = inode })
        elseif inode.kind == 'file' then
            local chunks = {}
            for _, key in ipairs(inode.chunks) do
                table.insert(chunks, manifest.chunks[key])
            end
            fs:create(path, table.concat(chunks), inode.perm)
            identities[entry.identity] = path
            metadata(path, inode)
        else
            fs:symlink(inode.target, path)
            identities[entry.identity] = path
            metadata(path, inode)
        end
    end
    for index = #deferred, 1, -1 do
        metadata(deferred[index].path, deferred[index].inode)
    end
    return identities
end
function Manifest.describe(manifest)
    local aliases = {}
    for _, entry in ipairs(manifest.entries) do
        aliases[entry.identity] = (aliases[entry.identity] or 0) + 1
    end
    local files = 0
    local bytes = 0
    local links = 0
    local names = {}
    for _, id in ipairs(sortedKeys(manifest.inodes)) do
        local node = manifest.inodes[id]
        if node.kind == 'file' then
            files += 1
            bytes += node.size
            links += aliases[id] - 1
        end
        table.insert(names, tostring(id) .. ':' .. node.kind .. ':' .. tostring(node.size))
    end
    return files, bytes, links, checksum(table.concat(names, ';'))
end
local function pathIndex(manifest)
    local index = {}
    for _, entry in ipairs(manifest.entries) do
        local inode = manifest.inodes[entry.identity]
        index[entry.path] = {
            kind = inode.kind,
            signature = table.concat({ inode.kind, inode.owner, inode.group, tostring(inode.perm), inode.digest or inode.target or '' }, ':'),
            inode = inode,
            identity = entry.identity,
        }
    end
    return index
end
local function compareManifests(left, right)
    local before = pathIndex(left)
    local after = pathIndex(right)
    local paths = copyMap(before)
    for path, value in pairs(after) do
        paths[path] = value
    end
    local changes = {}
    local counts = { add = 0, remove = 0, modify = 0, same = 0 }
    for _, path in ipairs(sortedKeys(paths)) do
        local old = before[path]
        local new = after[path]
        local operation = 'same'
        if old == nil then
            operation = 'add'
        elseif new == nil then
            operation = 'remove'
        elseif old.signature ~= new.signature then
            operation = 'modify'
        end
        counts[operation] += 1
        if operation ~= 'same' then
            table.insert(changes, { operation = operation, path = path, before = old, after = new })
        end
    end
    return changes, counts
end
local function globMatch(pattern, text)
    local memo = {}
    local function match(pi, ti)
        local key = pi .. ':' .. ti
        if memo[key] ~= nil then
            return memo[key]
        end
        local result
        if pi > #pattern then
            result = ti > #text
        else
            local token = string.sub(pattern, pi, pi)
            local char = string.sub(text, ti, ti)
            if token == '*' then
                local recursive = string.sub(pattern, pi + 1, pi + 1) == '*'
                local advance = recursive and 2 or 1
                result = match(pi + advance, ti)
                if not result and ti <= #text and (recursive or char ~= '/') then
                    result = match(pi, ti + 1)
                end
            elseif token == '?' then
                result = ti <= #text and char ~= '/' and match(pi + 1, ti + 1)
            else
                result = ti <= #text and token == char and match(pi + 1, ti + 1)
            end
        end
        memo[key] = result
        return result
    end
    return match(1, 1)
end
local Query = {}
Query.__index = Query
function Query.new(fs, root)
    return setmetatable({ fs = fs, root = root, rules = {}, projection = function(path, node)
        return path, node.size
    end }, Query)
end
function Query:where(predicate)
    table.insert(self.rules, predicate)
    return self
end
function Query:kind(kind)
    return self:where(function(_, node)
        return node.kind == kind
    end)
end
function Query:glob(pattern)
    return self:where(function(path)
        return globMatch(pattern, path)
    end)
end
function Query:minimum(size)
    return self:where(function(_, node)
        return node.size >= size
    end)
end
function Query:attribute(key, value)
    return self:where(function(_, node)
        return node.attrs[key] == value
    end)
end
function Query:select(projection)
    self.projection = projection
    return self
end
function Query:run()
    local rows = {}
    for path, node, depth in self.fs:walk(self.root) do
        local accepted = true
        for _, rule in ipairs(self.rules) do
            if not rule(path, node, depth) then
                accepted = false
                break
            end
        end
        if accepted then
            table.insert(rows, table.pack(self.projection(path, node, depth)))
        end
    end
    return rows
end
local SearchIndex = {}
SearchIndex.__index = SearchIndex
function SearchIndex.new()
    return setmetatable({ words = {}, documents = {}, totals = {} }, SearchIndex)
end
function SearchIndex:add(path, text, identity)
    local counts = {}
    local length = 0
    for word in string.gmatch(string.lower(text), '[%w_]+') do
        counts[word] = (counts[word] or 0) + 1
        length += 1
    end
    self.documents[path] = { identity = identity, length = length, counts = counts }
    for _, word in ipairs(sortedKeys(counts)) do
        local posting = self.words[word] or {}
        posting[path] = counts[word]
        self.words[word] = posting
        self.totals[word] = (self.totals[word] or 0) + counts[word]
    end
end
function SearchIndex:remove(path)
    local document = self.documents[path]
    if document == nil then
        return false
    end
    for word, count in pairs(document.counts) do
        self.words[word][path] = nil
        self.totals[word] -= count
        if next(self.words[word]) == nil then
            self.words[word] = nil
            self.totals[word] = nil
        end
    end
    self.documents[path] = nil
    return true
end
function SearchIndex:build(fs, root)
    for path, node in fs:walk(root) do
        if node.kind == 'file' then
            self:add(path, fs:read(path), node.id)
        end
    end
    return self
end
function SearchIndex:search(words, requireAll)
    local scores = {}
    local matches = {}
    for _, word in ipairs(words) do
        local posting = self.words[string.lower(word)] or {}
        for path, count in pairs(posting) do
            local document = self.documents[path]
            scores[path] = (scores[path] or 0) + math.floor(1000 * count / math.max(1, document.length))
            matches[path] = (matches[path] or 0) + 1
        end
    end
    local rows = {}
    for _, path in ipairs(sortedKeys(scores)) do
        if not requireAll or matches[path] == #words then
            table.insert(rows, { path = path, score = scores[path], matches = matches[path] })
        end
    end
    table.sort(rows, function(a, b)
        if a.score == b.score then
            return a.path < b.path
        end
        return a.score > b.score
    end)
    return rows
end
function SearchIndex:popular(limit)
    local rows = {}
    for word, count in pairs(self.totals) do
        table.insert(rows, { word = word, count = count })
    end
    table.sort(rows, function(a, b)
        if a.count == b.count then
            return a.word < b.word
        end
        return a.count > b.count
    end)
    local output = {}
    for index = 1, math.min(limit, #rows) do
        table.insert(output, rows[index].word .. '=' .. tostring(rows[index].count))
    end
    return table.concat(output, ',')
end
local function inventory(fs, root)
    local owners = {}
    local extensions = {}
    local depths = {}
    local aliases = {}
    for path, node, depth in fs:walk(root) do
        depths[depth] = (depths[depth] or 0) + 1
        if node.kind == 'file' then
            local owner = owners[node.owner] or { bytes = 0, files = 0, unique = 0, seen = {} }
            owner.bytes += node.size
            owner.files += 1
            if not owner.seen[node.id] then
                owner.seen[node.id] = true
                owner.unique += node.size
            end
            owners[node.owner] = owner
            local extension = string.match(path, '%.([^./]+)$') or '(none)'
            extensions[extension] = (extensions[extension] or 0) + node.size
            local names = aliases[node.id] or {}
            table.insert(names, path)
            aliases[node.id] = names
        end
    end
    return owners, extensions, depths, aliases
end
local function structuralSignature(fs, root)
    local records = {}
    local aliases = {}
    local nextAlias = 1
    for path, node in fs:walk(root) do
        if not aliases[node.id] then
            aliases[node.id] = nextAlias
            nextAlias += 1
        end
        local relative = path == root and '.' or string.sub(path, #root + 2)
        local attributes = {}
        for _, key in ipairs(sortedKeys(node.attrs)) do
            table.insert(attributes, escape(key) .. '=' .. escape(node.attrs[key]))
        end
        table.insert(records, table.concat({
            relative,
            node.kind,
            tostring(aliases[node.id]),
            node.owner,
            node.group,
            tostring(node.perm),
            node.digest or node.target or '',
            table.concat(attributes, ','),
        }, '|'))
    end
    return checksum(table.concat(records, '\n'))
end
local function enforceQuota(fs, root, limits)
    local owners = inventory(fs, root)
    local violations = {}
    for _, owner in ipairs(sortedKeys(owners)) do
        local usage = owners[owner]
        local limit = limits[owner] or math.huge
        if usage.unique > limit then
            table.insert(violations, owner .. ':' .. tostring(usage.unique - limit))
        end
    end
    return violations
end
local function auditPermissions(fs, root)
    local findings = {}
    for path, node in fs:walk(root) do
        local other = node.perm % 8
        local group = math.floor(node.perm / 8) % 8
        if hasBit(other, 2) then
            table.insert(findings, 'public-write:' .. path)
        end
        if node.kind == 'file' and hasBit(other, 1) then
            table.insert(findings, 'public-execute:' .. path)
        end
        if node.attrs.classification == 'private' and hasBit(group, 4) then
            table.insert(findings, 'private-group-read:' .. path)
        end
    end
    table.sort(findings)
    return findings
end
local function summarizeJournal(journal)
    local counts = {}
    local touched = {}
    local sequence = 0
    for _, entry in ipairs(journal) do
        counts[entry.operation] = (counts[entry.operation] or 0) + 1
        touched[entry.inode] = true
        sequence = foldNumber(sequence, entry.sequence + entry.inode + #entry.path + #entry.detail)
    end
    local rows = {}
    for _, name in ipairs(sortedKeys(counts)) do
        table.insert(rows, name .. '=' .. tostring(counts[name]))
    end
    return table.concat(rows, ','), #sortedKeys(touched), sequence
end
local function buildDocument(project, index, salt)
    local words = { 'amber', 'birch', 'cobalt', 'delta', 'ember', 'fern', 'granite', 'harbor' }
    local rows = { 'project ' .. project .. ' document ' .. tostring(index), 'shared archive header' }
    local repetitions = 3 + ((index + salt) % 4)
    for line = 1, repetitions do
        local first = words[((index * 3 + line + salt) % #words) + 1]
        local second = words[((index + line * 2 - salt) % #words) + 1]
        table.insert(rows, first .. ' ' .. second .. ' archive revision ' .. tostring((index + line + salt) % 11))
    end
    table.insert(rows, 'footer shared archive')
    return table.concat(rows, '\n') .. '\n'
end
local function inspectSnapshot(fs, name, path)
    local saved = fs.nodes
    local session = fs.session
    local snapshot = fs.snapshots[name]
    fs.nodes = snapshot.nodes
    fs.session = { user = 'root', groups = { staff = true }, cwd = '/' }
    local ok, result = pcall(function()
        return structuralSignature(fs, path)
    end)
    fs.nodes = saved
    fs.session = session
    expect(ok, tostring(result))
    return result
end
local pool = ChunkStore.new(32)
local fs = Filesystem.new(pool)
local salt = (seed * 17 + mode * 23) % 97
local watched = { count = 0, folded = 0, operations = {} }
local stopWatching = fs:watch('/projects', function(entry)
    watched.count += 1
    watched.folded = foldNumber(watched.folded, #entry.path + entry.inode + #entry.operation)
    watched.operations[entry.operation] = (watched.operations[entry.operation] or 0) + 1
end)
fs:mkdirp('/projects')
fs:mkdirp('/shared/templates')
fs:mkdirp('/archive/staging')
fs:mkdirp('/scratch')
fs:create('/shared/templates/banner.txt', 'shared archive header\nfooter shared archive\n')
fs:chmod('/scratch', 511)
local projects = { 'aster', 'boreal', 'cedar', 'dune' }
local owners = { 'ada', 'bert', 'cyra', 'dara' }
local documentCount = 5 + mode % 3
for projectIndex, project in ipairs(projects) do
    local root = '/projects/' .. project
    fs:mkdirp(root .. '/docs')
    fs:mkdirp(root .. '/links')
    fs:mkdirp(root .. '/private')
    fs:chown(root, owners[projectIndex], 'staff')
    fs:chown(root .. '/docs', owners[projectIndex], 'staff')
    fs:chmod(root .. '/docs', 509)
    for index = 1, documentCount do
        local path = root .. '/docs/note-' .. tostring(index) .. '.txt'
        local contents = buildDocument(project, index, salt + projectIndex)
        fs:create(path, contents)
        fs:chown(path, owners[projectIndex], 'staff')
        fs:setattr(path, 'project', project)
        fs:setattr(path, 'rank', tostring((index * 7 + salt) % 19))
        fs:setattr(path, 'classification', index % 3 == 0 and 'private' or 'public')
        if index % 2 == 0 then
            fs:link(path, root .. '/links/copy-' .. tostring(index) .. '.txt')
        end
    end
    fs:create(root .. '/private/key.bin', string.char(0, projectIndex, 255) .. tostring(salt) .. '|%\n')
    fs:chown(root .. '/private/key.bin', owners[projectIndex], 'secure')
    fs:chmod(root .. '/private/key.bin', 384)
    fs:chmod(root .. '/private', 448)
    fs:symlink('../docs/note-1.txt', root .. '/links/current')
    fs:symlink('/shared/templates/banner.txt', root .. '/links/banner')
    fs:setattr(root, 'retention', tostring(3 + projectIndex))
end
fs:symlink('/projects/aster', '/current')
fs:symlink('loop-b', '/scratch/loop-a')
fs:symlink('loop-a', '/scratch/loop-b')
local initialCount, initialFingerprint = fs:verify()
local initialSignature = structuralSignature(fs, '/projects')
fs:snapshot('baseline')
local initialManifest = Manifest.capture(fs, '/projects')
local initialArchive = Manifest.encode(initialManifest)
report('start', seed, mode, salt, documentCount)
report('initial', initialCount, initialFingerprint, initialSignature, #initialArchive, checksum(initialArchive))
report('usage-initial', fs:usage('/projects'))
local aliasNode = fs:resolve('/projects/aster/links/copy-2.txt')
local originalNode = fs:resolve('/projects/aster/docs/note-2.txt')
expect(aliasNode == originalNode, 'initial hardlink identity')
local beforeAlias = originalNode.digest
fs:append('/projects/aster/links/copy-2.txt', 'alias update ' .. tostring(seed) .. '\n')
local updatedNode = fs:resolve('/projects/aster/docs/note-2.txt')
expect(updatedNode.digest ~= beforeAlias, 'hardlink mutation missing')
expect(updatedNode == fs:resolve('/projects/aster/links/copy-2.txt'), 'hardlink identity lost')
expect(fs.snapshots.baseline.nodes[originalNode.id] ~= updatedNode, 'snapshot clone absent')
expect(fs.snapshots.baseline.nodes[originalNode.id].digest == beforeAlias, 'snapshot mutation')
report('alias', updatedNode.id, updatedNode.links, beforeAlias, updatedNode.digest)
local throughLink, linkDigest, linkId = fs:read('/current/links/current')
report('symlink-read', #throughLink, linkDigest, linkId)
local cycleOk, cycleError = pcall(function()
    return fs:read('/scratch/loop-a')
end)
expect(not cycleOk, 'symlink cycle accepted')
report('symlink-cycle', cycleOk, cycleError)
local denialOk, denialError = pcall(function()
    return fs:asUser('guest', {}, function(view)
        return view:read('/projects/aster/private/key.bin')
    end)
end)
expect(not denialOk, 'private traversal accepted')
report('permission-denied', denialOk, denialError)
local ownerRead = fs:asUser('ada', { 'staff' }, function(view)
    local text = view:read('/projects/aster/docs/note-1.txt')
    view:append('/projects/aster/docs/note-1.txt', 'owner authorized\n')
    return checksum(text)
end)
report('owner-write', ownerRead)
local rollbackBefore = structuralSignature(fs, '/projects')
local rolled, rollbackReason = fs:transaction('reject-overwrite', function(view)
    view:create('/projects/aster/docs/temporary.txt', 'temporary transaction')
    view:append('/projects/boreal/docs/note-1.txt', 'must rollback\n')
    view:rename('/projects/cedar/docs', '/projects/cedar/docs/nested')
end)
expect(not rolled, 'transaction unexpectedly committed')
expect(structuralSignature(fs, '/projects') == rollbackBefore, 'rollback changed structure')
report('rollback', rolled, rollbackReason)
local committed, renamedId, patchSize = fs:transaction('reorganize', function(view)
    local id = view:rename('/projects/dune/docs/note-1.txt', '/projects/dune/docs/overview.txt')
    local size = view:patch('/projects/boreal/docs/note-3.txt', 8, 7, 'patched-' .. tostring(salt))
    view:create('/projects/cedar/docs/new.txt', buildDocument('cedar', 19, salt))
    view:unlink('/projects/cedar/links/copy-2.txt')
    return id, size
end)
expect(committed, 'transaction rejected')
report('commit', committed, renamedId, patchSize)
fs:chdir('/projects/aster/docs')
local relativeText, relativeDigest = fs:read('./../docs/note-1.txt')
report('relative', #relativeText, relativeDigest, fs.session.cwd)
fs:chdir('/')
local handle = fs:open('/projects/boreal/docs/note-2.txt', true)
local opening = handle:read(13)
local seeked = handle:seek(-5, 'end')
local written, afterWrite = handle:write('HANDLE-' .. tostring(mode))
handle:seek(0, 'start')
local handleText = handle:read(23)
report('handle', tostring(handle), checksum(opening), seeked, written, afterWrite, checksum(handleText))
expect(handle:close() and not handle:close(), 'handle close state')
fs:create('/scratch/orphan.txt', 'open orphan payload')
local orphan = fs:open('/scratch/orphan.txt', false)
local orphanId = fs:resolve('/scratch/orphan.txt').id
fs:unlink('/scratch/orphan.txt')
expect(fs.nodes[orphanId] ~= nil, 'open orphan collected')
report('orphan', orphan:read(40))
orphan:close()
expect(fs.nodes[orphanId] == nil, 'closed orphan retained')
fs:create('/scratch/padded.bin', 'abcdef')
fs:truncate('/scratch/padded.bin', 11 + mode)
fs:patch('/scratch/padded.bin', 2, 3, string.char(1, 2, 3))
local padded = fs:read('/scratch/padded.bin')
report('padded', #padded, escape(padded), checksum(padded))
local filtered = Query.new(fs, '/projects'):kind('file'):glob('/projects/**/note-?.txt'):minimum(160):select(function(path, node, depth)
    return path, node.size, node.digest, depth, node.links
end):run()
local filteredFold = 0
for _, row in ipairs(filtered) do
    filteredFold = foldNumber(filteredFold, row[2] + row[4] * 7 + row[5] * 11)
    report('query', table.unpack(row, 1, row.n))
end
report('query-total', #filtered, filteredFold)
local selected = Query.new(fs, '/projects'):kind('file'):attribute('classification', 'private'):run()
report('classified', #selected)
local search = SearchIndex.new():build(fs, '/projects')
local searchRows = search:search({ 'archive', 'amber' }, true)
for index = 1, math.min(7, #searchRows) do
    local row = searchRows[index]
    report('search', index, row.path, row.score, row.matches)
end
report('popular', search:popular(12))
local removedSearch = search:remove('/projects/aster/docs/note-1.txt')
search:add('/projects/aster/docs/note-1.txt', fs:read('/projects/aster/docs/note-1.txt'), fs:resolve('/projects/aster/docs/note-1.txt').id)
report('search-refresh', removedSearch, #search:search({ 'owner', 'authorized' }, true))
local ownerInventory, extensions, depths, aliases = inventory(fs, '/projects')
for _, owner in ipairs(sortedKeys(ownerInventory)) do
    local row = ownerInventory[owner]
    report('owner', owner, row.files, row.bytes, row.unique)
end
for _, extension in ipairs(sortedKeys(extensions)) do
    report('extension', extension, extensions[extension])
end
for _, depth in ipairs(sortedKeys(depths)) do
    report('depth', depth, depths[depth])
end
for _, id in ipairs(sortedKeys(aliases)) do
    if #aliases[id] > 1 then
        report('hardlinks', id, table.concat(aliases[id], ','))
    end
end
local violations = enforceQuota(fs, '/projects', { ada = 850 + salt, bert = 900, cyra = 1100, dara = 800 })
report('quota', #violations, table.concat(violations, ','))
local audit = auditPermissions(fs, '/projects')
report('permission-audit', #audit, checksum(table.concat(audit, '\n')))
for index = 1, math.min(4, #audit) do
    report('audit-item', audit[index])
end
fs:snapshot('edited')
local editedSignature = structuralSignature(fs, '/projects')
local editedManifest = Manifest.capture(fs, '/projects')
local encoded = Manifest.encode(editedManifest)
local decoded = Manifest.decode(encoded)
expect(Manifest.encode(decoded) == encoded, 'archive canonical roundtrip')
report('archive', #encoded, checksum(encoded), Manifest.describe(decoded))
local changes, changeCounts = compareManifests(initialManifest, editedManifest)
for _, change in ipairs(changes) do
    report('change', change.operation, change.path, change.before and change.before.kind or '-', change.after and change.after.kind or '-')
end
report('diff', changeCounts.add, changeCounts.remove, changeCounts.modify, changeCounts.same)
local damaged = string.sub(encoded, 1, #encoded - 2) .. 'x\n'
local damageOk, damageReason = pcall(Manifest.decode, damaged)
expect(not damageOk, 'damaged archive accepted')
report('archive-reject', damageOk, damageReason)
local restoredPool = ChunkStore.new(32)
local restored = Filesystem.new(restoredPool)
Manifest.install(decoded, restored, '/restored')
local restoreSignature = structuralSignature(restored, '/restored')
expect(restoreSignature == editedSignature, 'installed archive differs')
local restoredCount, restoredFingerprint = restored:verify()
report('installed', restoreSignature, restoredCount, restoredFingerprint, restored:usage('/restored'))
local restoredAlias = restored:resolve('/restored/aster/links/copy-2.txt')
local restoredOriginal = restored:resolve('/restored/aster/docs/note-2.txt')
expect(restoredAlias == restoredOriginal, 'archive hardlinks lost')
restored:append('/restored/aster/links/copy-2.txt', 'restored alias write\n')
expect(restored:read('/restored/aster/docs/note-2.txt') == restored:read('/restored/aster/links/copy-2.txt'), 'restored alias write lost')
report('installed-alias', restoredOriginal.id, restored:resolve('/restored/aster/docs/note-2.txt').digest)
local baselineView = inspectSnapshot(fs, 'baseline', '/projects')
local editedView = inspectSnapshot(fs, 'edited', '/projects')
expect(baselineView == initialSignature and editedView == editedSignature, 'snapshot signatures')
report('snapshots', baselineView, editedView)
fs:restore('baseline')
expect(structuralSignature(fs, '/projects') == initialSignature, 'baseline restore differs')
report('restore-baseline', fs:verify())
fs:restore('edited')
expect(structuralSignature(fs, '/projects') == editedSignature, 'edited restore differs')
report('restore-edited', fs:verify())
local unusedBefore, retainedBefore, deadBefore, chunkFingerprint = pool:stats(fs:liveChunks(true))
local removedChunks, reclaimed = pool:compact(fs:liveChunks(true))
report('chunks', unusedBefore, retainedBefore, deadBefore, chunkFingerprint, removedChunks, reclaimed, pool.hits, pool.misses)
expect(deadBefore == reclaimed, 'chunk reclamation mismatch')
fs:verify()
expect(stopWatching() and not stopWatching(), 'watch cancellation')
local watchedBefore = watched.count
fs:create('/projects/watch-stopped.txt', 'unwatched')
expect(watched.count == watchedBefore, 'cancelled watcher called')
fs:unlink('/projects/watch-stopped.txt')
report('watcher', watched.count, watched.folded)
local journalCounts, journalTouched, journalFingerprint = summarizeJournal(fs.journal)
report('journal', #fs.journal, journalTouched, journalFingerprint, journalCounts)
local directoryRows = fs:list('/projects/aster/docs')
for _, row in ipairs(directoryRows) do
    report('listing', row.name, row.kind, row.id, row.size)
end
fs:mkdirp('/scratch/remove/a/b')
fs:create('/scratch/remove/a/b/item.txt', 'recursive removal')
fs:symlink('/projects', '/scratch/remove/a/link')
fs:removeTree('/scratch/remove')
local existsAfterRemove = pcall(function()
    return fs:resolve('/scratch/remove')
end)
expect(not existsAfterRemove, 'recursive removal incomplete')
local finalCount, finalFingerprint = fs:verify()
report('final', finalCount, finalFingerprint, structuralSignature(fs, '/projects'), #fs.journal)
