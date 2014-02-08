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
			this.variable = variable;
			this.values = (options.values || '').split('|');
			this.selected = elem.textContent
			var that = this;

			var ul = document.createElement('ul');
			ul.className = 'ck-list-options';
			ul.innerHTML = this.values.map(function (value) { return '<li>' + value + '</li>'; }).join('');
			elem.addEventListener('mouseover', function () {
				ul.classList.add('active');
			}, false);
			ul.addEventListener('mouseout', function (e) {
				if (!ul.contains(e.relatedTarget)) {
					ul.classList.remove('active');
					tangle.setValue(variable, that.selected);
				}
			}, false);
			ul.addEventListener('mouseover', function (e) {
				if (e.target.nodeName === 'LI') {
					tangle.setValue(variable, e.target.textContent);
				}
			}, false);

			var style = getComputedStyle(elem);
			var left = elem.offsetLeft;
			var top = elem.offsetTop;
			ul.style.color = style.color;
			ul.style.left = left + 'px';
			ul.style.top = top + 'px';
			tangle.element.appendChild(ul);
		},
		update: function (elem, value) {
			console.log('CKOptionList.update', this, value);
			elem.textContent = value;
		}
	};


	return C;

})();