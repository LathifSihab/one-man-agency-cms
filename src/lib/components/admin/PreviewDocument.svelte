<script lang="ts">
	import type { Component } from 'svelte';
	import Chrome from '$components/Chrome.svelte';
	import type { ServiceLink, Settings } from '$lib/types';

	/**
	 * A public page as the site would render it, for the editor's preview.
	 *
	 * The public layout cannot be reused as-is: it reads the address from
	 * $app/state, which only exists inside a SvelteKit request, and this is
	 * rendered with svelte/server directly. It does nothing else but put the page
	 * inside Chrome, so that is all this does too.
	 */
	interface Props {
		route: Component<{ data: Record<string, unknown> }>;
		data: Record<string, unknown>;
		settings: Settings;
		services: ServiceLink[];
		pathname: string;
	}

	let { route: Route, data, settings, services, pathname }: Props = $props();
</script>

<Chrome {settings} {services} {pathname}>
	<Route {data} />
</Chrome>
