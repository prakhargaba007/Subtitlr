const {
    Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
    HeadingLevel, AlignmentType, BorderStyle, WidthType, ShadingType,
    LevelFormat, PageNumber, PageBreak
  } = require('docx');
  const fs = require('fs');
  
  // ─── helpers ───────────────────────────────────────────────────────────────
  
  const ACCENT   = "1F3A8C";   // deep blue
  const ACCENT2  = "C0392B";   // red for layman
  const SOFT_BG  = "EAF0FB";   // light blue bg
  const YELLOW   = "FFF9E6";   // layman bg
  const CODE_BG  = "F4F4F4";   // code block bg
  const GREEN_BG = "E8F5E9";   // example bg
  const GRAY     = "555555";
  const DARK     = "1A1A2E";
  
  const border1 = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
  const borders = { top: border1, bottom: border1, left: border1, right: border1 };
  
  function h1(text) {
    return new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 400, after: 200 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: ACCENT, space: 4 } },
      children: [new TextRun({ text, bold: true, size: 36, color: ACCENT, font: "Arial" })]
    });
  }
  
  function h2(text) {
    return new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 320, after: 140 },
      children: [new TextRun({ text, bold: true, size: 28, color: ACCENT, font: "Arial" })]
    });
  }
  
  function h3(text) {
    return new Paragraph({
      heading: HeadingLevel.HEADING_3,
      spacing: { before: 200, after: 100 },
      children: [new TextRun({ text, bold: true, size: 24, color: "2C3E50", font: "Arial" })]
    });
  }
  
  function laymanBox(text) {
    return [
      new Paragraph({
        spacing: { before: 100, after: 0 },
        shading: { fill: YELLOW, type: ShadingType.CLEAR },
        border: { left: { style: BorderStyle.SINGLE, size: 12, color: "F39C12", space: 6 } },
        indent: { left: 200 },
        children: [
          new TextRun({ text: "🧠 Layman Explanation: ", bold: true, size: 22, color: "E67E22", font: "Arial" }),
          new TextRun({ text, size: 22, color: DARK, font: "Arial" })
        ]
      }),
      new Paragraph({ spacing: { before: 0, after: 80 }, children: [new TextRun("")] })
    ];
  }
  
  function defBox(text) {
    return [
      new Paragraph({
        spacing: { before: 0, after: 0 },
        shading: { fill: SOFT_BG, type: ShadingType.CLEAR },
        border: { left: { style: BorderStyle.SINGLE, size: 12, color: ACCENT, space: 6 } },
        indent: { left: 200 },
        children: [
          new TextRun({ text: "📖 Definition: ", bold: true, size: 22, color: ACCENT, font: "Arial" }),
          new TextRun({ text, size: 22, color: DARK, font: "Arial" })
        ]
      }),
      new Paragraph({ spacing: { before: 0, after: 80 }, children: [new TextRun("")] })
    ];
  }
  
  function exampleBox(lines) {
    return [
      new Paragraph({
        spacing: { before: 80, after: 0 },
        shading: { fill: GREEN_BG, type: ShadingType.CLEAR },
        border: { left: { style: BorderStyle.SINGLE, size: 12, color: "27AE60", space: 6 } },
        indent: { left: 200 },
        children: [new TextRun({ text: "📝 Example:", bold: true, size: 22, color: "27AE60", font: "Arial" })]
      }),
      ...lines.map(l =>
        new Paragraph({
          spacing: { before: 0, after: 0 },
          shading: { fill: GREEN_BG, type: ShadingType.CLEAR },
          indent: { left: 200 },
          children: [new TextRun({ text: l, size: 21, font: "Courier New", color: DARK })]
        })
      ),
      new Paragraph({ spacing: { before: 0, after: 120 }, children: [new TextRun("")] })
    ];
  }
  
  function codeBlock(lines) {
    return [
      ...lines.map(l =>
        new Paragraph({
          spacing: { before: 0, after: 0 },
          shading: { fill: CODE_BG, type: ShadingType.CLEAR },
          border: { left: { style: BorderStyle.SINGLE, size: 8, color: "999999", space: 4 } },
          indent: { left: 300 },
          children: [new TextRun({ text: l, size: 20, font: "Courier New", color: "1A1A2E" })]
        })
      ),
      new Paragraph({ spacing: { before: 0, after: 120 }, children: [new TextRun("")] })
    ];
  }
  
  function para(text, opts = {}) {
    return new Paragraph({
      spacing: { before: 60, after: 80 },
      children: [new TextRun({ text, size: 22, font: "Arial", color: DARK, ...opts })]
    });
  }
  
  function bullet(text, level = 0) {
    return new Paragraph({
      numbering: { reference: "bullets", level },
      spacing: { before: 40, after: 40 },
      children: [new TextRun({ text, size: 22, font: "Arial", color: DARK })]
    });
  }
  
  function numbered(text, level = 0) {
    return new Paragraph({
      numbering: { reference: "numbers", level },
      spacing: { before: 40, after: 40 },
      children: [new TextRun({ text, size: 22, font: "Arial", color: DARK })]
    });
  }
  
  function divider() {
    return new Paragraph({
      spacing: { before: 120, after: 120 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "DDDDDD", space: 1 } },
      children: [new TextRun("")]
    });
  }
  
  function makeTable(headers, rows, colWidths) {
    const hdrRow = new TableRow({
      children: headers.map((h, i) => new TableCell({
        borders,
        width: { size: colWidths[i], type: WidthType.DXA },
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        shading: { fill: ACCENT, type: ShadingType.CLEAR },
        children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 20, color: "FFFFFF", font: "Arial" })] })]
      }))
    });
    const dataRows = rows.map(r => new TableRow({
      children: r.map((c, i) => new TableCell({
        borders,
        width: { size: colWidths[i], type: WidthType.DXA },
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        children: [new Paragraph({ children: [new TextRun({ text: c, size: 20, font: "Arial", color: DARK })] })]
      }))
    }));
    return [
      new Table({
        width: { size: colWidths.reduce((a,b)=>a+b,0), type: WidthType.DXA },
        columnWidths: colWidths,
        rows: [hdrRow, ...dataRows]
      }),
      new Paragraph({ spacing: { before: 0, after: 160 }, children: [new TextRun("")] })
    ];
  }
  
  function noteBox(text) {
    return [
      new Paragraph({
        spacing: { before: 80, after: 80 },
        shading: { fill: "FDE8E8", type: ShadingType.CLEAR },
        border: { left: { style: BorderStyle.SINGLE, size: 12, color: ACCENT2, space: 6 } },
        indent: { left: 200 },
        children: [
          new TextRun({ text: "⚠️ Key Point: ", bold: true, size: 22, color: ACCENT2, font: "Arial" }),
          new TextRun({ text, size: 22, font: "Arial", color: DARK })
        ]
      }),
      new Paragraph({ spacing: { before: 0, after: 80 }, children: [new TextRun("")] })
    ];
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  //  BUILD DOCUMENT
  // ═══════════════════════════════════════════════════════════════════════════
  const children = [];
  
  // ─── COVER ──────────────────────────────────────────────────────────────────
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 1200, after: 200 },
      children: [new TextRun({ text: "COMPILER DESIGN", bold: true, size: 56, font: "Arial", color: ACCENT })]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 100 },
      children: [new TextRun({ text: "Complete Study Notes", size: 36, font: "Arial", color: GRAY })]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 80 },
      children: [new TextRun({ text: "Layman + Formal Definitions + Numerical Examples", size: 24, font: "Arial", color: GRAY })]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 800 },
      children: [new TextRun({ text: "JECRC University | B.Tech CSE | Sixth Semester", size: 22, font: "Arial", color: GRAY, italics: true })]
    }),
    new Paragraph({ children: [new PageBreak()] })
  );
  
  // ════════════════════════════════════════════════════════════════════════════
  //  UNIT 1: COMPILER PHASES
  // ════════════════════════════════════════════════════════════════════════════
  children.push(h1("Unit 1: Compiler Phases"));
  
  const _tmp = laymanBox(
    "Imagine you write instructions in Hindi and want a machine to execute them. The machine only understands binary (0s and 1s). A compiler is the translator that converts your Hindi (high-level code) to machine language through multiple steps — just like a professional translation job has editors, proofreaders, formatters, etc."
  ).forEach(p => children.push(p));
  
  const _tmp = defBox(
    "A compiler is a program that reads source code in a high-level programming language and translates it into an equivalent program in a target language (usually machine code or assembly), while reporting errors."
  ).forEach(p => children.push(p));
  
  children.push(h2("1.1 The Six Phases of a Compiler"));
  
  children.push(para("A compiler works in 6 sequential phases. The output of each phase becomes input to the next."));
  
  const _tmp = makeTable(
    ["Phase", "Input", "Output", "Example"],
    [
      ["1. Lexical Analysis", "Source code (raw text)", "Stream of Tokens", "int x = 5  →  <int><id,x><=><num,5>"],
      ["2. Syntax Analysis", "Token stream", "Parse Tree", "Checks if tokens form valid grammar"],
      ["3. Semantic Analysis", "Parse Tree", "Annotated Parse Tree", "Type checking, scope rules"],
      ["4. Intermediate Code Gen", "Annotated Parse Tree", "Three Address Code (TAC)", "t1 = a + b"],
      ["5. Code Optimization", "TAC", "Optimized TAC", "Remove redundant code"],
      ["6. Code Generation", "Optimized TAC", "Target machine code", "MOV R1, a  ADD R1, b"],
    ],
    [2200, 2000, 2000, 3160]
  ).forEach(p => children.push(p));
  
  const _tmp = exampleBox([
    "Source Code:   int x = a + b * 2;",
    "",
    "Phase 1 (Lexical):    <int> <id,x> <=> <id,a> <+> <id,b> <*> <num,2> <;>",
    "Phase 2 (Syntax):     Builds parse tree showing operator precedence (* before +)",
    "Phase 3 (Semantic):   Checks: a, b are declared? Types match? int = int valid?",
    "Phase 4 (IR/TAC):     t1 = b * 2",
    "                      t2 = a + t1",
    "                      x  = t2",
    "Phase 5 (Optimize):   If b=3 (constant), t1 = 6  (constant folding)",
    "Phase 6 (Code Gen):   MOV R1, b",
    "                      MUL R1, #2",
    "                      ADD R1, a",
    "                      MOV x,  R1",
  ]).forEach(p => children.push(p));
  
  children.push(h2("1.2 Symbol Table & Error Handler (Support Routines)"));
  const _tmp = laymanBox("The symbol table is like a classroom attendance register — it tracks every variable, function, and type used in the program. The error handler is like a strict teacher who flags mistakes at every stage.").forEach(p => children.push(p));
  children.push(
    bullet("Symbol Table: stores identifier names, types, scope, memory location"),
    bullet("Error Handler: detects and reports lexical, syntax, semantic, and runtime errors"),
  );
  children.push(divider());
  
  // ════════════════════════════════════════════════════════════════════════════
  //  UNIT 2: LEXICAL ANALYSIS
  // ════════════════════════════════════════════════════════════════════════════
  children.push(h1("Unit 2: Lexical Analysis"));
  
  children.push(h2("2.1 Lexical Analyzer (Scanner)"));
  const _tmp = laymanBox("The lexical analyzer is like reading a sentence word by word. When you read 'The cat sat', you naturally break it into words. The lexical analyzer reads source code character by character and groups them into meaningful units called tokens.").forEach(p => children.push(p));
  const _tmp = defBox("The Lexical Analyzer (also called Scanner) is the first phase of the compiler. It reads the source program as a character stream, groups characters into lexemes, and returns a sequence of tokens. It also removes whitespace and comments.").forEach(p => children.push(p));
  
  children.push(h2("2.2 Token, Lexeme, Pattern"));
  const _tmp = laymanBox("Think of it like this: PATTERN is a rule (e.g., 'any sequence of digits'). LEXEME is the actual match (e.g., '452'). TOKEN is the category label given (e.g., NUMBER).").forEach(p => children.push(p));
  
  const _tmp = makeTable(
    ["Term", "Meaning", "Example in:  x = 452 + y"],
    [
      ["Token", "Category/type of the unit", "<IDENTIFIER>, <NUMBER>, <OPERATOR>"],
      ["Lexeme", "Actual character sequence", "x, 452, +, y"],
      ["Pattern", "Rule describing the lexeme", "letter(letter|digit)*  for identifiers"],
    ],
    [2000, 3000, 4360]
  ).forEach(p => children.push(p));
  
  const _tmp = exampleBox([
    "Source:   int score = 95 + bonus;",
    "",
    "Lexeme        Token Type",
    "─────────────────────────────────",
    "int        →  KEYWORD",
    "score      →  IDENTIFIER",
    "=          →  ASSIGNMENT_OP",
    "95         →  INTEGER_LITERAL",
    "+          →  ARITHMETIC_OP",
    "bonus      →  IDENTIFIER",
    ";          →  SEMICOLON",
  ]).forEach(p => children.push(p));
  
  children.push(h2("2.3 Finite Automata (FA) Basics"));
  const _tmp = laymanBox("FA is like a vending machine. Depending on the coin you insert (input), the machine moves to a different state. If you reach a valid end state, the machine accepts the input (gives you the snack). If you don't, it rejects.").forEach(p => children.push(p));
  const _tmp = defBox("A Finite Automaton is a mathematical model with: Q (finite set of states), Σ (input alphabet), δ (transition function), q0 (start state), F (set of final/accepting states). Two types: DFA (Deterministic FA) and NFA (Non-deterministic FA).").forEach(p => children.push(p));
  
  children.push(h3("Numerical Example: DFA to recognize identifier (letter)(letter|digit)*"));
  const _tmp = exampleBox([
    "States: q0 (start), q1 (accept), q2 (dead/reject)",
    "Alphabet: letters (a-z), digits (0-9), other",
    "",
    "Transitions:",
    "δ(q0, letter) = q1      ← first char must be letter",
    "δ(q0, digit)  = q2      ← first char digit → reject",
    "δ(q1, letter) = q1      ← more letters, stay in q1",
    "δ(q1, digit)  = q1      ← digits ok after first letter",
    "δ(q1, other)  = q2      ← special char → reject",
    "",
    "Test  'score2':  q0 →(s)→ q1 →(c)→ q1 →(o)→ q1 →(r)→ q1 →(e)→ q1 →(2)→ q1  ✅ ACCEPT",
    "Test  '2score':  q0 →(2)→ q2  ❌ REJECT  (starts with digit)",
  ]).forEach(p => children.push(p));
  
  children.push(h3("NFA vs DFA"));
  const _tmp = makeTable(
    ["Feature", "NFA", "DFA"],
    [
      ["Transitions", "Multiple possible for same input", "Exactly one per state+input"],
      ["ε-transitions", "Allowed", "Not allowed"],
      ["Easier to construct", "Yes", "No"],
      ["Easier to simulate", "No", "Yes"],
      ["Expressive power", "Same as DFA", "Same as NFA"],
    ],
    [2400, 3000, 3000]
  ).forEach(p => children.push(p));
  
  children.push(divider());
  
  // ════════════════════════════════════════════════════════════════════════════
  //  UNIT 3: SYNTAX ANALYSIS
  // ════════════════════════════════════════════════════════════════════════════
  children.push(h1("Unit 3: Syntax Analysis (Parsing)"));
  const _tmp = laymanBox("Syntax analysis is like checking grammar in a sentence. 'Dog the runs' has valid words (tokens) but wrong grammar. Similarly, the parser checks if the token sequence follows the language grammar rules.").forEach(p => children.push(p));
  const _tmp = defBox("Syntax Analysis (Parsing) is the second phase of the compiler. It takes tokens from the lexical analyzer and verifies that the token sequence conforms to the Context-Free Grammar (CFG) of the source language, producing a Parse Tree.").forEach(p => children.push(p));
  
  children.push(h2("3.1 Parse Tree"));
  const _tmp = laymanBox("A parse tree is like a family tree of your expression. It shows how the expression was derived from grammar rules, with the final tokens at the leaves.").forEach(p => children.push(p));
  const _tmp = exampleBox([
    "Grammar:  E → E + T | T",
    "          T → T * F | F",
    "          F → ( E ) | id",
    "",
    "Input:    a + b * c",
    "",
    "Parse Tree:",
    "              E",
    "            / | \\",
    "           E  +   T",
    "           |     / \\",
    "           T    T   *   F",
    "           |    |       |",
    "           F    F       c",
    "           |    |",
    "           a    b",
    "",
    "Explanation: * has higher precedence (deeper in tree), so b*c is evaluated first.",
  ]).forEach(p => children.push(p));
  
  children.push(h2("3.2 FIRST Set"));
  const _tmp = laymanBox("FIRST set answers: 'If I have this grammar rule, what terminal symbol can I possibly see FIRST?' It's like asking: 'What letter can a word starting with rule X begin with?'").forEach(p => children.push(p));
  const _tmp = defBox("FIRST(α) is the set of terminals that can begin any string derived from α. If α can derive empty string ε, then ε ∈ FIRST(α).").forEach(p => children.push(p));
  
  children.push(h3("Rules for Computing FIRST:"));
  children.push(
    numbered("If X is a terminal: FIRST(X) = {X}"),
    numbered("If X → ε: add ε to FIRST(X)"),
    numbered("If X → Y1 Y2 ... Yk: add FIRST(Y1) - {ε}, if Y1 ⟹* ε then add FIRST(Y2) - {ε}, and so on"),
  );
  
  children.push(h3("Numerical Example:"));
  const _tmp = exampleBox([
    "Grammar:",
    "  S → A B",
    "  A → a | ε",
    "  B → b | c",
    "",
    "Step 1: FIRST(A)",
    "  A → a  →  'a' ∈ FIRST(A)",
    "  A → ε  →  ε ∈ FIRST(A)",
    "  FIRST(A) = { a, ε }",
    "",
    "Step 2: FIRST(B)",
    "  B → b  →  'b' ∈ FIRST(B)",
    "  B → c  →  'c' ∈ FIRST(B)",
    "  FIRST(B) = { b, c }",
    "",
    "Step 3: FIRST(S) where S → A B",
    "  Take FIRST(A) - {ε} = {a}  →  add 'a'",
    "  Since ε ∈ FIRST(A), also take FIRST(B) = {b, c}  →  add 'b', 'c'",
    "  ε ∉ FIRST(B), so ε ∉ FIRST(S)",
    "  FIRST(S) = { a, b, c }",
  ]).forEach(p => children.push(p));
  
  children.push(h2("3.3 FOLLOW Set"));
  const _tmp = laymanBox("FOLLOW set answers: 'What terminal can come AFTER this non-terminal in any valid sentence?' Think of it as asking what can follow a particular word in a sentence.").forEach(p => children.push(p));
  const _tmp = defBox("FOLLOW(A) is the set of terminals that can appear immediately to the right of A in any sentential form. $ (end of input marker) is always in FOLLOW(start symbol).").forEach(p => children.push(p));
  
  children.push(h3("Rules for Computing FOLLOW:"));
  children.push(
    numbered("FOLLOW(S) = {$}  where S is the start symbol"),
    numbered("If A → αBβ: add FIRST(β) - {ε} to FOLLOW(B)"),
    numbered("If A → αB or A → αBβ where ε ∈ FIRST(β): add FOLLOW(A) to FOLLOW(B)"),
  );
  
  children.push(h3("Numerical Example (continued from FIRST):"));
  const _tmp = exampleBox([
    "Grammar:",
    "  S → A B",
    "  A → a | ε",
    "  B → b | c",
    "",
    "Step 1: FOLLOW(S) = { $ }    (S is start symbol)",
    "",
    "Step 2: FOLLOW(A)",
    "  S → A B   →   B is after A, so add FIRST(B) - {ε} = {b, c}",
    "  FOLLOW(A) = { b, c }",
    "",
    "Step 3: FOLLOW(B)",
    "  S → A B   →   B is at end of production, so add FOLLOW(S) = {$}",
    "  FOLLOW(B) = { $ }",
  ]).forEach(p => children.push(p));
  
  children.push(h2("3.4 LL(1) Parsing & Predictive Parsing Table"));
  const _tmp = laymanBox("LL(1) parser reads input Left to right, produces Leftmost derivation, and looks ahead 1 token to decide which rule to apply. It's like reading a recipe and deciding what to cook next by reading just the next ingredient.").forEach(p => children.push(p));
  const _tmp = defBox("LL(1) Parser uses a parsing table M[A, a] where A is a non-terminal and a is the current lookahead token. At each step, the parser picks the production to use by consulting this table — no backtracking needed.").forEach(p => children.push(p));
  
  children.push(h3("Constructing LL(1) Parsing Table — Full Numerical Example:"));
  const _tmp = exampleBox([
    "Grammar (after eliminating left recursion):",
    "  E  → T E'",
    "  E' → + T E' | ε",
    "  T  → F T'",
    "  T' → * F T' | ε",
    "  F  → ( E ) | id",
    "",
    "Step 1: Compute FIRST sets:",
    "  FIRST(F)  = { (, id }",
    "  FIRST(T)  = FIRST(F) = { (, id }",
    "  FIRST(E)  = FIRST(T) = { (, id }",
    "  FIRST(E') = { +, ε }",
    "  FIRST(T') = { *, ε }",
    "",
    "Step 2: Compute FOLLOW sets:",
    "  FOLLOW(E)  = { ), $ }",
    "  FOLLOW(E') = FOLLOW(E) = { ), $ }",
    "  FOLLOW(T)  = { +, ), $ }",
    "  FOLLOW(T') = FOLLOW(T) = { +, ), $ }",
    "  FOLLOW(F)  = { *, +, ), $ }",
    "",
    "Step 3: Build Table M[Non-terminal, terminal]:",
    "  Rule: For production A → α:",
    "    For each a ∈ FIRST(α): add A → α to M[A, a]",
    "    If ε ∈ FIRST(α): for each b ∈ FOLLOW(A): add A → ε to M[A, b]",
  ]).forEach(p => children.push(p));
  
  const _tmp = makeTable(
    ["Non-Term", "id", "+", "*", "(", ")", "$"],
    [
      ["E",  "E→TE'",   "",       "",       "E→TE'",   "",       ""],
      ["E'", "",        "E'→+TE'","",       "",         "E'→ε",  "E'→ε"],
      ["T",  "T→FT'",  "",       "",       "T→FT'",   "",       ""],
      ["T'", "",        "T'→ε",  "T'→*FT'","",         "T'→ε",  "T'→ε"],
      ["F",  "F→id",   "",       "",       "F→(E)",   "",       ""],
    ],
    [1200, 1400, 1300, 1400, 1300, 1300, 1100]
  ).forEach(p => children.push(p));
  
  const _tmp = exampleBox([
    "Parse  id + id * id  using the table:",
    "",
    "Stack          Input           Action",
    "──────────────────────────────────────────────────────",
    "$E             id+id*id$       M[E,id] = E→TE'  → push E',T",
    "$E'T           id+id*id$       M[T,id] = T→FT'  → push T',F",
    "$E'T'F         id+id*id$       M[F,id] = F→id   → push id",
    "$E'T'id        id+id*id$       Match id, pop",
    "$E'T'          +id*id$         M[T',+] = T'→ε   → pop T'",
    "$E'            +id*id$         M[E',+] = E'→+TE'→ push E',T,+",
    "$E'T+          +id*id$         Match +, pop",
    "...continues...  (all tokens matched)   → ACCEPT ✅",
  ]).forEach(p => children.push(p));
  
  children.push(h2("3.5 Shift-Reduce Parsing"));
  const _tmp = laymanBox("Imagine building a jigsaw puzzle. You pick up pieces one by one (SHIFT) and when you have a complete group that forms a known pattern, you replace them with one big piece (REDUCE). Shift-Reduce parsing works the same way with grammar rules.").forEach(p => children.push(p));
  const _tmp = defBox("Shift-Reduce parsing uses a stack and input buffer. Two operations: SHIFT (push next input token onto stack) and REDUCE (replace top of stack matching a grammar RHS with the LHS non-terminal). Parsing succeeds when start symbol is on stack and input is empty.").forEach(p => children.push(p));
  const _tmp = exampleBox([
    "Grammar:  E → E + E | id",
    "Input:    id + id",
    "",
    "Stack        Input       Action",
    "─────────────────────────────────────────",
    "$            id+id$      SHIFT",
    "$id          +id$        REDUCE E→id",
    "$E           +id$        SHIFT",
    "$E+          id$         SHIFT",
    "$E+id        $           REDUCE E→id",
    "$E+E         $           REDUCE E→E+E",
    "$E           $           ACCEPT ✅",
  ]).forEach(p => children.push(p));
  
  children.push(h2("3.6 SLR(1) Parser"));
  const _tmp = laymanBox("SLR is a smarter shift-reduce parser. It builds a 'state machine' (LR(0) automaton) to know what it has seen, and uses FOLLOW sets to decide when to reduce.").forEach(p => children.push(p));
  const _tmp = defBox("SLR(1) (Simple LR) parser constructs LR(0) items and automaton. REDUCE action for A → α is added to M[state, a] for all a ∈ FOLLOW(A). SLR can fail (shift-reduce or reduce-reduce conflicts) for some grammars.").forEach(p => children.push(p));
  
  children.push(h3("LR(0) Item Example:"));
  const _tmp = exampleBox([
    "Grammar:  S' → S  (augmented)",
    "          S  → A A",
    "          A  → a A | b",
    "",
    "LR(0) Items for S → A A:",
    "  S → • A A     (dot at start, nothing seen)",
    "  S → A • A     (A seen, expecting another A)",
    "  S → A A •     (complete — REDUCE item)",
    "",
    "The dot (•) shows how far we've parsed the production.",
    "A complete item (dot at end) means we can REDUCE.",
  ]).forEach(p => children.push(p));
  
  children.push(h2("3.7 CLR (Canonical LR) Parser"));
  const _tmp = laymanBox("CLR is the most powerful (and complex) LR parser. Unlike SLR which uses FOLLOW sets globally, CLR computes exact lookaheads for each specific state — making it more precise and able to handle more grammars.").forEach(p => children.push(p));
  const _tmp = defBox("CLR(1) uses LR(1) items: [A → α • β, a] where 'a' is the lookahead terminal. The REDUCE action is only added for the specific lookahead in each item, not for all tokens in FOLLOW(A). This resolves many conflicts SLR cannot.").forEach(p => children.push(p));
  const _tmp = exampleBox([
    "LR(1) Item format:  [ Production, lookahead ]",
    "",
    "Example item:  [ S → A • B, $ ]",
    "  Means: we've seen A, expecting B, and the lookahead is $",
    "",
    "vs LR(0) item:  S → A • B  (no lookahead info)",
    "",
    "CLR(1) can correctly resolve reduce-reduce conflicts",
    "that SLR gets wrong by using precise per-item lookaheads.",
  ]).forEach(p => children.push(p));
  
  children.push(h2("3.8 Comparison: LL(1) vs SLR vs CLR"));
  const _tmp = makeTable(
    ["Feature", "LL(1)", "SLR(1)", "CLR(1)"],
    [
      ["Parsing Direction", "Top-down", "Bottom-up", "Bottom-up"],
      ["Derivation", "Leftmost", "Rightmost (reverse)", "Rightmost (reverse)"],
      ["Lookahead used", "FIRST & FOLLOW", "FOLLOW sets", "Exact per-item lookahead"],
      ["Power (grammars handled)", "Least", "Medium", "Most"],
      ["Table size", "Small", "Medium", "Large"],
      ["Left recursion", "Not allowed", "Allowed", "Allowed"],
      ["Conflicts", "If not LL(1)", "Shift/reduce on same grammar", "Fewer conflicts than SLR"],
    ],
    [3000, 2000, 2000, 2360]
  ).forEach(p => children.push(p));
  
  children.push(divider());
  
  // ════════════════════════════════════════════════════════════════════════════
  //  UNIT 4: SEMANTIC ANALYSIS
  // ════════════════════════════════════════════════════════════════════════════
  children.push(h1("Unit 4: Semantic Analysis"));
  const _tmp = laymanBox("Even if grammar is correct, meaning can be wrong. 'Colorless green ideas sleep furiously' is grammatically perfect English but semantically nonsense. In code: int x = 'hello'; is syntactically valid but semantically wrong — you can't assign a string to an int.").forEach(p => children.push(p));
  const _tmp = defBox("Semantic Analysis checks the meaning of the program beyond its structure. It uses the parse tree and symbol table to verify type consistency, scope rules, and other semantic constraints.").forEach(p => children.push(p));
  
  children.push(h2("4.1 Type Checking"));
  const _tmp = laymanBox("Type checking ensures you're mixing compatible things. You can't add a number and a name — it's like saying 5 + 'Prakhar' makes no sense. The compiler must catch such errors.").forEach(p => children.push(p));
  const _tmp = exampleBox([
    "int  x = 5;         ✅  Valid: integer assigned to integer",
    "int  y = 3.14;      ⚠️  Warning/error: float to int (data loss)",
    "int  z = 'hello';   ❌  Error: string assigned to integer",
    "",
    "Function call check:",
    "  void foo(int a, float b) { ... }",
    "  foo(5, 3.14);    ✅  Correct argument types",
    "  foo('x', 5);     ❌  Wrong types: char and int instead of int and float",
  ]).forEach(p => children.push(p));
  
  children.push(h2("4.2 Scope Checking"));
  const _tmp = laymanBox("Scope is like a building with floors. A variable declared on floor 3 can't be seen from floor 1. Scope checking ensures variables are used only where they're visible.").forEach(p => children.push(p));
  const _tmp = exampleBox([
    "int x = 10;            // Global scope",
    "",
    "void foo() {",
    "    int y = 20;        // Local to foo",
    "    x = x + y;        // ✅ OK: x is global, y is local",
    "}",
    "",
    "void bar() {",
    "    x = x + 1;        // ✅ OK: x is global",
    "    x = x + y;        // ❌ Error: y is not in scope here",
    "}",
  ]).forEach(p => children.push(p));
  
  children.push(h2("4.3 Semantic Errors (Types)"));
  const _tmp = makeTable(
    ["Error Type", "Description", "Example"],
    [
      ["Type mismatch", "Incompatible types in expression", "int x = \"hello\""],
      ["Undeclared variable", "Using variable not declared", "y = x + z; (if z not declared)"],
      ["Redeclaration", "Declaring same variable twice in scope", "int x; int x;"],
      ["Wrong # of args", "Function called with wrong count", "foo(1,2) when foo takes 3"],
      ["Return type mismatch", "Function returns wrong type", "int foo() { return 3.5; }"],
    ],
    [2400, 3000, 4000]
  ).forEach(p => children.push(p));
  
  children.push(h2("4.4 Syntax-Directed Translation (SDT)"));
  const _tmp = laymanBox("SDT attaches rules (actions) to grammar productions. When the parser applies a rule, it also executes the associated semantic action. Think of a cooking recipe where each step also has a note saying 'record the time taken'.").forEach(p => children.push(p));
  const _tmp = defBox("In SDT, each grammar production A → α has an associated semantic action. These actions compute attributes (values attached to nodes) and build the intermediate representation. Inherited attributes flow down the tree; synthesized attributes flow up.").forEach(p => children.push(p));
  const _tmp = exampleBox([
    "Production:          Semantic Action:",
    "E → E1 + T          E.val = E1.val + T.val",
    "E → T               E.val = T.val",
    "T → T1 * F          T.val = T1.val * F.val",
    "T → F               T.val = F.val",
    "F → num             F.val = num.lexval",
    "",
    "Evaluate:  3 + 4 * 2",
    "  F.val = 2          (from num.lexval = 2)",
    "  T.val = 4 * 2 = 8  (T → T1 * F  →  4 * 2)",
    "  E.val = 3 + 8 = 11 (E → E + T   →  3 + 8)",
    "  Result: 11 ✅",
  ]).forEach(p => children.push(p));
  
  children.push(divider());
  
  // ════════════════════════════════════════════════════════════════════════════
  //  UNIT 5: INTERMEDIATE CODE GENERATION
  // ════════════════════════════════════════════════════════════════════════════
  children.push(h1("Unit 5: Intermediate Code Generation"));
  const _tmp = laymanBox("After understanding what the code means, the compiler doesn't directly write machine code (that's too hardware-specific). Instead it writes a 'universal draft' — intermediate code. It's like writing a recipe in a generic format before translating it to Hindi, English, or French.").forEach(p => children.push(p));
  const _tmp = defBox("Intermediate Code is a machine-independent representation of the source program, generated after semantic analysis. The most common form is Three Address Code (TAC). It bridges the gap between source language and target machine code.").forEach(p => children.push(p));
  
  children.push(h2("5.1 Three Address Code (TAC)"));
  const _tmp = laymanBox("In TAC, every instruction has at most 3 addresses (operands). No complex expression is allowed — you break everything into simple binary operations with temporary variables.").forEach(p => children.push(p));
  const _tmp = defBox("TAC has the form: x = y op z, or x = op y, or x = y. Each instruction involves at most one operator and up to 3 operands (including the result). Temporary variables (t1, t2, ...) hold intermediate values.").forEach(p => children.push(p));
  
  children.push(h3("TAC Generation — Full Numerical Example:"));
  const _tmp = exampleBox([
    "Expression:  a = b * c + b * c",
    "",
    "Naive TAC (before optimization):",
    "  t1 = b * c",
    "  t2 = b * c      ← redundant! same as t1",
    "  t3 = t1 + t2",
    "  a  = t3",
    "",
    "After Common Subexpression Elimination:",
    "  t1 = b * c",
    "  t3 = t1 + t1    ← reuse t1",
    "  a  = t3",
    "",
    "─────────────────────────────────────────────",
    "Another Example:  x = (-b + (b*b - 4*a*c)) / (2*a)",
    "",
    "t1 = b * b",
    "t2 = 4 * a",
    "t3 = t2 * c",
    "t4 = t1 - t3",
    "t5 = -b",
    "t6 = t5 + t4",
    "t7 = 2 * a",
    "x  = t6 / t7",
  ]).forEach(p => children.push(p));
  
  children.push(h2("5.2 Quadruples"));
  const _tmp = laymanBox("Quadruples are a table format for TAC. Each row has 4 columns: the operator, two operands, and the result. Like filling a form with 4 fields for every operation.").forEach(p => children.push(p));
  const _tmp = defBox("A Quadruple is a record with 4 fields: (operator, operand1, operand2, result). It's a tabular representation of TAC stored in a symbol table-like structure.").forEach(p => children.push(p));
  
  children.push(h3("Numerical Example: Quadruples for  a = b * c + d"));
  const _tmp = makeTable(
    ["Index", "Operator", "Arg1", "Arg2", "Result"],
    [
      ["(0)", "*", "b", "c", "t1"],
      ["(1)", "+", "t1", "d", "t2"],
      ["(2)", "=", "t2", "—", "a"],
    ],
    [900, 1600, 1600, 1600, 1660]
  ).forEach(p => children.push(p));
  
  children.push(h2("5.3 Triples"));
  const _tmp = laymanBox("Triples are like Quadruples but without a separate result field. Instead, the result is referred to by the row number (index) of the instruction. It saves space but makes code harder to reorder.").forEach(p => children.push(p));
  const _tmp = defBox("A Triple has only 3 fields: (operator, operand1, operand2). The result is implicitly the index of the triple. References to a result use the instruction index like (0), (1), etc.").forEach(p => children.push(p));
  
  children.push(h3("Numerical Example: Triples for  a = b * c + d"));
  const _tmp = makeTable(
    ["Index", "Operator", "Arg1", "Arg2"],
    [
      ["(0)", "*", "b", "c"],
      ["(1)", "+", "(0)", "d"],
      ["(2)", "=", "a", "(1)"],
    ],
    [1200, 2000, 2200, 2200]
  ).forEach(p => children.push(p));
  const _tmp = noteBox("Problem with Triples: If you reorder instructions during optimization, all reference indices break. This is why Indirect Triples were introduced.").forEach(p => children.push(p));
  
  children.push(h2("5.4 Indirect Triples"));
  const _tmp = laymanBox("Indirect triples fix the reordering problem by adding a pointer table. Instead of pointing to row numbers directly, you point to a list of pointers. Reordering just changes the pointer list, not the triples themselves.").forEach(p => children.push(p));
  const _tmp = defBox("Indirect Triples use an additional instruction pointer array. The triples table stays the same; optimization reorders the pointer array without changing triple indices.").forEach(p => children.push(p));
  
  children.push(h3("Numerical Example: Indirect Triples for  a = b * c + d"));
  children.push(para("Triples Table (unchanged):"));
  const _tmp = makeTable(
    ["Index", "Op", "Arg1", "Arg2"],
    [["(0)","*","b","c"],["(1)","+","(0)","d"],["(2)","=","a","(1)"]],
    [1200, 1800, 2000, 2000]
  ).forEach(p => children.push(p));
  children.push(para("Instruction Pointer Array:"));
  const _tmp = makeTable(
    ["Pointer Slot", "Points To"],
    [["P[0]", "(0)  →  t = b * c"],["P[1]", "(1)  →  t = t + d"],["P[2]", "(2)  →  a = t"]],
    [2400, 5960]
  ).forEach(p => children.push(p));
  children.push(para("To reorder, just swap P[0] and P[1] — the Triples table stays intact."));
  
  const _tmp = makeTable(
    ["Feature", "Quadruples", "Triples", "Indirect Triples"],
    [
      ["Fields", "4 (op, a1, a2, result)", "3 (op, a1, a2)", "3 + pointer array"],
      ["Result stored", "Explicitly in table", "Implicitly by index", "Implicitly by index"],
      ["Reordering", "Easy (result explicit)", "Hard (breaks refs)", "Easy (reorder pointers)"],
      ["Space", "More (4 fields)", "Less (3 fields)", "Slightly more than triples"],
      ["Used in", "Most compilers", "Older systems", "Optimizing compilers"],
    ],
    [2600, 2200, 2100, 2460]
  ).forEach(p => children.push(p));
  
  children.push(divider());
  
  // ════════════════════════════════════════════════════════════════════════════
  //  UNIT 6: SYNTAX TREE AND DAG
  // ════════════════════════════════════════════════════════════════════════════
  children.push(h1("Unit 6: Syntax Tree and DAG"));
  
  children.push(h2("6.1 Syntax Tree (Abstract Syntax Tree)"));
  const _tmp = laymanBox("A syntax tree is a cleaned-up parse tree — it removes all the unnecessary grammar 'ceremony' and keeps only the meaningful structure. Like summarizing a legal document to just its key points.").forEach(p => children.push(p));
  const _tmp = defBox("An Abstract Syntax Tree (AST) is a condensed form of the parse tree where punctuation nodes (parentheses, semicolons) and single-production chains are eliminated. Interior nodes represent operators; leaves represent operands.").forEach(p => children.push(p));
  const _tmp = exampleBox([
    "Expression:   a + b * c",
    "",
    "Parse Tree (verbose):          Syntax Tree (compact):",
    "      E                              +",
    "    / | \\                           / \\",
    "   E  +  T                         a   *",
    "   |    / \\                            / \\",
    "   T   T   *   F                      b   c",
    "   |   |       |",
    "   F   F       c      ← syntax tree removes the E→T→F chains",
    "   |   |",
    "   a   b",
  ]).forEach(p => children.push(p));
  
  children.push(h2("6.2 DAG (Directed Acyclic Graph)"));
  const _tmp = laymanBox("A DAG is a syntax tree with shared nodes. If the same sub-expression appears multiple times, instead of drawing it twice, DAG draws it once and has multiple arrows point to it. Saves space and identifies redundancy.").forEach(p => children.push(p));
  const _tmp = defBox("A DAG is like a syntax tree, but common sub-expressions share the same node. It's a directed graph with no cycles. It's used to detect and eliminate common sub-expressions in intermediate code.").forEach(p => children.push(p));
  
  children.push(h3("Numerical Example: DAG for  a + a * (b - c) + (b - c) * d"));
  const _tmp = exampleBox([
    "Identify common sub-expressions:",
    "  (b - c)  appears TWICE  → share one node",
    "  a        appears TWICE  → share one node",
    "",
    "DAG structure (described):",
    "",
    "  Leaf nodes (shared): a, b, c, d",
    "",
    "  Node N1: (-)  with children  b, c       ← (b-c), shared",
    "  Node N2: (*)  with children  a, N1      ← a*(b-c)",
    "  Node N3: (+)  with children  a, N2      ← a + a*(b-c)",
    "  Node N4: (*)  with children  N1, d      ← (b-c)*d  [reuses N1!]",
    "  Node N5: (+)  with children  N3, N4     ← final result",
    "",
    "Syntax Tree would have 2 separate (b-c) subtrees → DAG has 1 (N1)",
    "This directly maps to CSE optimization in TAC:",
    "  t1 = b - c",
    "  t2 = a * t1",
    "  t3 = a + t2",
    "  t4 = t1 * d       ← reuses t1, no recomputation",
    "  t5 = t3 + t4",
  ]).forEach(p => children.push(p));
  
  children.push(h2("6.3 Syntax Tree vs DAG"));
  const _tmp = makeTable(
    ["Feature", "Syntax Tree", "DAG"],
    [
      ["Structure", "Tree (no sharing)", "Graph (shared nodes)"],
      ["Common subexpressions", "Duplicated", "Represented once"],
      ["Space", "More", "Less"],
      ["Used for", "Parsing, code gen", "Optimization, CSE"],
      ["Example: a+a", "Two leaf nodes for a", "One leaf node for a, two edges"],
    ],
    [2800, 3200, 3360]
  ).forEach(p => children.push(p));
  
  children.push(divider());
  
  // ════════════════════════════════════════════════════════════════════════════
  //  UNIT 7: SYMBOL TABLE
  // ════════════════════════════════════════════════════════════════════════════
  children.push(h1("Unit 7: Symbol Table"));
  const _tmp = laymanBox("Symbol table is the compiler's notebook. Every time it sees a new variable or function, it writes down its name, type, size, memory address, and scope. Then any phase can look it up to check if a variable exists, what type it is, etc.").forEach(p => children.push(p));
  const _tmp = defBox("A Symbol Table is a data structure that stores information about identifiers (variables, functions, classes) in a program. It is created and updated during compilation and used by almost all compiler phases.").forEach(p => children.push(p));
  
  children.push(h2("7.1 Structure of Symbol Table"));
  children.push(para("Each entry in the symbol table typically stores:"));
  const _tmp = makeTable(
    ["Field", "Description", "Example"],
    [
      ["Name", "Identifier name", "score"],
      ["Type", "Data type", "int"],
      ["Scope", "Where it's valid", "function foo, global"],
      ["Size", "Memory size", "4 bytes (int)"],
      ["Address / Offset", "Memory location", "0x4A3C / offset 8"],
      ["Value", "For constants", "const PI = 3.14"],
      ["Number of params", "For functions", "foo(int, float) → 2"],
      ["Return type", "For functions", "int foo() → int"],
    ],
    [2200, 3000, 4160]
  ).forEach(p => children.push(p));
  
  children.push(h3("Example Entry for: int add(int a, float b)"));
  const _tmp = exampleBox([
    "Name:        add",
    "Type:        function",
    "Return Type: int",
    "Params:      2  →  [ (a, int), (b, float) ]",
    "Scope:       global",
    "Address:     0x0800  (starting address in code segment)",
  ]).forEach(p => children.push(p));
  
  children.push(h2("7.2 Operations on Symbol Table"));
  children.push(
    bullet("INSERT(name, type, ...): Add a new identifier to the table. Called when declaration is encountered."),
    bullet("LOOKUP(name): Search for an identifier. Returns its attributes or 'not found'. Used to check if a variable is declared before use."),
    bullet("DELETE(name): Remove identifier when it goes out of scope. Used in block-structured languages."),
  );
  
  children.push(h3("Numerical Trace:"));
  const _tmp = exampleBox([
    "Code:",
    "  int x = 5;",
    "  float y = 3.14;",
    "  int add(int a, int b) { return a + b; }",
    "",
    "Symbol Table after processing:",
    "┌────────────┬──────────┬───────────┬────────┬──────────┐",
    "│ Name       │ Type     │ Scope     │ Size   │ Address  │",
    "├────────────┼──────────┼───────────┼────────┼──────────┤",
    "│ x          │ int      │ global    │ 4B     │ 0x100    │",
    "│ y          │ float    │ global    │ 4B     │ 0x104    │",
    "│ add        │ function │ global    │ —      │ 0x0800   │",
    "│ a          │ int      │ add       │ 4B     │ offset 0 │",
    "│ b          │ int      │ add       │ 4B     │ offset 4 │",
    "└────────────┴──────────┴───────────┴────────┴──────────┘",
  ]).forEach(p => children.push(p));
  
  children.push(h2("7.3 Role in Different Compiler Phases"));
  const _tmp = makeTable(
    ["Phase", "Use of Symbol Table"],
    [
      ["Lexical Analysis", "Stores identifiers as tokens are recognized"],
      ["Syntax Analysis", "Checks if identifiers appear in valid positions"],
      ["Semantic Analysis", "Type checking — looks up type of each identifier"],
      ["Intermediate Code Gen", "Gets address/offset for variables to generate TAC"],
      ["Code Optimization", "Uses scope/type info to perform safe optimizations"],
      ["Code Generation", "Gets memory addresses/registers for final code"],
    ],
    [3200, 6160]
  ).forEach(p => children.push(p));
  
  children.push(divider());
  
  // ════════════════════════════════════════════════════════════════════════════
  //  UNIT 8: CODE OPTIMIZATION & CODE GENERATION
  // ════════════════════════════════════════════════════════════════════════════
  children.push(h1("Unit 8: Code Optimization & Code Generation"));
  
  children.push(h2("8.1 Basic Blocks"));
  const _tmp = laymanBox("A basic block is a straight-line chunk of code with no jumps in or out (except at the very beginning and end). Like a highway stretch with no exits or entries mid-way — once you enter, you go through the whole thing.").forEach(p => children.push(p));
  const _tmp = defBox("A Basic Block is a maximal sequence of consecutive instructions where: flow of control enters only at the first instruction, and leaves (or may leave) only at the last instruction. No branches in the middle.").forEach(p => children.push(p));
  
  children.push(h3("How to Identify Basic Blocks:"));
  children.push(
    numbered("The first instruction of the program is a leader"),
    numbered("Any instruction that is the target of a branch is a leader"),
    numbered("Any instruction that follows a conditional/unconditional branch is a leader"),
    numbered("A basic block = set of instructions from one leader up to (but not including) the next leader"),
  );
  const _tmp = exampleBox([
    "TAC Code:",
    "  (1)  t1 = a - b",
    "  (2)  t2 = c - d",
    "  (3)  t3 = t1 * t2",
    "  (4)  if t3 > 0 goto (7)",
    "  (5)  t4 = t1 + t2",
    "  (6)  goto (8)",
    "  (7)  t4 = t1 - t2",
    "  (8)  x  = t4",
    "",
    "Leaders: (1) — first; (5) — after branch at 4; (7) — target of branch; (8) — after goto",
    "",
    "Basic Blocks:",
    "  B1: (1),(2),(3),(4)   ← straight run, ends with conditional branch",
    "  B2: (5),(6)           ← straight run, ends with goto",
    "  B3: (7)               ← single instruction",
    "  B4: (8)               ← single instruction",
  ]).forEach(p => children.push(p));
  
  children.push(h2("8.2 Flow Graph"));
  const _tmp = laymanBox("A flow graph is a map showing how control moves between basic blocks. Like a metro map where blocks are stations and edges are train routes.").forEach(p => children.push(p));
  const _tmp = defBox("A Flow Graph (Control Flow Graph / CFG) is a directed graph where nodes are basic blocks and edges represent possible control flow between them. An edge B1 → B2 means execution can transfer from the end of B1 to the start of B2.").forEach(p => children.push(p));
  const _tmp = exampleBox([
    "From the previous example:",
    "",
    "  [B1] ──(true)──→ [B3]",
    "   |",
    "  (false)",
    "   ↓",
    "  [B2] ──────────→ [B4]",
    "                    ↑",
    "  [B3] ─────────────┘",
    "",
    "Edges:",
    "  B1 → B2  (false branch: t3 ≤ 0)",
    "  B1 → B3  (true branch: t3 > 0)",
    "  B2 → B4  (after goto 8)",
    "  B3 → B4  (falls through to instruction 8)",
  ]).forEach(p => children.push(p));
  
  children.push(h2("8.3 Code Optimization Techniques"));
  const _tmp = makeTable(
    ["Technique", "Description", "Before", "After"],
    [
      ["Constant Folding", "Evaluate constant expressions at compile time", "t = 4 * 3", "t = 12"],
      ["Constant Propagation", "Replace variable with its constant value", "x=5; y=x+2", "y = 7"],
      ["Dead Code Elimination", "Remove code whose result is never used", "x=5; x=10; use(x)", "x=10; use(x)"],
      ["Common Subexpression Elim.", "Reuse already-computed values", "t1=a+b; t2=a+b", "t1=a+b; t2=t1"],
      ["Loop-Invariant Code Motion", "Move computations out of loops if result doesn't change", "while: t=4*5", "t=20; while: (use t)"],
    ],
    [2500, 2400, 1800, 1660]
  ).forEach(p => children.push(p));
  
  children.push(h2("8.4 Register Allocation"));
  const _tmp = laymanBox("A CPU has only a few registers (like 8-16 fast storage slots). When your program has 100 variables, you can't store all in registers. The compiler has to decide which variables get a register and which get pushed to memory. It's like deciding which items to keep on your desk vs in a drawer.").forEach(p => children.push(p));
  const _tmp = defBox("Register Allocation is the process of assigning a large number of target program variables onto a small number of CPU registers. Variables not assigned registers are 'spilled' to memory. The goal is to minimize memory accesses.").forEach(p => children.push(p));
  
  children.push(h2("8.5 Graph Coloring for Register Allocation"));
  const _tmp = laymanBox("Variables that are 'alive' at the same time can't share a register. We draw a graph where variables are nodes and an edge means they're alive simultaneously. Then we 'color' the graph so no two connected nodes have the same color — each color represents a register.").forEach(p => children.push(p));
  const _tmp = defBox("Register allocation via Graph Coloring: Build an Interference Graph where nodes are variables and edges connect variables with overlapping live ranges. k-color the graph (k = number of registers). If a node can't be colored, spill it to memory.").forEach(p => children.push(p));
  
  children.push(h3("Numerical Example: Graph Coloring with 3 registers"));
  const _tmp = exampleBox([
    "Variables: a, b, c, d, e",
    "Live ranges (which instructions each variable is alive during):",
    "  a: instructions 1-4",
    "  b: instructions 2-5",
    "  c: instructions 3-6",
    "  d: instructions 1-3",
    "  e: instructions 5-7",
    "",
    "Interference (overlap in live range):",
    "  a-b: YES (overlap 2-4)   a-c: YES (overlap 3-4)   a-d: YES (overlap 1-3)",
    "  b-c: YES (overlap 3-5)   b-d: YES (overlap 2-3)   c-e: YES (overlap 5-6)",
    "",
    "Interference Graph:",
    "       a ─── b ─── c ─── e",
    "       |\\   /|",
    "       | \\ / |",
    "       |  X  |",
    "       | / \\ |",
    "       d     (b-d edge)",
    "",
    "Graph Coloring (3 colors = 3 registers R1, R2, R3):",
    "  a → R1",
    "  b → R2  (can't be R1: interferes with a)",
    "  c → R1  (can't be R2: interferes with b. Can be R1: no live overlap with a anymore)",
    "  d → R3  (can't be R1 or R2: interferes with both a and b)",
    "  e → R2  (can't be R1: interferes with c. Can be R2: no overlap with b anymore)",
    "",
    "Result: All 5 variables fit in 3 registers — no spilling needed! ✅",
  ]).forEach(p => children.push(p));
  
  children.push(h3("Spilling — When Colors > Registers:"));
  const _tmp = exampleBox([
    "If only 2 registers available (R1, R2):",
    "  a → R1",
    "  b → R2",
    "  c → ?  ← can't be R1 (interferes a) or R2 (interferes b) → SPILL to memory",
    "  d → SPILL",
    "  e → R2  (b is dead by now)",
    "",
    "Spilled variables are loaded from memory when needed:",
    "  LOAD  R1, [mem_c]   ← before using c",
    "  ...use c...",
    "  STORE [mem_c], R1   ← after modifying c",
  ]).forEach(p => children.push(p));
  
  // Final page
  children.push(new Paragraph({ children: [new PageBreak()] }));
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 600, after: 200 },
      children: [new TextRun({ text: "— End of Notes —", size: 28, font: "Arial", color: GRAY, italics: true })]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 0 },
      children: [new TextRun({ text: "Compiler Design | JECRC University | All 8 Units Covered", size: 22, font: "Arial", color: GRAY })]
    })
  );
  
  // ─── BUILD ──────────────────────────────────────────────────────────────────
  const doc = new Document({
    numbering: {
      config: [
        {
          reference: "bullets",
          levels: [{
            level: 0, format: LevelFormat.BULLET, text: "•",
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 360 } } }
          }]
        },
        {
          reference: "numbers",
          levels: [{
            level: 0, format: LevelFormat.DECIMAL, text: "%1.",
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 360 } } }
          }]
        }
      ]
    },
    styles: {
      default: { document: { run: { font: "Arial", size: 22 } } },
      paragraphStyles: [
        { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { size: 36, bold: true, font: "Arial", color: ACCENT },
          paragraph: { spacing: { before: 400, after: 200 }, outlineLevel: 0 } },
        { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { size: 28, bold: true, font: "Arial", color: ACCENT },
          paragraph: { spacing: { before: 320, after: 140 }, outlineLevel: 1 } },
        { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { size: 24, bold: true, font: "Arial", color: "2C3E50" },
          paragraph: { spacing: { before: 200, after: 100 }, outlineLevel: 2 } },
      ]
    },
    sections: [{
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 1200, right: 1200, bottom: 1200, left: 1200 }
        }
      },
      children
    }]
  });
  
  Packer.toBuffer(doc).then(buffer => {
    fs.writeFileSync("/mnt/user-data/outputs/Compiler_Design_Notes.docx", buffer);
    console.log("Done!");
  });