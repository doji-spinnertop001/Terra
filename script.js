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
    let x = tx.tensor([1.0, 2.0, 3.0])
    tx.say(x)
    tx.say("ML Framework Loaded")`,
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
    
    // NEW: Handle @tenx import
    if (clean.startsWith("@tenx --load --tx")) {
      tenxLoaded = true;
      continue;
    }

    if (!clean || clean.startsWith("struct") || clean.startsWith("var data") || clean.startsWith("var next")) continue;
    
    // Node Creation
    let nodeMatch = clean.match(/(?:var|let)\s+(\w+)\s*=\s*Node\((.*)\)/);
    if (nodeMatch) {
      let id = "obj_" + (nextId++);
      heap[id] = { data: nodeMatch[2].replace(/["']/g, ''), next: null };
      vars[nodeMatch[1]] = id;
      continue;
    }

    // NEW: Terra ML Framework (tx. functions)
    if (tenxLoaded && clean.includes("tx.")) {
      // Handle tx.tensor creation
      let tensorMatch = clean.match(/(?:var|let)\s+(\w+)\s*=\s*tx\.tensor\((.*)\)/);
      if (tensorMatch) {
        vars[tensorMatch[1]] = "Tensor(" + tensorMatch[2] + ")";
        continue;
      }

      // Handle tx.say (AI-vibe print)
      if (clean.includes("tx.say(")) {
        let content = clean.match(/tx\.say\((.*)\)/)[1].trim();
        let val = vars[content] || content.replace(/["']/g, "");
        outputDiv.innerHTML += `<span style="color: #d299ff;">[Terra-AI]:</span> ${val}<br>`;
        continue;
      }
      
      // Additional tx functions logic (Placeholders for ML operations)
      if (clean.includes("tx.add") || clean.includes("tx.dot") || clean.includes("tx.sub")) {
          // Logic for PyTorch-style math would go here
          continue;
      }
    }
    
    // Linked List Linking
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
    
    // Variable reassignment (curr = curr.next)
    if (clean.match(/^\w+\s*=\s*\w+\.next$/)) {
      let parts = clean.split('=');
      let targetVar = parts[0].trim();
      let sourceVar = parts[1].trim().split('.')[0];
      vars[targetVar] = heap[vars[sourceVar]].next;
      continue;
    }
    
    // IO Printing
    if (clean.includes("io.print(")) {
      let match = clean.match(/io\.print\((.*)\)/);
      if (match) {
        let content = match[1].trim();
        if (content.includes(".data")) {
          let varName = content.split('.')[0];
          let objId = vars[varName];
          outputDiv.innerHTML += (objId && heap[objId] ? heap[objId].data : "NullPointerError") + "<br>";
        } 
        else if (vars.hasOwnProperty(content)) {
          let value = vars[content];
          outputDiv.innerHTML += (heap[value] ? heap[value].data : value) + "<br>";
        } 
        else if (content.startsWith('"') || content.startsWith("'")) {
          outputDiv.innerHTML += content.replace(/["']/g, "") + "<br>";
        } 
        else {
          outputDiv.innerHTML += content + "<br>";
        }
      }
    }
  }
  outputDiv.innerHTML += "<br><span style='color:white'><b>Process finished with exit code 0</b></span>";
}
