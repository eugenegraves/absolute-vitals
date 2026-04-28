export const Dropdown = () => (
	<details
		onPointerEnter={(event) => {
			if (event.pointerType === 'mouse') {
				event.currentTarget.open = true;
			}
		}}
		onPointerLeave={(event) => {
			if (event.pointerType === 'mouse') {
				event.currentTarget.open = false;
			}
		}}
	>
		<summary>Pages</summary>
		<nav>
			<a href="/react">React</a>
			<a href="/htmx">HTMX</a>
		</nav>
	</details>
);
