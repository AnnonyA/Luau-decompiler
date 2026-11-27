#[path = "/workspace/scratch/eb5e4be57451/rosetta-research/src/lex.rs"]
mod lex;

fn main() {
    for file in std::env::args().skip(1) {
        let text = std::fs::read_to_string(&file).unwrap();
        let tokens = lex::tokenize(&text);
        let shape = tokens.iter().map(|t| match t.kind {
            lex::Kind::Name => "n",
            lex::Kind::Number => "0",
            lex::Kind::Str => "s",
            lex::Kind::Keyword | lex::Kind::Op => t.text,
        }).collect::<Vec<_>>();
        println!("{}\t{}\t{}", file, shape.len(), shape.join(" "));
    }
}
