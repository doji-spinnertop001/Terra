require.config({ paths: { vs: 'https://unpkg.com/monaco-editor@0.45.0/min/vs' } });

require(['vs/editor/editor.main'], function() {
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
    let framework = "Terra ML"
    io.print(framework)
    let node1 = Node("Data_A")
    node1.next = Node("Data_B")
    io.print(node1.data)
    let curr = node1.next
    io.print(curr.data)
    let weights = tx.tensor([0.5, 2.0])
    tx.say(weights)`,
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
    if (!clean || clean.startsWith("fn") || clean.endsWith(":")) continue;

    if (clean.startsWith("@tenx --load --tx")) {
      tenxLoaded = true;
      continue;
    }

    // 1. Node Creation
    let nodeMatch = clean.match(/(?:var|let)\s+(\w+)\s*=\s*Node\((.*)\)/);
    if (nodeMatch) {
      let id = "obj_" + (nextId++);
      heap[id] = { data: nodeMatch[2].replace(/["']/g, ''), next: null };
      vars[nodeMatch[1]] = id;
      continue;
    }

    // 2. Terra ML Framework
    if (tenxLoaded) {
      let tensorMatch = clean.match(/(?:var|let)\s+(\w+)\s*=\s*tx\.tensor\((.*)\)/);
      if (tensorMatch) {
        vars[tensorMatch[1]] = "Tensor(" + tensorMatch[2] + ")";
        continue;
      }
    }

    // 3. General Variable Assignment (Matches: let x = "val" or let x = y.next)
    let assignMatch = clean.match(/(?:var|let)\s+(\w+)\s*=\s*(.*)/);
    if (assignMatch) {
      let varName = assignMatch[1].trim();
      let expression = assignMatch[2].trim();
      
      if (expression.includes(".next")) {
        let parent = expression.split('.')[0];
        vars[varName] = heap[vars[parent]] ? heap[vars[parent]].next : null;
      } else {
        vars[varName] = expression.replace(/["']/g, '');
      }
      continue;
    }
    
    // 4. Linked List Linking (node.next = Node(...))
    if (clean.includes(".next = Node(")) {
      let parentVar = clean.split(".next")[0].trim();
      let val = clean.match(/Node\((.*)\)/)[1].replace(/["']/g, '');
      let childId = "obj_" + (nextId++);
      heap[childId] = { data: val, next: null };
      if (vars[parentVar]) heap[vars[parentVar]].next = childId;
      continue;
    }
    
    // 5. IO Printing & TX Say
    let isPrint = clean.includes("io.print(");
    let isSay = tenxLoaded && clean.includes("tx.say(");

    if (isPrint || isSay) {
      let match = clean.match(/\((.*)\)/);
      if (match) {
        let content = match[1].trim();
        let prefix = isSay ? `<span style="color: #d299ff;">[Terra-AI]:</span> ` : "";
        let result = "";

        if (content.includes(".data")) {
          let parts = content.split('.');
          let targetId = vars[parts[0]];
          result = (targetId && heap[targetId]) ? heap[targetId].data : "NullPointerError";
        } else if (vars.hasOwnProperty(content)) {
          let val = vars[content];
          result = (heap[val]) ? heap[val].data : val;
        } else {
          result = content.replace(/["']/g, "");
        }
        outputDiv.innerHTML += prefix + result + "<br>";
      }
    }
  }
  outputDiv.innerHTML += "<br><span style='color:white'><b>Process finished with exit code 0</b></span>";
}
