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
		each(A(this.codeElem.childNodes), function (node) {
			div.appendChild(node);
		});
		this.codeElem.appendChild(div);
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
		var vars = this.vars = {};
		var elems = $$('[data-var]', this.codeElem);
		var ck = this;

		// Collect vars and controls
		each(elems, function (elem) {
			if (elem._chekhov) return;
			var options = getOptionsForElem(elem);
			var varName = options['var'];
			if (!varName) return;
			var value = elem.textContent.trim();

			var v = vars[varName] || {};
			v.value = value;
			v.controls || (v.controls = []);
			var controls = options.control.split('|');
			each(controls, function (cls) {
				if (C.controls[cls]) {
					var ctrl = new Control(C.controls[cls], elem, options, ck);
					v.controls.push(ctrl);
				}
			});
			vars[varName] = v;
			elem._chekhov = true;
		});

		// Init controls
		each(vars, function (varObj, varName) {
			each(varObj.controls, function (control, ctrlName) {
				control.init();
			});
		});

		this.update();
	};

	C.prototype.update = function () {
		console.log('Chekhov.update', this);
		this.outputElem.innerHTML = this.srcElem.textContent;
	};


	/*** Tangle-like functionality (variable/state management) ***/

	function Control(model, elem, options, chekhov) {
		for (var key in model) {
			this[key] = model[key];
		}
		this.elem = elem;
		this.options = options;
		this.chekhov = chekhov;
	}

	function getOptionsForElem(elem) {
		var options = {};
		if (elem.dataset) {
			each(elem.dataset, function (value, key) {
				options[key] = value;
			});
		} else {
			each(A(elem.attributes), function (attr) {
				var name = attr.name;
				if (name.length > 5 && name.substr(0, 5) === 'data-') {
					options[name.substr(5)] = attr.value;
				}
			});
		}
		return options;
	}

	C.prototype.get = function (varName) {
		return (this.vars[varName] || {}).value;
	};

	C.prototype.set = function (varName, value) {
		var varObj = this.vars[varName];
		if (!varObj) {
			varObj = this.vars[varName] = {};
		}
		varObj.value = value;
		each(varObj.controls, function (control) {
			control.update(value);
		});
		this.update();
	};


	/*** UI Controls ***/

	C.controls.CKOptionList = {
		init: function () {
			console.log('CKOptionList.init', this, arguments);

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
				var selected = $('.selected', ul);
				return selected ? selected.offsetTop || 0 : 0;
			}

			function hideList() {
				// Reset the span back to auto-adjusting width
				elem.style.width = 'auto';
				ul.classList.remove('active');
				blanket.classList.remove('active');
				chekhov.set(variable, optList.selected);
			}

			// Hover on code span, show options list
			elem.addEventListener('mouseover', function () {
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
			}, false);

			// Hover out from options list, revert back to selected option
			ul.addEventListener('mouseout', function (e) {
				if (!ul.contains(e.relatedTarget)) {
					hideList();
				}
			}, false);

			// Hover over options, change the value
			ul.addEventListener('mouseover', function (e) {
				if (e.target.nodeName === 'LI') {
					chekhov.set(variable, e.target.textContent);
				}
			}, false);

			// Click on an option, set selected value
			ul.addEventListener('click', function (e) {
				if (e.target.nodeName === 'LI') {
					$('.selected', ul).classList.remove('selected');
					e.target.classList.add('selected');
					var value = e.target.textContent;
					optList.selected = value;
					hideList();
				}
			}, false);

			elem.classList.add('CKOptionList');
			var style = getComputedStyle(elem);
			ul.style.color = style.color;
			if (!ul.parentNode) {
				this.chekhov.codeElem.appendChild(ul);
				this.chekhov.codeElem.appendChild(blanket);
			}
			// Quick show/hide to get proper option offset
			ul.classList.add('active');
			ul.classList.remove('active');
		},
		update: function (value) {
			console.log('CKOptionList.update', this, value);
			this.elem.textContent = value;
		}
	};


	return C;

})();