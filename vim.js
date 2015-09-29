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
	var fn = function() {
		var i = vim.count || 1;
		while (i--)
			ide.action(action);
		vim.count = null;
	};
	
	fn.action = action;
	return fn;
}
		
/**
 * Helper function for commands. Makes sure there is a valid editor
 */
function setState(name)
{
	var fn = function() {
		ide.editor.setKeymapState(name);
	};
	
	fn.action = name;
	return fn;
}
	
function yank(data)
{
	vim.register.set(data);
	
	for (var i=9; i>0; i--)
		vim.registers[i].set(vim.registers[i-1].data);
	
	vim.registers[0].set(data);
}
	
function enterCountMode(key) {
	vim.count = key;
	ide.editor.setKeymapState('vim-count');
}

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
			editor.setKeymapState('vim');
			editor.cmd('inputDisable');
			editor.set('showCursorWhenSelecting', true);
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
		
		ide.plugins.on('workspace.add', this.setupEditor, this);
		window.addEventListener('focus', this.onFocus.bind(this));
	},
	
	editorCommands: {
		
		yank: function() {
			yank(ide.editor.getSelection());
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
		
		'insert.register.dot': function()
		{
			ide.editor.cmd('insert', [ vim.dotRegister.data ]);
		},
		
		insertCharBelow: function()
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
			
			editor.replaceSelection(this.register.data);
		},
		
		'vim.mode.insert': function()
		{
			var editor = ide.editor;
			editor.setKeymapState('vim-insert');
			editor.cmd('inputEnable');
		},
		
		'vim.mode.normal': function()
		{
		var
			editor = ide.editor,
			lastInsert = editor.cmd('lastInsert')
		;
			editor.setKeymapState('vim');
			editor.cmd('inputDisable');
			editor.cmd('selectClear');
				
			if (lastInsert)
				vim.dotRegister.set(lastInsert);
		},
		
		'vim.mode.change': setState('vim-change'),
		'vim.mode.select': setState('vim-select'),
		'vim.mode.delete': setState('vim-delete'),
		'vim.mode.yank': setState('vim-yank'),
		'vim.mode.replace': setState('vim-replace'),
		'vim.mode.blockSelect': setState('vim-block-select')
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
			'&': count('searchReplace'),
			
			'shift+a': 'goLineEnd vim.mode.insert',
			'shift+c': 'startSelect goLineEnd endSelect delSelection vim.mode.insert',
			'shift+d': 'delWrappedLineRight vim.mode.insert',
			'shift+o': 'goLineUp goLineEnd vim.mode.insert insertLine',
			'shift+n': count('findPrev'),
			'shift+v': 'selectLine vim.mode.blockSelect',
			'shift+y': 'yankBlock',
			
			'alt+.': 'moveNext',
			'alt+,': 'movePrev',
			':': 'ex',
			
			'a': count('goColumnRight vim.mode.insert'),
			'c': 'vim.mode.change',
			'd': 'vim.mode.delete',
			'g a': 'ascii',
			'g t': count('editorNext'),
			'g g': 'goDocStart',
			'g shift+t': count('editorPrevious'),
			'g f': 'find',
			'i': 'vim.mode.insert',
			'n': count('findNext'),
			'o': 'goLineEnd vim.mode.insert insertLine',
			'p': count('put'),
			'r': 'vim.more.replace',
			'u': count('undo'),
			'v': 'vim.mode.select',
			'y': 'vim.mode.yank',
			'z c': 'fold',
			'z o': 'unfold',
			
			insert: 'vim.mode.insert'

		}, map(MOTION)),
		
		'vim-count': {
			esc: 'vim.mode.normal',
			'mod+[': 'vim.mode.normal',
			
			all: function(key) {
				if (key.length===1 && /\d/.test(key))
					vim.count += key;
				else
				{
					vim.editorCommands['vim.mode.normal']();
					ide.keyboard.handleKey(key);
				}
			}
		},
		
		'vim-replace': {
			
			esc: 'vim.mode.normal',
			'mod+[': 'vim.mode.normal',
			
			all: function(key) {
				
				if (key in PRINTCHAR)
					key = PRINTCHAR[key];
				
				if (ide.editor && ide.editor.replaceSelection &&
					key.length===1)
					ide.editor.replaceSelection(key);
				ide.run('vim.mode.normal');
			}
			
		},
		
		'vim-yank': _.extend({
			esc: 'vim.mode.normal',
			'mod+[': 'vim.mode.normal',
			'y': 'yankBlock vim.mode.normal'
		}, map(MOTION, 'selectStart', 'selectEnd yank selectClear vim.mode.normal')),
		
		'vim-change': _.extend({
			esc: 'vim.mode.normal',
			'mod+[': 'vim.mode.normal'
		}, map(MOTION, 'selectStart', 'selectEnd delSelection vim.mode.insert')),
		
		'vim-delete': _.extend({
			esc: 'vim.mode.normal',
			'mod+[': 'vim.mode.normal',
			'd': count('yankBlock delLine vim.mode.normal'),
		}, map(MOTION, 'selectStart', 'selectEnd yank delSelection vim.mode.normal')),
		
		'vim-select': _.extend({
			'd': 'yank delSelection vim.mode.normal',
			'y': 'yank vim.mode.normal',
			'>': count('indentMore vim.mode.normal'),
			'<': count('indentLess vim.mode.normal'),
			'p': count('put vim.mode.normal'),
			'=': 'indentAuto vim.mode.normal',
			
			esc: 'vim.mode.normal',
			'mod+[': 'vim.mode.normal'
		}, map(MOTION, 'selectStart', 'selectEnd')),
					 
		'vim-block-select': _.extend({
			d: 'yankBlock delSelection vim.mode.normal',
			y: 'yankBlock vim.mode.normal',
			p: count('put vim.mode.normal'),
			'>': count('indentMore vim.mode.normal'),
			'<': count('indentLess vim.mode.normal'),
			'=': 'indentAuto vim.mode.normal',
			
			esc: 'vim.mode.normal',
			'mod+[': 'vim.mode.normal'
		 }, map(MOTION, 'selectStart', 'selectLine selectEnd')),

		'vim-insert': {
			'mod+@': 'insertDotRegister vim.mode.normal',
			'mod+a': 'insertDotRegister',
			'mod+d': 'indentLess',
			'mod+h': 'delCharBefore',
			'mod+j': 'insertLine',
			'mod+m': 'insertLine',
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
			enter: 'insertLine',
			'shift+up': 'goPageUp',
			'shift+down': 'goPageDown',
			'mod+home': 'goDocStart',
			'mod+end': 'goDocEnd',
			'mod+backspace': 'delGroupBefore',
			'mod+left': 'goGroupLeft',
			'mod+right': 'goGroupRight',
			'shift+left': 'goGroupLeft',
			'shift+right': 'goGroupRight',
			'esc': 'vim.mode.normal',
			'mod+[': 'vim.mode.normal',
			'mod+del': 'delGroupAfter',
		}
	}

});

ide.plugins.register('vim', vim);
	
})(this.ide, this._);
