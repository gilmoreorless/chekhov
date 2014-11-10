var Chekhov = (function () {

	/*** Helpers ***/

	function A(list) {
		return Array.prototype.slice.apply(list);
	}
	function $(selector, root) {
		return (root || document).querySelector(selector);
	}
	function $$(selector, root) {
		return A((root || document).querySelectorAll(selector));
	}
	function oEach(obj, fn) {
		Object.keys(obj).forEach(function (key) {
			fn.call(obj, obj[key], key);
		});
	}
	function each(obj, fn) {
		if (Array.isArray(obj)) {
			return obj.forEach(fn);
		}
		return oEach(obj, fn);
	}
	function wrapChildren(parent, wrapper) {
		each(A(parent.childNodes), function (node) {
			wrapper.appendChild(node);
		});
		parent.appendChild(wrapper);
	}
	function getPlaceholderText(elem) {
		var text = elem.textContent.trim();
		var match = text.match(/^(<\S+)[\s>]/);
		if (match) {
			text = match[1] + '…' + '>';
		} else {
			text = text.substr(0, 5) + '…';
		}
		return text;
	}

	/*** Debug logging ***/

	USE_LOGGING = 1;

	function log(name) {
		if (!USE_LOGGING) return;
		var indentStr = new Array(log.stackLen + 1).join('  ');
		var args = [indentStr + '#' + ('id' in this ? this.id : '-') + ' ' + name]
			.concat(Array.prototype.slice.call(arguments, 1));
		console.log.apply(console, args);
		log.stackLen++;
	}
	log.stackLen = 0;
	log.exit = function () { log.stackLen--; };


	/*** Main Chekhov object ***/

	var C = function Chekhov(elem) {
		this.elem = elem;
		this.outputElem = $('.ck-output', elem);
		this.codeElem = $('.ck-code', elem);
		var code = $('code', this.codeElem);
		if (code) {
			this.codeElem = code;
		}
		// Wrap code contents in a container element
		var div = document.createElement('div');
		div.className = 'ck-code-wrapper';
		wrapChildren(this.codeElem, div);
		this.srcElem = div;
		this.init();
	};

	C.initAll = function (selector) {
		return $$(selector).map(function (elem) {
			return new C(elem);
		});
	};

	C.lists = {};
	C.controls = {};

	C.prototype.init = function () {
		var ck = this;
		var vars = ck.vars = {};
		var elems = $$('[data-control]', ck.codeElem);
		ck._initSetQueue = [];

		// Collect vars and controls
		each(elems, function (elem) {
			if (elem._chekhov) return;
			var options = getOptionsForElem(elem);
			var varName = options['var'];

			var controlName = options.control;
			if (!C.controls[controlName]) {
				console.warn('No Chekhov control found with the name "' + controlName + '"', elem);
				return;
			}
			var ctrl = new Control(C.controls[controlName], elem, options, ck);

			if (!varName) {
				varName = '__none__';
			}
			var value = elem.textContent.trim();
			var v = vars[varName] || {};
			v.controls || (v.controls = []);
			v.controls.push(ctrl);
			if (ctrl.setVar) {
				v.value = value;
			}
			vars[varName] = v;
			elem._chekhov = true;
		});

		// Init controls
		each(vars, function (varObj) {
			each(varObj.controls, function (control) {
				control.init();
			});
		});

		// Handle any delayed updates from setting variables
		if (ck._initSetQueue.length) {
			log.call(this, 'run _initSetQueue');

			each(ck._initSetQueue, function (varObj) {
				each(varObj.controls, function (control) {
					control.update(varObj.value);
				});
			});

			log.exit();
		}

		delete ck._initSetQueue;
		ck.update();
	};

	C.prototype.update = function () {
		log.call(this, 'chekhov.update');

		this.outputElem.innerHTML = this.srcElem.textContent;

		log.exit();
	};

	function varElemClassManip(method) {
		return function (varName, className) {
			var v = this.vars[varName];
			if (v && v.controls.length) {
				each(v.controls, function (control) {
					control.elem.classList[method](className);
				});
			}
		};
	}

	C.prototype.addClass = varElemClassManip('add');
	C.prototype.removeClass = varElemClassManip('remove');


	/*** Tangle-like functionality (variable/state management) ***/

	var cid = 0;
	function Control(model, elem, options, chekhov) {
		for (var key in model) {
			this[key] = model[key];
		}
		this.id = cid++;
		this.elem = elem;
		this.options = options;
		this.chekhov = chekhov;
	}

	function stringToBool(value) {
		return value === 'true' ? true :
			value === 'false' ? false :
			value;
	}

	function getOptionsForElem(elem) {
		var options = {};
		if (elem.dataset) {
			each(elem.dataset, function (value, key) {
				options[key] = stringToBool(value);
			});
		} else {
			each(A(elem.attributes), function (attr) {
				var name = attr.name;
				if (name.length > 5 && name.substr(0, 5) === 'data-') {
					name = name.substr(5).replace(/-(\w)/g, function (_, c) {
						return c.toUpperCase();
					});
					options[name] = stringToBool(attr.value);
				}
			});
		}
		return options;
	}

	C.prototype.get = function (varName) {
		return (this.vars[varName] || {}).value;
	};

	C.prototype.set = function (varName, value) {
		log.call(this, 'chekhov.set', varName, value, this._initSetQueue ? '(_initSetQueue)' : '');

		var varObj = this.vars[varName];
		if (!varObj) {
			varObj = this.vars[varName] = {};
		}
		var oldValue = varObj.value;
		if (oldValue !== value) {
			varObj.value = value;
			if (this._initSetQueue) {
				// Queue the updates for later to avoid interrupting the init of all controls
				this._initSetQueue.push(varObj);
			} else {
				each(varObj.controls, function (control) {
					control.update(value);
				});
				this.update();
			}
		}

		log.exit();
	};


	/*** UI Controls ***/


	/**
	 * Allow choosing a value from a defined list - great for changing class names
	 *
	 * Attribute options
	 *  data-values: A pipe-separated list of possible values (e.g. "one|two|three")
	 *  data-list: Name of a list of possible values, defined as a property on Chekhov.lists - this overrides `data-values`
	 */
	C.controls.optionList = {
		setVar: true,
		init: function () {
			log.call(this, 'optionList.init', this);

			var optList = this;
			var elem = this.elem;
			var options = this.options;
			var chekhov = this.chekhov;

			var variable = options['var'];
			optList.values = options.list && C.lists[options.list] || (options.values || '').split('|');
			var curValue = chekhov.get(variable);
			// If provided value isn't in the list, choose the first option
			if (optList.values.length && optList.values.indexOf(curValue) === -1) {
				var v = optList.values[0];
				curValue = v;
				chekhov.set(variable, curValue);
			}
			optList.selected = curValue;

			var ul = $('ul[data-for=' + variable + ']', this.chekhov.codeElem);
			var blanket = $('.ck-list-blanket[data-for=' + variable + ']', this.chekhov.codeElem);
			if (!ul) {
				ul = document.createElement('ul');
				ul.className = 'ck-list-options';
				ul.setAttribute('data-for', variable);
				ul.innerHTML = optList.values.map(function (value) {
					var open = '<li' + (value === optList.selected ? ' class="selected"' : '') + '>';
					return open + value + '</li>';
				}).join('');

				blanket = document.createElement('div');
				blanket.className = 'ck-list-blanket';
				blanket.setAttribute('data-for', variable);
			}


			function getSelectedOffset() {
				log.call(optList, 'getSelectedOffset');
				log.exit();

				var selected = $('.selected', ul);
				return selected ? selected.offsetTop || 0 : 0;
			}

			function hideList() {
				log.call(optList, 'hideList', ul);

				// Avoid extra DOM writes when a mouseout directly follows a click
				if (optList._clicked) {
					delete optList._clicked;
					log.exit();
					return;
				}

				ul.classList.remove('active');
				blanket.classList.remove('active');
				chekhov.removeClass(variable, 'active');
				chekhov.set(variable, optList.selected);
				// Reset the span back to auto-adjusting width
				elem.style.width = 'auto';

				log.exit();
			}

			// Hover on code span, show options list
			elem.addEventListener('mouseover', function () {
				log.call(optList, 'elem.mouseover', elem);

				var compStyle = getComputedStyle(elem);
				var left = elem.offsetLeft;
				var top = elem.offsetTop;
				// Fix the width of the span while the list is open
				// to stop the code block from jumping around
				elem.style.width = compStyle.width;
				// Move the list to account for selected option's offsetTop
				ul.classList.add('active');
				var listOffset = getSelectedOffset();
				ul.style.left = left + 'px';
				ul.style.top = (top - listOffset) + 'px';
				blanket.classList.add('active');
				// Highlight all linked elems
				chekhov.addClass(variable, 'active');

				log.exit();
			}, false);

			// Hover out from options list, revert back to selected option
			ul.addEventListener('mouseout', function (e) {
				if (!ul.contains(e.relatedTarget)) {
					log.call(optList, 'ul.mouseout');

					hideList();

					log.exit();
				}
			}, false);

			// Hover over options, change the value
			ul.addEventListener('mouseover', function (e) {
				if (e.target.nodeName === 'LI') {
					log.call(optList, 'li.mouseover', e.target);

					chekhov.set(variable, e.target.textContent);

					log.exit();
				}
			}, false);

			// Click on an option, set selected value
			ul.addEventListener('click', function (e) {
				if (e.target.nodeName === 'LI') {
					log.call(optList, 'li.click');

					$('.selected', ul).classList.remove('selected');
					e.target.classList.add('selected');
					var value = e.target.textContent;
					optList.selected = value;
					hideList();
					optList._clicked = true;

					log.exit();
				}
			}, false);

			elem.classList.add('ck-control-optionList');
			elem.classList.add('ck-outline');
			var fgColour, bgColour, style;
			var styleElem = elem;
			var rTrans = /^transparent|rgba\(0, 0, 0, 0\)$/;
			while (!(fgColour && bgColour) && styleElem !== this.chekhov.elem.parentNode) {
				style = getComputedStyle(styleElem);
				if (!fgColour) {
					fgColour = style.color;
				}
				if (!bgColour && !rTrans.test(style.backgroundColor)) {
					bgColour = style.backgroundColor;
				}
				styleElem = styleElem.parentNode;
			}
			ul.style.color = fgColour;
			if (bgColour) {
				ul.style.backgroundColor = bgColour;
			} else {
				ul.classList.add('ck-default-bg');
			}
			if (!ul.parentNode) {
				this.chekhov.codeElem.appendChild(ul);
				this.chekhov.codeElem.appendChild(blanket);
			}
			// Quick show/hide to get proper option offset
			ul.classList.add('active');
			ul.classList.remove('active');

			log.exit();
		},
		update: function (value) {
			log.call(this, 'optionList.update', this, value);

			this.elem.textContent = value;

			log.exit();
		}
	};


	/**
	 * Show or hide text based on a variable's content
	 *
	 * Attribute options (use one, not both)
	 *  data-show-value: Only show element when variable has this value
	 *  data-hide-value: Show element unless variable has this value
	 */
	C.controls.toggleAuto = {
		init: function () {
			log.call(this, 'toggleAuto.init');

			this.wrapper = document.createElement('span');
			wrapChildren(this.elem, this.wrapper);
			this.elem.classList.add('ck-control-toggle');
			this.elem.classList.add('ck-control-toggle-auto');
			this.update(this.chekhov.get(this.options['var']));

			log.exit();
		},
		update: function (value) {
			var shouldShow = true;
			if (('hideValue' in this.options && this.options.hideValue === value) ||
				('showValue' in this.options && this.options.showValue !== value)) {
				shouldShow = false;
			}
			log.call(this, 'toggleAuto.update', value, shouldShow);

			var method = shouldShow ? 'appendChild' : 'removeChild';
			this.elem[method](this.wrapper);

			log.exit();
		}
	};


	/**
	 * Show or hide text when user clicks on the element
	 *
	 * Attribute options (all optional)
	 *  data-start-hidden: If "true", make element hidden after init
	 *  data-hidden-text: Placeholder text to use in hidden mode (e.g. "<icon>")
	 */
	C.controls.toggleManual = {
		init: function () {
			log.call(this, 'toggleManual.init');

			var ctrl = this;
			var elem = ctrl.elem;

			ctrl.wrapper = document.createElement('span');
			wrapChildren(elem, ctrl.wrapper);
			elem.classList.add('ck-control-toggle');
			elem.classList.add('ck-control-toggle-manual');
			elem.classList.add('ck-outline');
			if (!ctrl.options.hiddenText) {
				var text = ctrl.options.hiddenText = getPlaceholderText(elem);
				elem.setAttribute('data-hidden-text', text);
			}

			ctrl.show = !ctrl.options.startHidden;

			elem.addEventListener('click', function () {
				ctrl.show = !ctrl.show;
				ctrl.update(ctrl.show);
			}, false);

			if (!ctrl.show) {
				ctrl.update(false);
			}

			log.exit();
		},
		update: function (value) {
			var shouldShow = value === false ? false : true;
			log.call(this, 'toggleManual.update', value, shouldShow);

			var method = shouldShow ? 'appendChild' : 'removeChild';
			this.elem[method](this.wrapper);
			this.chekhov.update();

			log.exit();
		}
	};


	/**
	 * Clone an element
	 *
	 * Attribute options
	 *  data-clone-insert: "before" or "after" (default is "after") - where to place the clone, relative to the original
	 */
	C.controls.clone = {
		init: function () {
			log.call(this, 'clone.init');

			var ctrl = this;
			var elem = ctrl.elem;
			elem.classList.add('ck-control-clone');
			elem.classList.add('ck-outline');

			ctrl.count = 1;
			ctrl.clickHandler = function () {
				this.update(this.count + 1);
			}.bind(ctrl);
			elem.addEventListener('click', ctrl.clickHandler, false);

			log.exit();
		},
		update: function (value) {
			log.call(this, 'clone.update', value);

			this.count = value;
			var clone = this.elem.cloneNode(true);
			clone.addEventListener('click', this.clickHandler, false);
			clone.setAttribute('data-clone-count', value);

			var parent = this.elem.parentNode;
			var isBefore = this.options.cloneInsert === 'before';
			parent.insertBefore(clone, isBefore ? this.elem : this.elem.nextSibling);
			parent.insertBefore(document.createTextNode('\n'), isBefore ? this.elem : clone);
			this.chekhov.update();

			log.exit();
		}
	};


	return C;

})();