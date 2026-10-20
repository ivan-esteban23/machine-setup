var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// main.ts
var main_exports = {};
__export(main_exports, {
  default: () => HybridLineNumbersPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian = require("obsidian");

// src/extension.ts
var import_state = require("@codemirror/state");
var import_view = require("@codemirror/view");
var import_language = require("@codemirror/language");

// src/numbers.ts
var NUMBER_MODES = ["hybrid", "relative", "absolute"];
function isNumberMode(value) {
  return typeof value === "string" && NUMBER_MODES.includes(value);
}
function hiddenSpans(folds) {
  const spans = [...folds].map(([start, end]) => [start + 1, end]).filter(([first, last]) => first <= last).sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const span of spans) {
    const previous = merged[merged.length - 1];
    if (previous && span[0] <= previous[1] + 1)
      previous[1] = Math.max(previous[1], span[1]);
    else
      merged.push([span[0], span[1]]);
  }
  return merged;
}
var LineIndex = class {
  constructor(spans = []) {
    this.spans = spans;
    this.hiddenBefore = [0];
    for (const [first, last] of spans) {
      this.hiddenBefore.push(this.hiddenBefore[this.hiddenBefore.length - 1] + last - first + 1);
    }
  }
  /** Index of the last span starting at or before `line`, or -1. */
  spanAt(line) {
    let low = 0;
    let high = this.spans.length - 1;
    let found = -1;
    while (low <= high) {
      const mid = low + high >> 1;
      if (this.spans[mid][0] <= line) {
        found = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    return found;
  }
  /** The line that shows on screen for `line`: itself, or the fold's first line when it is hidden. */
  shownLine(line) {
    const i = this.spanAt(line);
    if (i >= 0 && line <= this.spans[i][1])
      return this.spans[i][0] - 1;
    return line;
  }
  /** Position of `line` counting only lines that are on screen. */
  screenRow(line) {
    const shown = this.shownLine(line);
    const i = this.spanAt(shown);
    return shown - this.hiddenBefore[i + 1];
  }
  /**
   * The last line of the screen row `line` is on: the line itself, or the
   * last line its fold hides when it is a folded heading (or inside one).
   */
  rowEnd(line) {
    const shown = this.shownLine(line);
    const i = this.spanAt(shown + 1);
    if (i >= 0 && this.spans[i][0] === shown + 1)
      return this.spans[i][1];
    return shown;
  }
  /** The line shown at screen row `row` (1-based), the inverse of `screenRow`. */
  lineAtRow(row) {
    let line = row;
    for (const [first, last] of this.spans) {
      if (first > line)
        break;
      line += last - first + 1;
    }
    return line;
  }
  distance(line, cursorLine) {
    return Math.abs(this.screenRow(line) - this.screenRow(cursorLine));
  }
};
function lineLabel(line, { mode, cursorLine, index }) {
  if (mode === "absolute")
    return String(line);
  const onCursor = index.shownLine(cursorLine) === line;
  if (onCursor)
    return mode === "hybrid" ? String(line) : "0";
  return String(index.distance(line, cursorLine));
}
function widestLabel(lineCount) {
  return "9".repeat(String(Math.max(lineCount, 1)).length);
}
function vimFlags(enabled, mode) {
  return {
    number: enabled && mode !== "relative",
    relativenumber: enabled && mode !== "absolute"
  };
}
function fromVimFlags(flags, mode) {
  if (flags.number && flags.relativenumber)
    return { enabled: true, mode: "hybrid" };
  if (flags.relativenumber)
    return { enabled: true, mode: "relative" };
  if (flags.number)
    return { enabled: true, mode: "absolute" };
  return { enabled: false, mode };
}

// src/select.ts
function rowSpan(from, to, index) {
  return [index.shownLine(Math.min(from, to)), index.rowEnd(Math.max(from, to))];
}
function lineAfter(line, doc) {
  return line < doc.lines ? doc.lineStart(line + 1) : doc.length;
}
function lineSelection(anchor, head, doc) {
  if (head[0] >= anchor[0]) {
    return { anchor: doc.lineStart(anchor[0]), head: lineAfter(Math.max(anchor[1], head[1]), doc) };
  }
  return { anchor: lineAfter(anchor[1], doc), head: doc.lineStart(head[0]) };
}
function parseLineTarget(text) {
  const match = /^\s*([+\-−]?)\s*(\d{1,9})\s*$/.exec(text);
  if (!match)
    return null;
  const count = Number(match[2]);
  if (match[1] === "")
    return { kind: "absolute", line: count };
  return { kind: "relative", delta: match[1] === "+" ? count : -count };
}
function resolveTarget(target, cursorLine, lineCount, index) {
  const last = Math.max(lineCount, 1);
  if (target.kind === "absolute")
    return index.shownLine(Math.min(Math.max(target.line, 1), last));
  const lastRow = index.screenRow(last);
  const row = Math.min(Math.max(index.screenRow(cursorLine) + target.delta, 1), lastRow);
  return index.lineAtRow(row);
}
function firstNonBlank(text) {
  var _a, _b;
  return (_b = (_a = /^[ \t]*/.exec(text)) == null ? void 0 : _a[0].length) != null ? _b : 0;
}

// src/extension.ts
var DEFAULT_OPTIONS = { mode: "hybrid", absoluteInInsert: false, selectLines: true };
var optionsFacet = import_state.Facet.define({
  combine: (values) => {
    var _a;
    return (_a = values[0]) != null ? _a : DEFAULT_OPTIONS;
  }
});
var setVimInsert = import_state.StateEffect.define();
var vimInsert = import_state.StateField.define({
  create: () => false,
  update(value, tr) {
    for (const effect of tr.effects)
      if (effect.is(setVimInsert))
        value = effect.value;
    return value;
  }
});
var vimWatcher = import_view.ViewPlugin.fromClass(
  class {
    constructor(view) {
      this.view = view;
      this.adapter = null;
      this.destroyed = false;
      this.onModeChange = (event) => {
        const insert = event.mode === "insert" || event.mode === "replace";
        queueMicrotask(() => {
          if (this.destroyed || this.view.state.field(vimInsert, false) === insert)
            return;
          this.view.dispatch({ effects: setVimInsert.of(insert) });
        });
      };
      this.attach();
    }
    update() {
      this.attach();
    }
    destroy() {
      var _a;
      this.destroyed = true;
      (_a = this.adapter) == null ? void 0 : _a.off("vim-mode-change", this.onModeChange);
      this.adapter = null;
    }
    attach() {
      var _a, _b;
      const adapter = (_a = this.view.cm) != null ? _a : null;
      if (adapter === this.adapter)
        return;
      (_b = this.adapter) == null ? void 0 : _b.off("vim-mode-change", this.onModeChange);
      this.adapter = adapter;
      adapter == null ? void 0 : adapter.on("vim-mode-change", this.onModeChange);
    }
  }
);
var NumberMarker = class extends import_view.GutterMarker {
  constructor(text, current) {
    super();
    this.text = text;
    if (current)
      this.elementClass = "hln-current";
  }
  eq(other) {
    return other instanceof NumberMarker && other.text === this.text && other.elementClass === this.elementClass;
  }
  toDOM(view) {
    return view.dom.ownerDocument.createTextNode(this.text);
  }
};
var contexts = /* @__PURE__ */ new WeakMap();
function labelContext(state) {
  var _a;
  let context = contexts.get(state);
  if (context)
    return context;
  const folds = [];
  (0, import_language.foldedRanges)(state).between(0, state.doc.length, (from, to) => {
    folds.push([state.doc.lineAt(from).number, state.doc.lineAt(to).number]);
  });
  const options = state.facet(optionsFacet);
  const insert = (_a = state.field(vimInsert, false)) != null ? _a : false;
  context = {
    mode: options.absoluteInInsert && insert ? "absolute" : options.mode,
    // The head, not the anchor: in a Vim visual selection it is the cursor.
    cursorLine: state.doc.lineAt(state.selection.main.head).number,
    index: new LineIndex(hiddenSpans(folds))
  };
  contexts.set(state, context);
  return context;
}
function labelsChanged(update) {
  const before = update.startState;
  const after = update.state;
  return update.docChanged || update.selectionSet || (0, import_language.foldedRanges)(before) !== (0, import_language.foldedRanges)(after) || before.facet(optionsFacet) !== after.facet(optionsFacet) || before.field(vimInsert, false) !== after.field(vimInsert, false);
}
function docLines(state) {
  const doc = state.doc;
  return { lines: doc.lines, length: doc.length, lineStart: (line) => doc.line(line).from };
}
function blockSpan(state, block) {
  const from = state.doc.lineAt(block.from).number;
  const to = state.doc.lineAt(block.to).number;
  return rowSpan(from, to, labelContext(state).index);
}
var SCROLL_RAMP = 80;
var SCROLL_MAX_STEP = 40;
var SCROLL_INTERVAL_MS = 30;
var lineSelector = import_view.ViewPlugin.fromClass(
  class {
    constructor(view) {
      this.view = view;
      this.drag = null;
      /** The last selection this made and the rows it started from, so Shift-click extends from them. */
      this.last = null;
    }
    destroy() {
      this.stop();
    }
    /** The gutter's mousedown. True when it is handled here. */
    start(block, event) {
      var _a;
      const view = this.view;
      if (!view.state.facet(optionsFacet).selectLines)
        return false;
      if (event.button !== 0 || event.ctrlKey || event.metaKey)
        return false;
      this.stop();
      const state = view.state;
      const clicked = blockSpan(state, block);
      const add = event.altKey && state.facet(import_state.EditorState.allowMultipleSelections);
      let anchor = clicked;
      if (event.shiftKey && !add) {
        const last = this.last;
        const line = state.doc.lineAt(state.selection.main.anchor).number;
        anchor = (last == null ? void 0 : last.selection.eq(state.selection)) ? last.anchor : rowSpan(line, line, labelContext(state).index);
      }
      const others = add ? state.selection.ranges : [];
      const doc = view.dom.ownerDocument;
      const win = (_a = doc.defaultView) != null ? _a : activeWindow;
      const drag = {
        anchor,
        others,
        clientY: event.clientY,
        timer: win.setInterval(() => this.autoScroll(), SCROLL_INTERVAL_MS),
        move: (move) => {
          if ((move.buttons & 1) === 0)
            return this.stop();
          drag.clientY = move.clientY;
          this.extend();
        },
        up: () => this.stop()
      };
      this.drag = drag;
      doc.addEventListener("mousemove", drag.move);
      doc.addEventListener("mouseup", drag.up);
      view.focus();
      this.select(clicked);
      return true;
    }
    /** Selects from the drag's anchor to `head`, keeping the other selections when Alt added this one. */
    select(head) {
      const drag = this.drag;
      if (!drag)
        return;
      const state = this.view.state;
      const { anchor, head: to } = lineSelection(drag.anchor, head, docLines(state));
      const range = import_state.EditorSelection.range(anchor, to);
      const selection = import_state.EditorSelection.create([...drag.others, range], drag.others.length);
      if (!selection.eq(state.selection))
        this.view.dispatch({ selection, userEvent: "select.pointer" });
      this.last = { selection: this.view.state.selection, anchor: drag.anchor };
    }
    /** The rows under the pointer, held to the first and last line of the note. */
    extend() {
      const drag = this.drag;
      if (!drag)
        return;
      const view = this.view;
      const height = drag.clientY - view.documentTop;
      const block = view.lineBlockAtHeight(Math.min(Math.max(height, 0), Math.max(view.contentHeight - 1, 0)));
      this.select(blockSpan(view.state, block));
    }
    /** While the pointer is above or below the editor, scroll towards it and keep selecting. */
    autoScroll() {
      const drag = this.drag;
      if (!drag)
        return;
      const scroller = this.view.scrollDOM;
      const rect = scroller.getBoundingClientRect();
      let past = 0;
      if (drag.clientY < rect.top)
        past = drag.clientY - rect.top;
      else if (drag.clientY > rect.bottom)
        past = drag.clientY - rect.bottom;
      if (past === 0)
        return;
      const step = Math.sign(past) * Math.ceil(Math.min(Math.abs(past), SCROLL_RAMP) / SCROLL_RAMP * SCROLL_MAX_STEP);
      const before = scroller.scrollTop;
      scroller.scrollTop = before + step;
      if (scroller.scrollTop !== before)
        this.extend();
    }
    stop() {
      var _a;
      const drag = this.drag;
      if (!drag)
        return;
      this.drag = null;
      const doc = this.view.dom.ownerDocument;
      doc.removeEventListener("mousemove", drag.move);
      doc.removeEventListener("mouseup", drag.up);
      ((_a = doc.defaultView) != null ? _a : activeWindow).clearInterval(drag.timer);
    }
  }
);
function goToLine(view, text) {
  const target = parseLineTarget(text);
  if (!target)
    return false;
  const state = view.state;
  const cursorLine = state.doc.lineAt(state.selection.main.head).number;
  const line = state.doc.line(resolveTarget(target, cursorLine, state.doc.lines, labelContext(state).index));
  const pos = line.from + firstNonBlank(line.text);
  view.dispatch({ selection: import_state.EditorSelection.cursor(pos), scrollIntoView: true, userEvent: "select" });
  return true;
}
var numberGutter = (0, import_view.gutter)({
  // `cm-lineNumbers` picks up the theme's styling for line numbers.
  class: "cm-lineNumbers hln-gutter",
  lineMarker(view, block) {
    const line = view.state.doc.lineAt(block.from).number;
    const context = labelContext(view.state);
    const current = context.index.shownLine(context.cursorLine) === line;
    return new NumberMarker(lineLabel(line, context), current);
  },
  lineMarkerChange: labelsChanged,
  domEventHandlers: {
    mousedown: (view, block, event) => {
      var _a, _b;
      return (_b = (_a = view.plugin(lineSelector)) == null ? void 0 : _a.start(block, event)) != null ? _b : false;
    }
  },
  initialSpacer: (view) => new NumberMarker(widestLabel(view.state.doc.lines), false),
  updateSpacer(spacer, update) {
    const widest = widestLabel(update.state.doc.lines);
    return spacer instanceof NumberMarker && spacer.text === widest ? spacer : new NumberMarker(widest, false);
  }
});
function hybridLineNumbers(options) {
  return [
    optionsFacet.of(options),
    vimInsert,
    vimWatcher,
    lineSelector,
    numberGutter,
    // Lets the stylesheet hide Obsidian's own line numbers in this editor,
    // so there is one column of numbers, not two.
    import_view.EditorView.editorAttributes.of({ class: options.selectLines ? "hln-active hln-select-lines" : "hln-active" })
  ];
}

// main.ts
var DEFAULT_SETTINGS = {
  enabled: true,
  mode: "hybrid",
  absoluteInInsert: false,
  selectLines: true
};
var BOOLEAN_SETTINGS = ["enabled", "absoluteInInsert", "selectLines"];
function editorView(editor) {
  var _a;
  return (_a = editor.cm) != null ? _a : null;
}
var GoToLineModal = class extends import_obsidian.Modal {
  constructor(app, editor, view) {
    super(app);
    this.editor = editor;
    this.view = view;
  }
  onOpen() {
    this.titleEl.setText("Go to relative line");
    const input = this.contentEl.createEl("input", {
      type: "text",
      cls: "hln-goto-input",
      attr: { placeholder: "+12, -5 or 42", "aria-label": "Rows to move, or a line number" }
    });
    const hint = this.contentEl.createDiv({
      cls: "setting-item-description",
      text: "+ moves down and - moves up that many lines, a folded section counting as one. A plain number goes to that line."
    });
    input.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" || event.isComposing)
        return;
      event.preventDefault();
      if (goToLine(this.view, input.value)) {
        this.close();
        this.editor.focus();
      } else {
        hint.setText("Type +12 to move down, -5 to move up, or 42 to go to line 42.");
        hint.addClass("mod-warning");
      }
    });
    input.focus();
  }
  onClose() {
    this.contentEl.empty();
  }
};
function vimApi() {
  var _a, _b;
  return (_b = (_a = window.CodeMirrorAdapter) == null ? void 0 : _a.Vim) != null ? _b : null;
}
var VIM_OPTIONS = [
  ["number", "nu"],
  ["relativenumber", "rnu"]
];
var MODE_NAMES = {
  hybrid: "Hybrid: line number on the cursor line, distance elsewhere",
  relative: "Relative: 0 on the cursor line, distance elsewhere",
  absolute: "Absolute: line numbers only"
};
var HybridLineNumbersPlugin = class extends import_obsidian.Plugin {
  constructor() {
    super(...arguments);
    this.settings = { ...DEFAULT_SETTINGS };
    /**
     * Registered once and refilled in place: Obsidian re-reads it on
     * `updateOptions()`, so settings apply to open notes without a reload.
     */
    this.editorExtension = [];
  }
  async onload() {
    await this.loadSettings();
    this.registerEditorExtension(this.editorExtension);
    this.applySettings();
    this.addCommand({
      id: "toggle",
      name: "Toggle line numbers",
      icon: "list-ordered",
      callback: () => {
        this.settings.enabled = !this.settings.enabled;
        void this.saveSettings();
      }
    });
    this.addCommand({
      id: "next-mode",
      name: "Switch to the next numbering mode",
      icon: "arrow-right-left",
      callback: () => {
        const next = NUMBER_MODES[(NUMBER_MODES.indexOf(this.settings.mode) + 1) % NUMBER_MODES.length];
        this.settings.mode = next;
        this.settings.enabled = true;
        void this.saveSettings();
      }
    });
    this.addCommand({
      id: "go-to-relative-line",
      name: "Go to relative line\u2026",
      icon: "arrow-down-up",
      editorCheckCallback: (checking, editor) => {
        const view = editorView(editor);
        if (!view)
          return false;
        if (!checking)
          new GoToLineModal(this.app, editor, view).open();
        return true;
      }
    });
    this.addSettingTab(new HybridLineNumbersSettingTab(this.app, this));
    this.defineVimOptions();
  }
  onunload() {
    const vim = vimApi();
    for (const [name, alias] of VIM_OPTIONS)
      vim == null ? void 0 : vim.defineOption(name, false, "boolean", [alias]);
  }
  /**
   * `:set number`, `:set relativenumber`, their `no`, `inv` and `!` forms,
   * and `:set nu?`, in the Vim command line or a vimrc. They drive this
   * plugin's settings the way they drive Vim: `nu rnu` is hybrid.
   */
  defineVimOptions() {
    const vim = vimApi();
    if (!vim)
      return;
    for (const [name, alias] of VIM_OPTIONS) {
      vim.defineOption(name, void 0, "boolean", [alias], (value) => {
        const flags = vimFlags(this.settings.enabled, this.settings.mode);
        if (value === void 0)
          return flags[name];
        if (flags[name] === (value === true))
          return void 0;
        flags[name] = value === true;
        Object.assign(this.settings, fromVimFlags(flags, this.settings.mode));
        void this.saveSettings();
        return void 0;
      });
    }
  }
  async loadSettings() {
    const stored = await this.loadData();
    this.settings = { ...DEFAULT_SETTINGS, ...stored };
    if (!isNumberMode(this.settings.mode))
      this.settings.mode = DEFAULT_SETTINGS.mode;
  }
  async saveSettings() {
    this.applySettings();
    await this.saveData(this.settings);
  }
  applySettings() {
    this.editorExtension.length = 0;
    if (this.settings.enabled) {
      this.editorExtension.push(
        hybridLineNumbers({
          mode: this.settings.mode,
          absoluteInInsert: this.settings.absoluteInInsert,
          selectLines: this.settings.selectLines
        })
      );
    }
    this.app.workspace.updateOptions();
  }
};
var _HybridLineNumbersSettingTab = class extends import_obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  /**
   * The settings, described rather than drawn, so Obsidian 1.13 and later
   * renders them itself and finds them in the settings search. Older
   * versions do not know this method and call `display()` instead.
   */
  getSettingDefinitions() {
    const text = _HybridLineNumbersSettingTab.TEXT;
    return [
      {
        ...text.enabled,
        control: { type: "toggle", key: "enabled", defaultValue: DEFAULT_SETTINGS.enabled }
      },
      {
        ...text.mode,
        control: { type: "dropdown", key: "mode", defaultValue: DEFAULT_SETTINGS.mode, options: MODE_NAMES }
      },
      {
        ...text.absoluteInInsert,
        control: { type: "toggle", key: "absoluteInInsert", defaultValue: DEFAULT_SETTINGS.absoluteInInsert }
      },
      {
        ...text.selectLines,
        control: { type: "toggle", key: "selectLines", defaultValue: DEFAULT_SETTINGS.selectLines }
      }
    ];
  }
  getControlValue(key) {
    return this.plugin.settings[key];
  }
  async setControlValue(key, value) {
    const settings = this.plugin.settings;
    if (key === "mode") {
      if (isNumberMode(value))
        settings.mode = value;
    } else if (BOOLEAN_SETTINGS.includes(key)) {
      settings[key] = value === true;
    }
    await this.plugin.saveSettings();
  }
  /** The pre-1.13 rendering; a current Obsidian never calls it. */
  display() {
    const { containerEl } = this;
    const text = _HybridLineNumbersSettingTab.TEXT;
    containerEl.empty();
    new import_obsidian.Setting(containerEl).setName(text.enabled.name).setDesc(text.enabled.desc).addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.enabled).onChange((value) => this.setControlValue("enabled", value))
    );
    new import_obsidian.Setting(containerEl).setName(text.mode.name).setDesc(text.mode.desc).addDropdown(
      (dropdown) => dropdown.addOptions(MODE_NAMES).setValue(this.plugin.settings.mode).onChange((value) => this.setControlValue("mode", value))
    );
    new import_obsidian.Setting(containerEl).setName(text.absoluteInInsert.name).setDesc(text.absoluteInInsert.desc).addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.absoluteInInsert).onChange((value) => this.setControlValue("absoluteInInsert", value))
    );
    new import_obsidian.Setting(containerEl).setName(text.selectLines.name).setDesc(text.selectLines.desc).addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.selectLines).onChange((value) => this.setControlValue("selectLines", value))
    );
  }
};
var HybridLineNumbersSettingTab = _HybridLineNumbersSettingTab;
HybridLineNumbersSettingTab.TEXT = {
  enabled: {
    name: "Show line numbers",
    desc: "Replaces Obsidian's own line numbers while it is on, whether or not those are switched on under Editor."
  },
  mode: {
    name: "Numbering",
    desc: "A folded section counts as one line, the way Vim counts a jump such as 5j."
  },
  absoluteInInsert: {
    name: "Absolute numbers in Vim insert mode",
    desc: "Relative numbers in normal and visual mode, line numbers while typing. Needs Vim key bindings."
  },
  selectLines: {
    name: "Select lines by clicking the numbers",
    desc: "Click a number to select its line, drag to select several, Shift-click to extend the selection, Alt-click (Option on a Mac) to add a line as another selection."
  }
};
