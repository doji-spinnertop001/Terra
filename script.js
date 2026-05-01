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
        [/io\.(print|input)/, 'keyword']
      ]
    }
  });
  
  window.editor = monaco.editor.create(document.getElementById('editor'), {
    value: `fn main():
    let y = Node("Hello World")
    io.print(y.data)
    io.print(y)`,
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
  
  for (let line of lines) {
    let clean = line.trim();
    if (!clean || clean.startsWith("struct") || clean.startsWith("var data") || clean.startsWith("var next")) continue;
    
    // Node Creation
    let nodeMatch = clean.match(/(?:var|let)\s+(\w+)\s*=\s*Node\((.*)\)/);
    if (nodeMatch) {
      let id = "obj_" + (nextId++);
      heap[id] = { data: nodeMatch[2].replace(/["']/g, ''), next: null };
      vars[nodeMatch[1]] = id;
      continue;
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
    
    // IO Printing (Fixed Section)
    if (clean.includes("io.print(")) {
      let content = clean.match(/io\.print\((.*)\)/)[1].trim();

      // 1. Handle object properties (e.g., y.data)
      if (content.includes(".data")) {
        let varName = content.split('.')[0];
        let objId = vars[varName];
        outputDiv.innerHTML += (objId && heap[objId] ? heap[objId].data : "NullPointerError") + "<br>";
      } 
      
      // 2. Handle direct variables (e.g., io.print(y))
      else if (vars.hasOwnProperty(content)) {
        let val = vars[content];
        outputDiv.innerHTML += (heap[val] ? heap[val].data : val) + "<br>";
      } 
      
      // 3. Handle string literals (e.g., io.print("hello"))
      else if (content.startsWith('"') || content.startsWith("'")) {
        outputDiv.innerHTML += content.replace(/["']/g, "") + "<br>";
      } 
      
      // 4. Fallback for constants/numbers or raw text
      else {
        outputDiv.innerHTML += content + "<br>";
      }
    }
  }
  outputDiv.innerHTML += "<br><span style='color:white'><b>Process finished with exit code 0</b></span>";
}
