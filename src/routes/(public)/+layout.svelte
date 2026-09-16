<script lang="ts">
	import { page } from '$app/state';
	import Chrome from '$components/Chrome.svelte';
	import { organisationSchema, ldJson } from '$lib/schema';

	let { data, children } = $props();

	// One ProfessionalService node, emitted once per page, referenced by @id from
	// every other schema on the site.
	const org = $derived(ldJson(organisationSchema(data.settings)));
</script>

<svelte:head>
	{@html `<script type="application/ld+json">${org}<\/script>`}
</svelte:head>

<Chrome settings={data.settings} pathname={page.url.pathname}>
	{@render children()}
</Chrome>

<!--
  The mobile nav toggle. Kept as plain inline JavaScript rather than a hydrated
  Svelte component: the public site sets csr = false, and shipping the Svelte
  runtime to power one button would blow the performance budget in handover/06
  (the reference build is one stylesheet, one webfont and three lines of JS).
-->
<svelte:element this={'script'}>
	{@html `(function(){var n=document.getElementById('nav'),b=n.querySelector('.nav-toggle');
function zet(o){n.classList.toggle('open',o);b.setAttribute('aria-expanded',o?'true':'false');}
b.addEventListener('click',function(){zet(!n.classList.contains('open'));});
n.addEventListener('click',function(e){if(e.target.closest('a'))zet(false);});
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&n.classList.contains('open')){zet(false);b.focus();}});
window.addEventListener('resize',function(){if(window.innerWidth>920)zet(false);});})();`}
</svelte:element>
