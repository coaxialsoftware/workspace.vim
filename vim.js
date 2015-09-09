/*
 * workspace - vim Plugin
 * 
 */

(function(ide, _) {
"use strict";
	
var
	MOTION = {
		h: 'goColumnLeft',
		'mod+h': 'goColumnLeft',
		l: 'goColumnRight',
		0: 'goLineStart',
		$: 'goLineEnd',
		home: 'goLineStart',
		end: 'goLineEnd',
		'mod+home': 'goDocStart',
		'mod+end': 'goDocEnd',
		'shift+g': 'goDocEnd',
		'shift+left': 'goGroupLeft',
		'shift+right': 'goGroupRight',
		k: 'goLineUp',
		j: 'goLineDown',
		'mod+j': 'goLineDown',
		w: 'goGroupRight',
		b: 'goGroupLeft',
		down: 'goLineDown',
		up: 'goLineUp',
		right: 'goColumnRight',
		left: 'goColumnLeft',
		pagedown: 'goPageDown',
		pageup: 'goPageUp'
	},
	
	PRINTCHAR = {
		plus: '+',
		space: ' ',
		tab: "\t"
	}
;
	
function map(keymap, prefix, postfix)
{
	return _.reduce(keymap, function(result, v, k) {
		result[k] = count((prefix ? prefix + ' ' : '') + v + (postfix ? ' ' + postfix : ''));
		return result;
	}, {});
}
	
function count(action)
{
	return function() {
		var i = vim.count || 1;
		while (i--)
			ide.action(action);
		vim.count = null;
	};
}
		
/**
 * Helper function for commands. Makes sure there is a valid editor
 */
function verify(fn)
{
	return function() {
		if (ide.editor.keymap instanceof ide.KeyMap)
			fn.call(this, ide.editor);
		else
			return ide.Pass;
	};
}
	
function setState(name)
{
	return function() {
		if (ide.editor.keymap instanceof ide.KeyMap)
			ide.editor.keymap.state = name;
		else
			return ide.Pass;
	};
}
	
function yank(data)
{
	vim.register.set(data);
	
	for (var i=9; i>0; i--)
		vim.registers[i].set(vim.registers[i-1].data);
	
	vim.registers[0].set(data);
}
	
var enterCountMode = function(key) {
	vim.count = key;
	if (ide.editor.keymap instanceof ide.KeyMap)
		ide.editor.keymap.state = 'vim-count';
};

function Register(name)
{
	this.name = name;
	this.update();
}
	
_.extend(Register.prototype, {
	
	name: null,
	data: null,
	
	update: function()
	{
		this.data = vim.data('register.' + this.name);
	},
	
	set: function(data)
	{
		this.data = data || '';
		vim.data('register.' + this.name, this.data);
	}
		
});

var vim = new ide.Plugin({
	
	registers: null,
	count: null,
	
	// VIM Mode only supported for editors that have their own keymap.
	setupEditor: function(editor)
	{
		// Start in normal mode
		if (editor.keymap instanceof ide.KeyMap)
		{
			editor.keymap.state = 'vim';
			editor.cmd('disableInput');
			editor.cmd('showCursorWhenSelecting');
		}
	},
	
	initRegisters: function()
	{
		var r = this.registers = {
			'"': this.register = new Register('"'),
			'.': this.dotRegister = new Register('.'),
			'*': this.clipboardRegister = new Register('*')
		};
		
		for (var i=0; i<10; i++)
			r[i] = new Register(i);
	},
	
	updateRegisters: function()
	{
		for (var i in this.registers)
			this.registers[i].update();
	},
	
	onFocus: function()
	{
		this.updateRegisters();
	},

	ready: function()
	{
		if (ide.project.get('keymap')!=='vim')
			return;

		this.initRegisters();
		
		ide.plugins.on('workspace.add_child', this.setupEditor, this);
		ide.win.addEventListener('focus', this.onFocus.bind(this));
	},
	
	editorCommands: {
		
		yank: function() {
			yank(ide.editor.getSelection());
		},
		
		insertDotRegister: function()
		{
			ide.editor.cmd('insert', [ vim.dotRegister.data ]);
		},
		
		insertCharacterBelow: function()
		{
			var e = ide.editor, pos, ch;

			if (e && e.getPosition && e.getChar && e.insert)
			{
				pos = e.getPosition();
				pos.line += 1;
				ch = e.getChar(pos);
				
				if (ch)
					e.insert(ch);
			}
		},
		
		put: function() {
		var
			editor = ide.editor,
			data = this.register.data
		;
			if (data[0]==="\n" && !editor.somethingSelected())
				editor.cmd('goLineEnd');
			
			editor.cmd('replaceSelection', [ this.register.data ]);
		},
		
		yankBlock: function()
		{
		var
			editor = ide.editor,
			data = editor.somethingSelected() ? 
				editor.getSelection() :
				editor.getLine()
		;
			yank("\n" + data);
		},
		
		enterInsertMode: verify(function(editor)
		{
			editor.keymap.state = 'vim-insert';
			editor.cmd('enableInput');
		}),
		
		enterNormalMode: verify(function(editor)
		{
			var lastInsert = editor.cmd('lastInsert');

			editor.keymap.state = 'vim';
			editor.cmd('disableInput');
			editor.cmd('clearSelection');
				
			if (lastInsert)
				vim.dotRegister.set(lastInsert);
		}),
		
		enterChangeMode: setState('vim-change'),
		enterSelectMode: setState('vim-select'),
		enterDeleteMode: setState('vim-delete'),
		enterYankMode: setState('vim-yank'),
		enterReplaceMode: setState('vim-replace'),
		enterBlockSelectMode: setState('vim-block-select')
	},
	
	commands: {
		
		r: 'read',
		e: 'edit'
		
	},

	// Vim style bindings. NOTE Follow vimdoc index order
	shortcuts: {
		vim: _.extend({
			
			'mod+g': 'showInfo',
			backspace: count('goCharLeft'),
			'mod+r': count('redo'),
			space: count('goCharRight'),
			'/': 'searchbar',
			'?': 'searchbarReverse',
			'f1': 'help',
			'f10': 'assist',
			
			1: enterCountMode,
			2: enterCountMode,
			3: enterCountMode,
			4: enterCountMode,
			5: enterCountMode,
			6: enterCountMode,
			7: enterCountMode,
			8: enterCountMode,
			9: enterCountMode,
			
			'< <': count('indentLess'),
			'= =': 'indentAuto',
			'> >': count('indentMore'),
			'&': count('replace'),
			
			'shift+a': 'goLineEnd enterInsertMode',
			'shift+c': 'startSelect goLineEnd endSelect deleteSelection enterInsertMode',
			'shift+d': 'delWrappedLineRight enterInsertMode',
			'shift+o': 'goLineUp goLineEnd enterInsertMode newlineAndIndent',
			'shift+n': count('findPrev'),
			'shift+v': 'selectLine enterBlockSelectMode',
			'shift+y': 'yankBlock',
			
			'alt+.': 'moveNext',
			'alt+,': 'movePrev',
			':': 'ex',
			
			'a': count('goColumnRight enterInsertMode'),
			'c': 'enterChangeMode',
			'd': 'enterDeleteMode',
			'g a': 'ascii',
			'g t': count('nextEditor'),
			'g g': 'goDocStart',
			'g shift+t': count('prevEditor'),
			'g f': 'find',
			'i': 'enterInsertMode',
			'n': count('findNext'),
			'o': 'goLineEnd enterInsertMode newlineAndIndent',
			'p': count('put'),
			'r': 'enterReplaceMode',
			'u': count('undo'),
			'v': 'enterSelectMode',
			'y': 'enterYankMode',
			'z c': 'fold',
			'z o': 'unfold',
			
			insert: 'enterInsertMode'

		}, map(MOTION)),
		
		'vim-count': {
			esc: 'enterNormalMode',
			'mod+[': 'enterNormalMode',
			
			all: function(key) {
				if (key.length===1 && /\d/.test(key))
					vim.count += key;
				else
				{
					vim.editorCommands.enterNormalMode();
					ide.keyboard.handleKey(key);
				}
			}
		},
		
		'vim-replace': {
			
			esc: 'enterNormalMode',
			'mod+[': 'enterNormalMode',
			
			all: function(key) {
				
				if (key in PRINTCHAR)
					key = PRINTCHAR[key];
				
				if (ide.editor && ide.editor.replaceSelection &&
					key.length===1)
					ide.editor.replaceSelection(key);
				ide.cmd('enterNormalMode');
			}
			
		},
		
		'vim-yank': _.extend({
			esc: 'enterNormalMode',
			'mod+[': 'enterNormalMode',
			'y': 'yankBlock enterNormalMode'
		}, map(MOTION, 'startSelect', 'endSelect yank clearSelection enterNormalMode')),
		
		'vim-change': _.extend({
			esc: 'enterNormalMode',
			'mod+[': 'enterNormalMode'
		}, map(MOTION, 'startSelect', 'endSelect deleteSelection enterInsertMode')),
		
		'vim-delete': _.extend({
			esc: 'enterNormalMode',
			'mod+[': 'enterNormalMode',
			'd': count('yankBlock deleteLine enterNormalMode'),
		}, map(MOTION, 'startSelect', 'endSelect yank deleteSelection enterNormalMode')),
		
		'vim-select': _.extend({
			'd': 'yank deleteSelection enterNormalMode',
			'y': 'yank enterNormalMode',
			'>': count('indentMore enterNormalMode'),
			'<': count('indentLess enterNormalMode'),
			'p': count('put enterNormalMode'),
			'=': 'indentAuto enterNormalMode',
			
			esc: 'enterNormalMode',
			'mod+[': 'enterNormalMode'
		}, map(MOTION, 'startSelect', 'endSelect')),
					 
		'vim-block-select': _.extend({
			d: 'yankBlock deleteSelection enterNormalMode',
			y: 'yankBlock enterNormalMode',
			p: count('put enterNormalMode'),
			'>': count('indentMore enterNormalMode'),
			'<': count('indentLess enterNormalMode'),
			'=': 'indentAuto enterNormalMode',
			
			esc: 'enterNormalMode',
			'mod+[': 'enterNormalMode'
		 }, map(MOTION, 'startSelect', 'selectLine endSelect')),

		'vim-insert': {
			'mod+@': 'insertDotRegister enterNormalMode',
			'mod+a': 'insertDotRegister',
			'mod+d': 'indentLess',
			'mod+h': 'delCharBefore',
			'mod+j': 'newlineAndIndent',
			'mod+m': 'newlineAndIndent',
			'mod+t': 'indentMore',
			'mod+w': 'delWordAfter',
			'alt+enter': 'ex',
			'f1': 'help',
			'f10': 'assist',
			
			backspace: 'delCharBefore',
			tab: 'insertTab',
			del: 'delCharAfter',
			pageup: 'goPageUp',
			pagedown: 'goPageDown',
			end: 'goLineEnd',
			home: 'goLineStart',
			enter: 'newline',
			'shift+up': 'goPageUp',
			'shift+down': 'goPageDown',
			'mod+home': 'goDocStart',
			'mod+end': 'goDocEnd',
			'mod+backspace': 'delGroupBefore',
			'mod+left': 'goGroupLeft',
			'mod+right': 'goGroupRight',
			'shift+left': 'goGroupLeft',
			'shift+right': 'goGroupRight',
			'esc': 'enterNormalMode',
			'mod+[': 'enterNormalMode',
			'mod+del': 'delGroupAfter',
		}
	}

});

ide.plugins.register('vim', vim);
	
})(this.ide, this._);
