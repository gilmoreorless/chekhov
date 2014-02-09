/* Dependencies: Tangle */
var Chekhov = (function () {
	function A(list) {
		return Array.prototype.slice.apply(list);
	}
	function $(selector, root) {
		return (root || document).querySelector(selector);
	}
	function $$(selector, root) {
		return A((root || document).querySelectorAll(selector));
	}

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
		A(this.codeElem.childNodes).forEach(function (node) {
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

	C.prototype.init = function () {
		var vars = $$('[data-var]', this.codeElem).map(function (elem) {
			return [elem.getAttribute('data-var'), elem.textContent.trim()];
		});
		this.tangle = new Tangle(this.codeElem, {
			initialize: function () {
				console.log('Tangle.initialize', this);
				vars.forEach(function (vv) {
					this[vv[0]] = vv[1];
				}, this);
			},
			update: this.update.bind(this)
		});
		this.tangle.chekhov = this;
	};

	C.prototype.update = function () {
		this.outputElem.innerHTML = this.srcElem.textContent;
	};


	/*** Tangle ***/

	Tangle.classes.CKOptionList = {
		initialize: function (elem, options, tangle, variable) {
			console.log('CKOptionList.initialize', this, arguments);
			var optList = this;
			optList.variable = variable;
			optList.values = options.list && C.lists[options.list] || (options.values || '').split('|');
			var curValue = elem.textContent;
			// If provided value isn't in the list, choose the first option
			if (optList.values.length && optList.values.indexOf(curValue) === -1) {
				// TODO: Should really get the value out of Tangle, but tangle.initialize hasn't been run yet, annoying
				var v = optList.values[0];
				curValue = v;
				// TODO: This is a case of Tangle getting in the way rather than helping
				setTimeout(function () {
					tangle.setValue(variable, v);
				})
			}
			optList.selected = curValue;

			var ul = $('ul[data-for=' + variable + ']', tangle.element);
			if (!ul) {
				ul = document.createElement('ul');
				ul.className = 'ck-list-options';
				ul.setAttribute('data-for', variable);
				ul.innerHTML = optList.values.map(function (value) {
					var open = '<li' + (value === optList.selected ? ' class="selected"' : '') + '>';
					return open + value + '</li>';
				}).join('');
			}

			var blanket = document.createElement('div');
			blanket.className = 'ck-list-blanket';

			function getSelectedOffset() {
				var selected = $('.selected', ul);
				return selected ? selected.offsetTop || 0 : 0;
			}

			function hideList() {
				// Reset the span back to auto-adjusting width
				elem.style.width = 'auto';
				ul.classList.remove('active');
				blanket.classList.remove('active');
				tangle.setValue(variable, optList.selected);
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
					tangle.setValue(variable, e.target.textContent);
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

			var style = getComputedStyle(elem);
			ul.style.color = style.color;
			tangle.element.appendChild(ul);
			tangle.element.appendChild(blanket);
			// Quick show/hide to get proper option offset
			ul.classList.add('active');
			ul.classList.remove('active');
		},
		update: function (elem, value) {
			console.log('CKOptionList.update', this, value);
			elem.textContent = value;
		}
	};


	return C;

})();