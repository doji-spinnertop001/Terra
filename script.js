require.config({ paths: { vs: 'https://unpkg.com/monaco-editor@0.45.0/min/vs' } });

require(['vs/editor/editor.main'], function() {
  // Custom Theme
  monaco.editor.defineTheme('mojo-theme', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'keyword', foreground: 'ff7b72' },
      { token: 'type', foreground: '79c0ff' },
      { token: 'string', foreground: 'a5d6ff' },
      { token: 'comment', foreground: '8b949e' },
      { token: 'decorator', foreground: 'd299ff' }
    ],
    colors: {
      'editor.background': '#0d1117',
      'editorLineNumber.foreground': '#6e7681',
      'editorCursor.foreground': '#ffffff',
      'editor.lineHighlightBackground': '#161b22'
    }
  });
  
  // Register Mojo Language
  monaco.languages.register({ id: 'mojo' });
  monaco.languages.setMonarchTokensProvider('mojo', {
    tokenizer: {
      root: [
        [/\b(fn|def|struct|alias|trait|var|let|if|else|elif|for|while|return|raises|import|coin|love|sachi|debayan|not)\b/, 'keyword'],
        [/\b(Int|Float64|Bool|String|Node)\b/, 'type'],
        [/@\w+/, 'decorator'],
        [/"[^"]*"/, 'string'],
        [/#.*$/, 'comment'],
        [/io\.(print|input)/, 'keyword'],
        [/tx\.(tensor|pow|gradient_descent|derivative|integrate|dot|add|sub|mod|say|ask)/, 'keyword']
      ]
    }
  });
  
  window.editor = monaco.editor.create(document.getElementById('editor'), {
    value: `@tenx --load --tx
fn main():
    let name = "Terra Engine"
    io.print(name)
    let head = Node("Root Node")
    io.print(head.data)
    let weights = tx.tensor([0.5, -1.2, 3.4])
    tx.say(weights)
    io.print("All systems operational.")`,
    language: 'mojo',
    theme: 'mojo-theme',
    fontSize: 14,
    minimap: { enabled: false }
  });
});

async function runMojo() {
  const outputDiv = document.getElementById('output');
  const code = window.editor.getValue();
  outputDiv.innerHTML = "<b>Processing...</b><br>";
  
  const lines = code.split('\n');
  let heap = {};
  let vars = {};
  let nextId = 1;
  let tenxLoaded = false;
  
  for (let line of lines) {
    let clean = line.trim();
    
    // 1. Handle @tenx import
    if (clean.startsWith("@tenx --load --tx")) {
      tenxLoaded = true;
      continue;
    }

    if (!clean || clean.startsWith("struct") || clean.startsWith("var data") || clean.startsWith("var next") || clean.startsWith("fn") || clean.endsWith(":")) continue;
    
    // 2. Node Creation
    let nodeMatch = clean.match(/(?:var|let)\s+(\w+)\s*=\s*Node\((.*)\)/);
    if (nodeMatch) {
      let id = "obj_" + (nextId++);
      heap[id] = { data: nodeMatch[2].replace(/["']/g, ''), next: null };
      vars[nodeMatch[1]] = id;
      continue;
    }

    // 3. Terra ML Framework (tx.tensor)
    if (tenxLoaded) {
      let tensorMatch = clean.match(/(?:var|let)\s+(\w+)\s*=\s*tx\.tensor\((.*)\)/);
      if (tensorMatch) {
        vars[tensorMatch[1]] = "Tensor(" + tensorMatch[2] + ")";
        continue;
      }
    }

    // 4. Variable Assignment (e.g., let y = 1)
    let varMatch = clean.match(/(?:var|let)\s+(\w+)\s*=\s*(.*)/);
    if (varMatch && !clean.includes("Node(") && !clean.includes("tx.")) {
      vars[varMatch[1]] = varMatch[2].replace(/["']/g, '').trim();
      continue;
    }
    
    // 5. Linked List Linking
    if (clean.includes(".next = Node(")) {
      let parts = clean.split(".next = Node(");
      let parentVar = parts[0].trim();
      let val = parts[1].replace(/\)/, '').trim();
      let childId = "obj_" + (nextId++);
      heap[childId] = { data: val, next: null };
      
      let chain = parentVar.split('.');
      let targetId = vars[chain[0]];
      for (let i = 1; i < chain.length; i++) targetId = heap[targetId].next;
      heap[targetId].next = childId;
      continue;
    }
    
    // 6. Variable reassignment (curr = curr.next)
    if (clean.match(/^\w+\s*=\s*\w+\.next$/)) {
      let parts = clean.split('=');
      let targetVar = parts[0].trim();
      let sourceVar = parts[1].trim().split('.')[0];
      vars[targetVar] = heap[vars[sourceVar]].next;
      continue;
    }
    
    // 7. IO Printing & TX Say
    let isPrint = clean.includes("io.print(");
    let isSay = tenxLoaded && clean.includes("tx.say(");

    if (isPrint || isSay) {
      let pattern = isPrint ? /io\.print\((.*)\)/ : /tx\.say\((.*)\)/;
      let match = clean.match(pattern);
      if (match) {
        let content = match[1].trim();
        let prefix = isSay ? `<span style="color: #d299ff;">[Terra-AI]:</span> ` : "";
        let finalOutput = "";

        if (content.includes(".data")) {
          let varName = content.split('.')[0];
          let objId = vars[varName];
          finalOutput = (objId && heap[objId] ? heap[objId].data : "NullPointerError");
        } 
        else if (vars.hasOwnProperty(content)) {
          let value = vars[content];
          finalOutput = (heap[value] ? heap[value].data : value);
        } 
        else if (content.startsWith('"') || content.startsWith("'")) {
          finalOutput = content.replace(/["']/g, "");
        } 
        else {
          finalOutput = content;
        }
        outputDiv.innerHTML += prefix + finalOutput + "<br>";
      }
    }
  }
  outputDiv.innerHTML += "<br><span style='color:white'><b>Process finished with exit code 0</b></span>";
}
