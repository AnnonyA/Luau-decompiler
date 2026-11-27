#include "lua.h"
#include "lualib.h"
#include <cstdlib>
#include <fstream>
#include <iostream>
#include <sstream>
#include <string>
#include <vector>

static int equalityCalls = 0;
static int equalTables(lua_State* L) { ++equalityCalls; lua_pushboolean(L, 1); return 1; }
static void check(lua_State* L, int code) { if (code) { std::cerr << lua_tostring(L, -1) << '\n'; std::exit(2); } }
static int keep(lua_State* L) { int ref = lua_ref(L, -1); lua_pop(L, 1); return ref; }
static bool equal(lua_State* L, int x, int y) {
    lua_getref(L, x); lua_getref(L, y); bool result = lua_rawequal(L, -1, -2); lua_pop(L, 2); return result;
}
static int makeTable(lua_State* L, int id, int metatable) {
    lua_newtable(L); lua_pushinteger(L, id); lua_setfield(L, -2, "id");
    lua_pushinteger(L, 0); lua_setfield(L, -2, "count");
    if (metatable) { lua_getref(L, metatable); lua_setmetatable(L, -2); }
    return keep(L);
}
static void setEnvironment(lua_State* L, int function, int environment) {
    lua_getref(L, function); lua_getref(L, environment);
    if (!lua_setfenv(L, -2)) { std::cerr << "setfenv failed\n"; std::exit(3); }
    lua_pop(L, 1);
}
static std::vector<int> activate(lua_State* L, int chunk, int payload, int returns) {
    lua_getref(L, chunk); lua_getref(L, payload); check(L, lua_pcall(L, 1, returns, 0));
    std::vector<int> result;
    for (int i = -returns; i < 0; ++i) {
        if (!lua_isfunction(L, i)) { std::cerr << "chunk result must be function\n"; std::exit(4); }
        result.push_back(lua_ref(L, i));
    }
    lua_pop(L, returns); return result;
}
static int makeKeys(lua_State* L, const std::vector<int>& values) {
    lua_newtable(L);
    for (size_t i = 0; i < values.size(); ++i) {
        lua_getref(L, values[i]); lua_pushinteger(L, int(i+1)); lua_rawset(L, -3);
    }
    return keep(L);
}
static void printKeys(lua_State* L, int keys, const std::vector<int>& values) {
    for (int ref : values) {
        lua_getref(L, keys); lua_getref(L, ref); lua_rawget(L, -2);
        if (lua_isnil(L, -1)) std::cout << "nil "; else std::cout << lua_tointeger(L, -1) << ' ';
        lua_pop(L, 2);
    }
    std::cout << '\n';
}
static void probeEnvironment(lua_State* L, const std::vector<std::vector<int>>& pairs) {
    for (const auto& pair : pairs) {
        lua_getref(L, pair[0]); check(L, lua_pcall(L, 0, 2, 0));
        const char* marker = lua_tostring(L, -2);
        std::cout << (marker ? marker : "nil") << ':' << lua_tointeger(L, -1) << ' ';
        lua_pop(L, 2);
    }
    std::cout << '\n';
}
int main(int argc, char** argv) {
    if (argc < 3 || argc > 4) { std::cerr << "usage: run_scenarios BYTECODE table-capture|environment-pairs [first-table=1|2]\n"; return 1; }
    std::ifstream input(argv[1], std::ios::binary); if (!input) return 1;
    std::ostringstream stream; stream << input.rdbuf(); std::string bytes = stream.str();
    lua_State* L = luaL_newstate(); luaL_openlibs(L);
    lua_pushliteral(L, "A"); lua_setglobal(L, "marker");
    // Exactly one load. Every activation below uses the same retained chunk.
    check(L, luau_load(L, "=round2-sealed", bytes.data(), bytes.size(), 0));
    int chunk = keep(L);
    std::string mode = argv[2];
    std::cout << std::boolalpha << "load=once mode=" << mode << '\n';
    if (mode == "table-capture") {
        lua_newtable(L); lua_pushcfunction(L, equalTables, "eq-probe"); lua_setfield(L, -2, "__eq");
        int metatable = keep(L);
        int table1 = makeTable(L, 1, metatable), table2 = makeTable(L, 2, metatable);
        bool reverse = argc == 4 && std::string(argv[3]) == "2";
        int a = reverse ? table2 : table1, b = reverse ? table1 : table2;
        std::vector<int> arguments = {a, b, b, a};
        std::vector<int> f;
        for (int arg : arguments) f.push_back(activate(L, chunk, arg, 1)[0]);
        std::cout << "f1=f4 " << equal(L, f[0], f[3]) << " f2=f3 " << equal(L, f[1], f[2]) << " f1=f2 " << equal(L, f[0], f[1]) << '\n';
        int keys = makeKeys(L, {f[0], f[1]});
        std::cout << "keys "; printKeys(L, keys, f);
        std::cout << "state ";
        for (size_t i = 0; i < f.size(); ++i) {
            lua_getref(L, f[i]); lua_pushinteger(L, 1); check(L, lua_pcall(L, 1, 1, 0));
            lua_getref(L, arguments[i]); bool samePayload = lua_rawequal(L, -1, -2); lua_pop(L, 1);
            lua_getfield(L, -1, "id"); int id = lua_tointeger(L, -1); lua_pop(L, 1);
            lua_getfield(L, -1, "count"); int count = lua_tointeger(L, -1); lua_pop(L, 2);
            std::cout << id << ':' << count << ':' << samePayload << ' ';
        }
        std::cout << "\neq_calls " << equalityCalls << '\n';
    } else if (mode == "environment-pairs") {
        lua_getref(L, chunk); lua_getfenv(L, -1); int environmentA = keep(L); lua_pop(L, 1);
        lua_newtable(L); lua_pushliteral(L, "B"); lua_setfield(L, -2, "marker"); int environmentB = keep(L);
        int payload = makeTable(L, 1, 0);
        std::vector<std::vector<int>> pairs;
        setEnvironment(L, chunk, environmentB); pairs.push_back(activate(L, chunk, payload, 2));
        setEnvironment(L, chunk, environmentA); pairs.push_back(activate(L, chunk, payload, 2));
        int retained = pairs[1][0];
        setEnvironment(L, retained, environmentB); pairs.push_back(activate(L, chunk, payload, 2));
        setEnvironment(L, chunk, environmentB); pairs.push_back(activate(L, chunk, payload, 2));
        std::cout << "before_restore "; probeEnvironment(L, pairs);
        setEnvironment(L, retained, environmentA); setEnvironment(L, chunk, environmentA);
        pairs.push_back(activate(L, chunk, payload, 2));
        std::cout << "pair_eq "; for (const auto& pair : pairs) std::cout << equal(L, pair[0], pair[1]) << ' '; std::cout << '\n';
        std::cout << "retained_eq "; for (const auto& pair : pairs) std::cout << equal(L, retained, pair[0]) << ' '; std::cout << '\n';
        int keys = makeKeys(L, {pairs[0][0], retained, pairs[2][0]});
        std::vector<int> observations = {pairs[0][1], pairs[1][1], pairs[2][1], pairs[3][0], pairs[4][0]};
        std::cout << "keys "; printKeys(L, keys, observations);
        std::cout << "after_restore "; probeEnvironment(L, pairs);
    } else { std::cerr << "unknown scenario\n"; return 1; }
    lua_close(L); return 0;
}
