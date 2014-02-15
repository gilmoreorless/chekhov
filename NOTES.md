# Random thoughts

- **Q:** Do I handle just plain text, assume markup from syntax highlighters, or both?
- **Q:** Build on top of Tangle or make it standalone? **A:** Tried Tangle, it didn't quite do what I wanted, so standalone it is
- Start with just markup/CSS-based examples; JS APIs are a problem for later
- Composed of two main parts
- **Part 1** - Changeable snippets
	- Look for data attrs in code snippet to create interactive sections
		- ✓ Change text based on a pipe-separated string of values
		- ✓ Change text based on a named list (defined elsewhere)
		- ✓ Auto-change texts that rely on the same named list
		- Toggle display of a section via manual selection
		- Toggle display of a section based on a dependency (e.g. another element with `id="blah"` having a specific value)
		- Define a section as "cloneable" and allow adding/removing clones via click
		- Number value adjustment (e.g. width attr)
	- JS API to define lists of options
- **Part 2** - Linked highlighting
	- Hover on element -> highlight code open/close tags
	- Hover on code tag -> highlight element (with an overlay), plus related (open/close) tag
	- Highlight linked sections of code (e.g. `<label for="thing">` and `<input id="thing">`)


# Future ideas

- Theming
- How the hell to handle JS APIs
- Hande touch events for mobiles/tablets
- Code generation
	- Use something like CodeMirror to paste code into
	- Highlight a section of code and get a context menu with various actions
		- Create a placeholder for linking to later
		- Define a list
		- Use a list defined for another block
		- Make it depend on another highlighted section (such as a placeholder created earlier)
		- Make it toggleable
		- Make it cloneable
		- Make it an adjustable value

