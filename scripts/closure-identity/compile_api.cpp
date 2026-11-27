#include "Luau/Compiler.h"
#include "Luau/Parser.h"
#include <algorithm>
#include <cstdlib>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <sstream>
#include <string>

// Metadata follows Compiler.cpp at the pinned revision. Actual compilation still
// calls the official Luau::compile without modifying its source or feature flags.
static void jsonString(std::ostream& out, const std::string& value) {
    out << '"';
    for (unsigned char c : value) {
        if (c == '"' || c == '\\') out << '\\' << c;
        else if (c < 32) out << "\\u00" << std::hex << std::setw(2) << std::setfill('0') << int(c) << std::dec;
        else out << c;
    }
    out << '"';
}
struct NativeVisitor : Luau::AstVisitor {
    bool hasNative = false;
    bool visit(Luau::AstExprFunction* function) override {
        hasNative = hasNative || function->hasNativeAttribute();
        return true;
    }
};
static bool writeMetadata(const std::string& path, const std::string& text, int requested) {
    Luau::Allocator allocator;
    Luau::AstNameTable names(allocator);
    Luau::ParseResult parsed = Luau::Parser::parse(text.data(), text.size(), names, allocator);
    int effective = requested;
    for (const Luau::HotComment& comment : parsed.hotcomments) {
        if (!comment.header) continue;
        if (comment.content.compare(0, 9, "optimize ") == 0)
            effective = std::max(0, std::min(2, std::atoi(comment.content.c_str() + 9)));
        if (comment.content == "native") effective = 2;
    }
    NativeVisitor native;
    if (parsed.root) parsed.root->visit(&native);
    if (native.hasNative) effective = 2;
    std::ofstream out(path);
    out << "{\n  \"requestedOptimization\": " << requested << ",\n  \"effectiveOptimization\": " << effective
        << ",\n  \"nativeAttribute\": " << (native.hasNative ? "true" : "false") << ",\n  \"parserErrors\": " << parsed.errors.size()
        << ",\n  \"headerComments\": [";
    bool first = true;
    for (const Luau::HotComment& comment : parsed.hotcomments) {
        if (!comment.header) continue;
        if (!first) out << ", "; first = false;
        jsonString(out, comment.content);
    }
    out << "]\n}\n";
    return bool(out);
}
int main(int argc, char** argv) {
    bool inspect = argc == 5 && std::string(argv[1]) == "--inspect";
    if (!inspect && argc != 4 && argc != 5) {
        std::cerr << "usage: compile_api SOURCE OPT OUT_BYTECODE [METADATA_JSON]\n"
                     "   or: compile_api --inspect SOURCE OPT METADATA_JSON\n";
        return 1;
    }
    const char* source = argv[inspect ? 2 : 1];
    const int requested = std::atoi(argv[inspect ? 3 : 2]);
    std::ifstream in(source, std::ios::binary);
    if (!in) { std::cerr << "cannot read source\n"; return 1; }
    std::ostringstream ss; ss << in.rdbuf();
    const std::string text = ss.str();
    if (argc == 5 && !writeMetadata(argv[4], text, requested)) {
        std::cerr << "cannot write compile metadata\n"; return 1;
    }
    if (inspect) return 0;
    Luau::CompileOptions opt; opt.optimizationLevel = requested; opt.debugLevel = 2;
    const std::string bytecode = Luau::compile(text, opt);
    std::ofstream out(argv[3], std::ios::binary); out.write(bytecode.data(), bytecode.size());
    if (!out) { std::cerr << "cannot write bytecode\n"; return 1; }
    if (bytecode.empty() || bytecode[0] == 0) {
        std::cerr << (bytecode.empty() ? "empty bytecode" : bytecode.substr(1)) << '\n'; return 2;
    }
    return 0;
}
