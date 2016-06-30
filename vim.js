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
		'mod+p': 'goLineUp',
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

function count(action, def)
{
	var fn = function() {
		var i = vim.count || def || 1;
		while (i--)
			ide.action(action);
		vim.count = null;
	};

	fn.action = action;
	return fn;
}

function countParam(action)
{
	var fn = function() {
		ide.run(action, [ vim.count ]);
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
		ide.editor.keymap.setState(name);
	};

	fn.action = name;
	return fn;
}

function setRegister(name)
{
	return function() {
		vim.register = vim.registers[name] || vim.defaultRegister;
		ide.editor.keymap.setState('vim');
	};
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
	ide.editor.keymap.setState('vim-count');
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
		vim.register = vim.defaultRegister;
	}

});

var RegisterList = ide.Editor.List.extend({

	initialize: function()
	{
		vim.registers.forEach(function(a) {

		}, this);
	}

});

var vim = new ide.Plugin({

	registers: null,
	// Active register
	register: null,
	// Default Reigster (")
	defaultRegister: null,
	dotRegister: null,
	clipboardRegister: null,
	// Current Count
	count: null,

	// VIM Mode only supported for editors that have their own keynull.
	setupEditor: function(editor)
	{
		// Start in normal mode
		if (editor.keymap instanceof ide.KeyMap)
		{
			editor.keymap.setState('vim');
			editor.cmd('inputDisable');
			editor.option('showCursorWhenSelecting', true);
		}
	},

	initRegisters: function()
	{
		var r = this.registers = {
			'"': this.register = this.defaultRegister = new Register('"'),
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
		var keymap = ide.project.get('keymap');

		if (keymap && keymap!=='vim')
			return;

		if (!keymap)
			ide.project.set('keymap', 'vim');

		this.initRegisters();

		ide.plugins.on('workspace.add', this.setupEditor, this);
		window.addEventListener('focus', this.onFocus.bind(this));
	},

	editorCommands: {

		y: 'yank',
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
		var
			editor = ide.editor,
			support = editor.cmd('inputEnable')
		;
			if (support !== ide.Pass)
				editor.keymap.setState('vim-insert');
		},

		'vim.mode.normal': function()
		{
		var
			editor = ide.editor,
			lastInsert = editor.cmd('lastInsert')
		;
			editor.keymap.setState('vim');
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
		'vim.mode.blockSelect': setState('vim-block-select'),
		'vim.mode.register': setState('vim-register')
	},

	// Vim style bindings. NOTE Follow vimdoc index order
	shortcuts: {

		vim: _.extend({

			backspace: count('goCharLeft'),
			space: count('goCharRight'),
			'/': 'searchbar',
			'?': 'searchbarReverse',
			'*': 'search',
			'< <': count('indentLess'),
			'= =': 'indentAuto',
			'> >': count('indentMore'),
			'&': count('searchReplace'),
			'"': setState('vim-register'),
			':': 'ex',
			'#': count('findPrev'),

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

			'mod+[': 'vim.mode.normal',
			'mod+b': count('scrollScreenUp'),
			'mod+d': countParam('scrollLineDown'),
			'mod+f': count('scrollScreenDown'),
			'mod+g': 'showInfo',
			'mod+r': count('redo'),
			'mod+u': countParam('scrollLineUp'),
			'mod+y': countParam('scrollLineDown'),

			'shift+a': 'goLineEnd vim.mode.insert',
			'shift+c': 'startSelect goLineEnd endSelect delSelection vim.mode.insert',
			'shift+d': 'delWrappedLineRight vim.mode.insert',
			'shift+o': 'goLineUp goLineEnd vim.mode.insert insertLine',
			'shift+n': count('findPrev'),
			'shift+v': 'selectLine vim.mode.blockSelect',
			'shift+y': 'yankBlock',

			'a': count('goColumnRight vim.mode.insert'),
			'c': 'vim.mode.change',
			'd': 'vim.mode.delete',
			'g': setState('vim-go'),
			'g a': 'ascii',
			'g shift+d': 'ijump',
			'g t': 'editorNext',
			'g g': 'goDocStart',
			'g shift+t': 'editorPrevious',
			'g f': 'find',
			'i': 'vim.mode.insert',
			'n': count('findNext'),
			'o': 'goLineEnd vim.mode.insert insertLine',
			'p': count('put'),
			'r': 'vim.mode.replace',
			'u': count('undo'),
			'v': 'vim.mode.select',
			'y': 'vim.mode.yank',
			'z c': 'fold',
			'z o': 'unfold',

			insert: 'vim.mode.insert',
			enter: 'goLineDown'

		}, map(MOTION)),
		
		'vim-go': {
			a: 'ascii vim.mode.normal',
			'shift+d': 'ijump vim.mode.normal',
			t: count('editorNext vim.mode.normal'),
			g: 'goDocStart vim.mode.normal',
			'shift+t': count('editorPrevious vim.model.normal'),
			f: 'find vim.mode.normal',
			all: 'vim.mode.normal'
		},

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

		'vim-register': {
			'"': setRegister('"'),
			'.': setRegister('.'),
			'*': setRegister('*'),
			0: setRegister(0),
			1: setRegister(1),
			2: setRegister(2),
			3: setRegister(3),
			4: setRegister(4),
			5: setRegister(5),
			6: setRegister(6),
			7: setRegister(7),
			8: setRegister(8),
			9: setRegister(9),

			all: function()
			{
				ide.run('vim.mode.normal');
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
			':': 'ex',

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
			':': 'ex',

			esc: 'vim.mode.normal',
			'mod+[': 'vim.mode.normal'
		 }, map(MOTION, 'selectStart', 'selectLine selectEnd')),

		'vim-insert': {
			'mod+@': 'insertDotRegister vim.mode.normal',
			'mod+a': 'insertDotRegister',
			'mod+d': 'indentLess',
			'mod+h': 'delCharBefore',
			'mod+i': 'insertTab',
			'mod+j': 'insertLine',
			'mod+m': 'insertLine',
			'mod+n': 'search',
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
			down: 'goLineDown',
			up: 'goLineUp',
			right: 'goColumnRight',
			left: 'goColumnLeft',
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
			'mod+del': 'delGroupAfter'
		}
	}

});

ide.plugins.register('vim', vim);

})(this.ide, this._);
