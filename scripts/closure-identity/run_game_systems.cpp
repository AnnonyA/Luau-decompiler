#include "lua.h"
#include "lualib.h"
#include <fstream>
#include <iomanip>
#include <iostream>
#include <iterator>
#include <string>
#include <vector>

static int fail(lua_State* L, const char* message, int code) {
    std::cerr << message << '\n';
    lua_close(L);
    return code;
}
static bool callCounter(lua_State* L, int reference, int delta, int expected) {
    lua_getref(L, reference);
    lua_pushnumber(L, delta);
    if (lua_pcall(L, 1, 1, 0)) {
        std::cerr << "counter-runtime: " << lua_tostring(L, -1) << '\n';
        return false;
    }
    if (!lua_isnumber(L, -1)) return false;
    double result = lua_tonumber(L, -1);
    lua_pop(L, 1);
    std::cout << "host-counter\t" << delta << '\t' << result << '\n';
    return result == expected;
}
int main(int argc, char** argv) {
    std::cout << std::setprecision(17);
    if (argc < 4 || (argc - 2) % 2 != 0) {
        std::cerr << "usage: run_single_load BYTECODE SEED MODE [SEED MODE ...]\n";
        return 2;
    }
    std::ifstream input(argv[1], std::ios::binary);
    if (!input) return 2;
    std::string bytes((std::istreambuf_iterator<char>(input)), std::istreambuf_iterator<char>());
    lua_State* L = luaL_newstate();
    luaL_openlibs(L);
    luaL_sandbox(L);
    luaL_sandboxthread(L);
    // Exactly one load. The referenced entry closure is activated repeatedly.
    if (luau_load(L, "=game-system", bytes.data(), bytes.size(), 0)) {
        std::cerr << "load: " << lua_tostring(L, -1) << '\n';
        return fail(L, "load-failed", 3);
    }
    int entry = lua_ref(L, -1);
    lua_pop(L, 1);
    lua_newtable(L);
    int functionKeys = lua_ref(L, -1);
    lua_pop(L, 1);
    int firstMarker = -1;
    std::vector<int> counters;
    int activations = (argc - 2) / 2;
    std::cout << "host-loads\t1\tactivations\t" << activations << '\n';
    for (int activation = 0; activation < activations; ++activation) {
        lua_getref(L, entry);
        lua_pushstring(L, argv[2 + 2 * activation]);
        lua_pushstring(L, argv[3 + 2 * activation]);
        if (lua_pcall(L, 2, 3, 0)) {
            std::cerr << "runtime: " << lua_tostring(L, -1) << '\n';
            return fail(L, "activation-failed", 4);
        }
        if (!lua_isfunction(L, -3) || !lua_isfunction(L, -2) || !lua_isnumber(L, -1))
            return fail(L, "invalid result triple", 5);
        int marker = lua_ref(L, -3);
        int counter = lua_ref(L, -2);
        double checksum = lua_tonumber(L, -1);
        lua_pop(L, 3);
        if (firstMarker < 0) firstMarker = marker;
        lua_getref(L, firstMarker);
        lua_getref(L, marker);
        bool sameMarker = lua_rawequal(L, -1, -2);
        lua_pop(L, 2);
        lua_getref(L, functionKeys);
        lua_getref(L, marker);
        lua_rawget(L, -2);
        std::cout << "host-marker\t" << activation + 1 << '\t' << (sameMarker ? "true" : "false") << '\t';
        if (lua_isnil(L, -1)) std::cout << "nil";
        else std::cout << lua_tonumber(L, -1);
        std::cout << '\t' << checksum << '\n';
        lua_pop(L, 1);
        lua_getref(L, marker);
        lua_pushnumber(L, activation + 1);
        lua_rawset(L, -3);
        lua_pop(L, 1);
        for (int previous : counters) {
            lua_getref(L, previous);
            lua_getref(L, counter);
            bool aliased = lua_rawequal(L, -1, -2);
            lua_pop(L, 2);
            if (aliased) return fail(L, "counter identity aliased across activations", 6);
        }
        counters.push_back(counter);
        if (!callCounter(L, counter, activation + 1, activation + 1))
            return fail(L, "counter state leaked across activations", 7);
    }
    for (int activation = 0; activation < activations; ++activation)
        if (!callCounter(L, counters[activation], 10, activation + 11))
            return fail(L, "closed counter state changed", 8);
    lua_close(L);
    return 0;
}
